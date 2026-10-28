package llmrec

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Autumn-27/artex/db"
)

func TestHTTPRateHeadersAreMetadataOnly(t *testing.T) {
	h := make(http.Header)
	h.Set("Authorization", "Bearer private-test-secret")
	h.Set("Set-Cookie", "session=private-test-secret")
	h.Set("X-Request-ID", "not-an-allowed-field")
	h.Set("X-Ratelimit-Policy", "tokens per minute")
	h.Set("X-Ratelimit-Limit", "12000")
	h.Set("X-Ratelimit-Remaining", "0")
	h.Set("X-Ratelimit-Reset", "2026-10-28T22:00:00Z")
	h.Set("Retry-After", "Wed, 28 Oct 2026 22:00:00 GMT")
	h.Set("X-Ratelimit-Limit-Requests", "Bearer private-test-secret")
	h.Set("X-Ratelimit-Reset-Tokens", "1m30s")
	h.Set("X-Ratelimit-Private-Key", "private-test-secret")
	got := SafeRateHeaders(h)
	for _, key := range []string{"x-ratelimit-policy", "x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset", "retry-after", "x-ratelimit-reset-tokens"} {
		if got[key] != h.Get(key) {
			t.Errorf("missing valid metadata %s", key)
		}
	}
	if len(got) != 6 {
		t.Fatalf("unexpected headers in metadata: %v", got)
	}
	body, _ := json.Marshal(got)
	if strings.Contains(string(body), "private-test-secret") {
		t.Fatal("credential-like value reached metadata")
	}
	h.Set("X-Ratelimit-Policy", "Bearer private-test-secret")
	if _, ok := SafeRateHeaders(h)["x-ratelimit-policy"]; ok {
		t.Fatal("credential-like policy label was retained")
	}
}

func TestHTTPObserverCountsAndSanitizesErrors(t *testing.T) {
	var attempts []db.LLMHTTPAttempt
	ctx := WithHTTPObserver(context.Background(), func(a db.LLMHTTPAttempt) { attempts = append(attempts, a) })
	first := BeginHTTPAttempt(ctx)
	second := BeginHTTPAttempt(ctx)
	second(&http.Response{StatusCode: 200, Header: make(http.Header)}, nil, 5*time.Millisecond)
	first(&http.Response{StatusCode: 429, Header: http.Header{"Retry-After": {"12"}}}, nil, 7*time.Millisecond)
	BeginHTTPAttempt(ctx)(nil, errors.New("request URL contains private-test-secret"), time.Millisecond)
	if len(attempts) != 3 || attempts[0].Attempt != 2 || attempts[1].Attempt != 1 || attempts[2].Attempt != 3 {
		t.Fatalf("attempt numbers were not assigned at dispatch: %+v", attempts)
	}
	if attempts[1].RateHeaders["retry-after"] != "12" || attempts[2].StatusCode != 0 || attempts[2].ErrorKind != "transport" {
		t.Fatalf("incorrect response or network classification: %+v", attempts)
	}
	body, _ := json.Marshal(attempts)
	if strings.Contains(string(body), "private-test-secret") {
		t.Fatal("raw transport error was recorded")
	}
}

func TestHTTPObserverConcurrentAttempts(t *testing.T) {
	var mu sync.Mutex
	seen := make(map[int64]bool)
	ctx := WithHTTPObserver(context.Background(), func(a db.LLMHTTPAttempt) {
		mu.Lock()
		defer mu.Unlock()
		if seen[a.Attempt] {
			t.Errorf("duplicate attempt %d", a.Attempt)
		}
		seen[a.Attempt] = true
	})
	var workers sync.WaitGroup
	for i := 0; i < 40; i++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			BeginHTTPAttempt(ctx)(&http.Response{StatusCode: 200}, nil, time.Millisecond)
		}()
	}
	workers.Wait()
	if len(seen) != 40 {
		t.Fatalf("recorded %d attempts, want 40", len(seen))
	}
}
