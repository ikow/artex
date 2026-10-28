package db

import (
	"context"
	"testing"
	"time"
)

func TestHTTPStatsCountsRawAttemptsAndWindows(t *testing.T) {
	d, err := Open(testDSN(t))
	if err != nil {
		t.Fatal("could not open the configured test database")
	}
	defer d.Close()
	const modelName = "http-stats-test-only"
	defer d.Exec(`DELETE FROM llm_http_attempts WHERE model=$1`, modelName)
	now := time.Now().UTC()
	for i, code := range []int{429, 200, 0, 429} {
		ts := now.Add(-time.Duration(10-i) * time.Minute)
		if i == 3 {
			ts = now.Add(-25 * time.Hour)
		}
		if err := d.InsertLLMHTTPAttempt(context.Background(), LLMHTTPAttempt{
			TS: ts, Model: modelName, ProfileName: "profile-test", CallID: "call-test",
			Attempt: int64(i + 1), StatusCode: code,
			RateHeaders: map[string]string{"x-ratelimit-limit": "120"},
		}); err != nil {
			t.Fatal(err)
		}
	}
	stats, err := d.LLMHTTPStats(context.Background(), 24)
	if err != nil {
		t.Fatal(err)
	}
	var got *LLMHTTPModelStats
	for i := range stats.Models {
		if stats.Models[i].Model == modelName {
			got = &stats.Models[i]
		}
	}
	if got == nil {
		t.Fatal("missing per-model counters")
	}
	if got.Attempts != 3 || got.Responses != 2 || got.RateLimited != 1 || got.TransportErrors != 1 || got.SDKRetries != 2 || got.RateLimitPct != 50 {
		t.Fatalf("incorrect HTTP-level counts: %+v", got)
	}
	if got.HeadersAt == nil || got.RateHeaders["x-ratelimit-limit"] != "120" || stats.TrackingSince == nil {
		t.Fatal("observed limit header or coverage timestamp was lost")
	}
	var events int
	for _, a := range stats.RecentLimits {
		if a.Model == modelName {
			events++
		}
	}
	if events != 1 {
		t.Fatalf("recent events included the wrong time window: %d", events)
	}
}
