package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Autumn-27/artex/agent"
)

func TestLLMConnectionTokenField(t *testing.T) {
	for _, field := range []string{"", "max_completion_tokens"} {
		t.Run("field="+field, func(t *testing.T) {
			var received map[string]any
			gateway := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if err := json.NewDecoder(r.Body).Decode(&received); err != nil {
					t.Error(err)
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"id":"test","object":"chat.completion","model":"test","choices":[{"index":0,"message":{"role":"assistant","content":"OK"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`))
			}))
			defer gateway.Close()
			body, _ := json.Marshal(map[string]any{
				"provider": "openai", "model": "test", "base_url": gateway.URL + "/v1",
				"streaming": false, "max_tokens_field": field,
			})
			s := &Server{llmCfg: agent.Config{APIKey: "local-test-only"}}
			rec := httptest.NewRecorder()
			s.testLLM(rec, httptest.NewRequest("POST", "/api/llm/test", bytes.NewReader(body)))
			var result map[string]any
			if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
				t.Fatal(err)
			}
			if result["ok"] != true || result["reply"] != "OK" {
				t.Fatalf("connection test failed: %v", result)
			}
			expected, absent := "max_tokens", "max_completion_tokens"
			if field == "max_completion_tokens" {
				expected, absent = absent, expected
			}
			if received[expected] != float64(8192) {
				t.Fatalf("%s missing from completion request", expected)
			}
			if _, found := received[absent]; found {
				t.Fatalf("unexpected %s in completion request", absent)
			}
		})
	}
}

func TestLLMConnectionRejectsInvalidTokenField(t *testing.T) {
	s := &Server{}
	rec := httptest.NewRecorder()
	s.testLLM(rec, httptest.NewRequest("POST", "/api/llm/test",
		bytes.NewBufferString(`{"provider":"openai","max_tokens_field":"invalid"}`)))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("invalid token field returned HTTP %d", rec.Code)
	}
}
