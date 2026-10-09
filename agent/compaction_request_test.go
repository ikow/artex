package agent

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// A summary must not inject Anthropic's "thinking" field into an OpenAI
// request. Provider configuration already owns model-specific reasoning.
func TestCompactorDoesNotForceThinkingParameter(t *testing.T) {
	var body map[string]any
	gateway := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Error(err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"local-summary","model":"test","choices":[{"message":{"role":"assistant","content":"A local fixture summary."},"finish_reason":"stop"}]}`))
	}))
	defer gateway.Close()
	cfg := ConfigFrom("openai", "test", gateway.URL+"/v1", "local-test-only", "")
	cfg.MaxTokensField = "max_completion_tokens"
	provider, err := cfg.NewProvider()
	if err != nil {
		t.Fatal(err)
	}
	c := NewCompactor(provider, "test")
	reply, err := c.compress(context.Background(), &coldGraph{}, block{}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if reply != "A local fixture summary." {
		t.Fatalf("unexpected summary: %q", reply)
	}
	if _, present := body["thinking"]; present {
		t.Fatal("summary request contains unsupported thinking parameter")
	}
	if body["max_completion_tokens"] != float64(1500) {
		t.Fatal("summary request lost its provider-selected output token field")
	}
}
