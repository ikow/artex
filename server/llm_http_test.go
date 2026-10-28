package server

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Autumn-27/artex/agent"
	"github.com/Autumn-27/artex/llmrec"
	"github.com/Autumn-27/norma/llm"
	"github.com/Autumn-27/norma/transcript"
)

func TestHTTPTrackingRetriesWithBodyRecordingOff(t *testing.T) {
	m, err := NewManager(t.TempDir(), "")
	if err != nil {
		t.Fatal("could not open the configured test database")
	}
	defer m.Close()
	pg := m.PG()
	if err := pg.EnsureLLMUsageTable(); err != nil {
		t.Fatal(err)
	}
	const modelName = "http-retry-test-only"
	defer pg.Exec(`DELETE FROM llm_http_attempts WHERE model=$1`, modelName)
	defer pg.Exec(`DELETE FROM llm_usage WHERE model=$1`, modelName)
	var requestCount atomic.Int64
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request struct {
			Stream bool `json:"stream"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Error("could not decode fixture request")
			w.WriteHeader(400)
			return
		}
		if requestCount.Add(1) == 1 {
			w.Header().Set("Retry-After", "0")
			w.Header().Set("X-Ratelimit-Policy", "tokens per minute")
			w.Header().Set("X-Ratelimit-Limit", "12000")
			w.Header().Set("Set-Cookie", "secret-cookie-test")
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = io.WriteString(w, `{"error":{"message":"rate limit exceeded"}}`)
			return
		}
		if !request.Stream {
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"id":"test","choices":[{"message":{"role":"assistant","content":"OK"},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":1}}`)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = io.WriteString(w, "data: {\"id\":\"test\",\"choices\":[{\"delta\":{\"content\":\"OK\"},\"finish_reason\":null}]}\n\n")
		_, _ = io.WriteString(w, "data: {\"id\":\"test\",\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":3,\"completion_tokens\":1}}\n\n")
		_, _ = io.WriteString(w, "data: [DONE]\n\n")
	}))
	defer upstream.Close()
	config := agent.Config{Format: llm.FormatOpenAI, BaseURL: upstream.URL, APIKey: "secret-api-key-test", Model: modelName}
	config.Retry.ConnectAttempts = 1
	config.Retry.ConnectInterval = time.Millisecond
	inner, err := config.NewProvider()
	if err != nil {
		t.Fatal(err)
	}
	rec := llmrec.Wrap(inner, pg, modelName, "metadata-test", "", "", func() bool { return false })
	ctx := transcript.WithSessionID(context.Background(), "exp999997-worker-i1")
	ctx = llmrec.WithTaskID(ctx, "999997")
	var text strings.Builder
	for event, streamErr := range rec.Stream(ctx, llm.CompletionRequest{
		Messages: []llm.Message{{Role: llm.RoleUser, Content: []llm.ContentBlock{{Type: "text", Text: "private-prompt-test"}}}},
	}) {
		if streamErr != nil {
			t.Fatal(streamErr)
		}
		if event.Type == llm.SETextDelta {
			text.WriteString(event.Text)
		}
	}
	if requestCount.Load() != 2 || text.String() != "OK" {
		t.Fatalf("retry/stream failed: requests=%d reply=%q", requestCount.Load(), text.String())
	}
	stats, err := pg.LLMHTTPStats(context.Background(), 24)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, row := range stats.Models {
		if row.Model == modelName {
			found = true
			if row.Attempts != 2 || row.RateLimited != 1 || row.SDKRetries != 1 || row.RateLimitPct != 50 {
				t.Fatalf("SDK retry was not counted accurately: %+v", row)
			}
		}
	}
	if !found {
		t.Fatal("metadata missing with body recording disabled")
	}
	encoded, _ := json.Marshal(stats)
	for _, forbidden := range []string{"private-prompt-test", "secret-api-key-test", "secret-cookie-test", upstream.URL} {
		if strings.Contains(string(encoded), forbidden) {
			t.Fatal("sensitive or body data reached HTTP telemetry")
		}
	}
	var recordedBodies int
	if err := pg.QueryRow(`SELECT count(*) FROM llm_records WHERE model=$1`, modelName).Scan(&recordedBodies); err != nil {
		t.Fatal(err)
	}
	if recordedBodies != 0 {
		t.Fatal("HTTP telemetry enabled body recording")
	}

	// The public route must remain behind the original authentication middleware.
	dataDir := t.TempDir()
	server := New(context.Background(), m, "", dataDir, t.TempDir())
	handler := server.Handler()
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/llm/http-stats", nil))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated statistics returned HTTP %d", w.Code)
	}
	token, err := signJWT(server.jwtKey)
	if err != nil {
		t.Fatal(err)
	}
	for _, test := range []struct {
		path   string
		status int
	}{
		{"/api/llm/http-stats?hours=24", 200},
		{"/api/llm/http-stats?hours=0", 400},
		{"/api/llm/http-stats?hours=169", 400},
		{"/api/llm/http-stats?hours=invalid", 400},
	} {
		req := httptest.NewRequest(http.MethodGet, test.path, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != test.status {
			t.Errorf("%s: status=%d, want %d", test.path, w.Code, test.status)
		}
	}
	// Non-streaming completions and the UI's connection-test route must also be
	// counted, without involving a real provider or starting an agent task.
	if _, _, _, err := rec.Complete(ctx, llm.CompletionRequest{
		Messages: []llm.Message{{Role: llm.RoleUser, Content: []llm.ContentBlock{{Type: "text", Text: "private-prompt-test"}}}},
	}); err != nil {
		t.Fatal(err)
	}
	payload, _ := json.Marshal(map[string]any{
		"provider": "openai", "model": modelName, "base_url": upstream.URL,
		"api_key": "secret-api-key-test", "streaming": false,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/llm/test", strings.NewReader(string(payload)))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	var result struct {
		OK    bool   `json:"ok"`
		Reply string `json:"reply"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil || w.Code != 200 || !result.OK || result.Reply != "OK" {
		t.Fatal("fixture connection test did not succeed")
	}
	var httpAttempts int
	if err := pg.QueryRow(`SELECT count(*) FROM llm_http_attempts WHERE model=$1`, modelName).Scan(&httpAttempts); err != nil {
		t.Fatal(err)
	}
	if httpAttempts != 4 || requestCount.Load() != 4 {
		t.Fatalf("stream, completion and connection-test coverage: records=%d requests=%d", httpAttempts, requestCount.Load())
	}
}
