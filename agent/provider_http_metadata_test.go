package agent

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/Autumn-27/artex/db"
	"github.com/Autumn-27/artex/llmrec"
)

type metadataCountingBody struct {
	io.Reader
	reads int
}

func (r *metadataCountingBody) Read(p []byte) (int, error) {
	r.reads++
	return r.Reader.Read(p)
}
func (*metadataCountingBody) Close() error { return nil }

func TestHTTPMetadataPreservesStreaming(t *testing.T) {
	body := &metadataCountingBody{Reader: strings.NewReader("stream is not buffered")}
	var recorded db.LLMHTTPAttempt
	ctx := llmrec.WithHTTPObserver(context.Background(), func(a db.LLMHTTPAttempt) { recorded = a })
	transport := quotaAwareTransport{base: roundTripperFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Header: http.Header{"X-Ratelimit-Limit": {"120"}}, Body: body}, nil
	})}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "http://local.test/chat/completions", nil)
	response, err := transport.RoundTrip(req)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if body.reads != 0 || recorded.StatusCode != 200 || recorded.RateHeaders["x-ratelimit-limit"] != "120" {
		t.Fatalf("stream was consumed or metadata missing: reads=%d metadata=%+v", body.reads, recorded)
	}
}

func TestHTTPMetadataKeepsOriginalQuotaStatus(t *testing.T) {
	var recorded db.LLMHTTPAttempt
	ctx := llmrec.WithHTTPObserver(context.Background(), func(a db.LLMHTTPAttempt) { recorded = a })
	transport := quotaAwareTransport{base: roundTripperFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: 429, Header: http.Header{"Retry-After": {"60"}},
			Body: io.NopCloser(strings.NewReader(`{"error":{"code":"insufficient_quota"}}`)),
		}, nil
	})}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "http://local.test/chat/completions", nil)
	response, err := transport.RoundTrip(req)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != 402 || recorded.StatusCode != 429 {
		t.Fatalf("normalized=%d recorded=%d", response.StatusCode, recorded.StatusCode)
	}
}
