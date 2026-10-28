package llmrec

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"regexp"
	"strings"
	"sync/atomic"
	"time"

	"github.com/Autumn-27/artex/db"
	"github.com/google/uuid"
)

type httpObserverKey struct{}

type httpObserver struct {
	attempt atomic.Int64
	record  func(db.LLMHTTPAttempt)
}

// WithHTTPObserver instruments HTTP attempts without enabling body capture.
// It is intentionally distinct from Capture, whose contents can include prompts.
func WithHTTPObserver(ctx context.Context, record func(db.LLMHTTPAttempt)) context.Context {
	return context.WithValue(ctx, httpObserverKey{}, &httpObserver{record: record})
}

var (
	numericHeader  = regexp.MustCompile(`^-?[0-9]+(?:\.[0-9]+)?$`)
	durationHeader = regexp.MustCompile(`^(?:[0-9]+(?:\.[0-9]+)?(?:ms|s|m|h|d))+$`)
	policyHeader   = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9 _()./-]{0,127}$`)
	credentialLike = regexp.MustCompile(`(?i)bearer|sk-|secret|password|api.?key`)
)

// SafeRateHeaders is an allowlist, not a copy of response headers. Even allowed
// fields must contain a valid numeric limit, reset time, or short policy label.
func SafeRateHeaders(headers http.Header) map[string]string {
	result := make(map[string]string)
	numeric := []string{
		"x-ratelimit-limit", "x-ratelimit-used", "x-ratelimit-remaining",
		"x-ratelimit-limit-requests", "x-ratelimit-remaining-requests",
		"x-ratelimit-limit-tokens", "x-ratelimit-remaining-tokens",
		"anthropic-ratelimit-requests-limit", "anthropic-ratelimit-requests-remaining",
		"anthropic-ratelimit-tokens-limit", "anthropic-ratelimit-tokens-remaining",
	}
	for _, name := range numeric {
		value := strings.TrimSpace(headers.Get(name))
		if len(value) <= 64 && numericHeader.MatchString(value) {
			result[name] = value
		}
	}
	for _, name := range []string{
		"retry-after", "x-ratelimit-reset", "x-ratelimit-reset-requests", "x-ratelimit-reset-tokens",
		"anthropic-ratelimit-requests-reset", "anthropic-ratelimit-tokens-reset",
	} {
		value := strings.TrimSpace(headers.Get(name))
		if value == "" || len(value) > 96 {
			continue
		}
		_, httpDateErr := http.ParseTime(value)
		_, isoDateErr := time.Parse(time.RFC3339Nano, value)
		if numericHeader.MatchString(value) || durationHeader.MatchString(value) || httpDateErr == nil || isoDateErr == nil {
			result[name] = value
		}
	}
	policy := strings.TrimSpace(headers.Get("x-ratelimit-policy"))
	if policyHeader.MatchString(policy) && !credentialLike.MatchString(policy) {
		result["x-ratelimit-policy"] = policy
	}
	return result
}

// BeginHTTPAttempt assigns an attempt number before dispatch. Its completion
// callback records only time-to-headers; it never reads or buffers the body.
func BeginHTTPAttempt(ctx context.Context) func(*http.Response, error, time.Duration) {
	observer, _ := ctx.Value(httpObserverKey{}).(*httpObserver)
	if observer == nil || observer.record == nil {
		return func(*http.Response, error, time.Duration) {}
	}
	attempt := observer.attempt.Add(1)
	return func(response *http.Response, err error, elapsed time.Duration) {
		a := db.LLMHTTPAttempt{
			TS: time.Now().UTC(), Attempt: attempt, HeadersMs: max(0, elapsed.Milliseconds()),
			RateHeaders: make(map[string]string),
		}
		if response != nil {
			a.StatusCode = response.StatusCode
			a.RateHeaders = SafeRateHeaders(response.Header)
		}
		if err != nil {
			switch {
			case errors.Is(err, context.Canceled):
				a.ErrorKind = "canceled"
			case errors.Is(err, context.DeadlineExceeded):
				a.ErrorKind = "timeout"
			default:
				a.ErrorKind = "transport"
			}
		}
		observer.record(a)
	}
}

func (r *Recorder) withHTTPRecording(ctx context.Context, taskID string, expID int64, worker string) context.Context {
	if r.pg == nil {
		return ctx
	}
	callID := uuid.NewString()
	return WithHTTPObserver(ctx, func(a db.LLMHTTPAttempt) {
		a.CallID, a.TaskID, a.ExplorationID, a.Worker = callID, taskID, expID, worker
		a.Model, a.ProfileName = r.model, r.prof
		// Canceled calls still need a ledger row. Bound the telemetry write rather
		// than inheriting an already-canceled model request context.
		writeCtx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		if err := r.pg.InsertLLMHTTPAttempt(writeCtx, a); err != nil {
			log.Print("[llm-http] metadata persistence failed; this attempt was not counted")
		}
		if a.StatusCode == http.StatusTooManyRequests {
			metadata, _ := json.Marshal(a)
			log.Printf("[llm-rate-limit] %s", metadata)
		}
	})
}

// WithHTTPRecording covers diagnostic calls that do not use a Recorder, such as
// a profile's connection test. It does not enable full request/response capture.
func WithHTTPRecording(ctx context.Context, pg *db.DB, model, profileName, worker string) context.Context {
	r := &Recorder{pg: pg, model: model, prof: profileName}
	return r.withHTTPRecording(ctx, TaskIDFrom(ctx), 0, worker)
}
