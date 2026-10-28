package db

import (
	"context"
	"encoding/json"
	"time"
)

// LLMHTTPAttempt contains request metadata only, never URLs, bodies, or credentials.
// StatusCode is the original upstream HTTP status (before any quota normalization);
// zero means no HTTP response was received.
type LLMHTTPAttempt struct {
	ID            int64             `json:"id,omitempty"`
	TS            time.Time         `json:"ts"`
	CallID        string            `json:"call_id"`
	Attempt       int64             `json:"attempt"`
	TaskID        string            `json:"task_id"`
	ExplorationID int64             `json:"exploration_id"`
	Worker        string            `json:"worker"`
	Model         string            `json:"model"`
	ProfileName   string            `json:"profile_name"`
	StatusCode    int               `json:"status_code"`
	HeadersMs     int64             `json:"headers_ms"`
	ErrorKind     string            `json:"error_kind,omitempty"`
	RateHeaders   map[string]string `json:"rate_headers"`
}

func (d *DB) InsertLLMHTTPAttempt(ctx context.Context, a LLMHTTPAttempt) error {
	headers, err := json.Marshal(a.RateHeaders)
	if err != nil {
		return err
	}
	_, err = d.ExecContext(ctx, `
INSERT INTO llm_http_attempts
 (ts,call_id,attempt,task_id,exploration_id,worker,model,profile_name,status_code,headers_ms,error_kind,rate_headers)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		a.TS, a.CallID, a.Attempt, a.TaskID, a.ExplorationID, a.Worker,
		a.Model, a.ProfileName, a.StatusCode, a.HeadersMs, a.ErrorKind, string(headers))
	return err
}

type LLMHTTPModelStats struct {
	Model           string            `json:"model"`
	ProfileName     string            `json:"profile_name"`
	Attempts        int64             `json:"attempts"`
	Responses       int64             `json:"responses"`
	RateLimited     int64             `json:"rate_limited"`
	HTTPErrors      int64             `json:"http_errors"`
	TransportErrors int64             `json:"transport_errors"`
	SDKRetries      int64             `json:"sdk_retries"`
	RateLimitPct    float64           `json:"rate_limit_pct"`
	LastAttemptAt   time.Time         `json:"last_attempt_at"`
	LastLimitAt     *time.Time        `json:"last_limit_at"`
	HeadersAt       *time.Time        `json:"headers_at"`
	RateHeaders     map[string]string `json:"rate_headers"`
}

type LLMHTTPStats struct {
	Hours         int                 `json:"hours"`
	Since         time.Time           `json:"since"`
	AsOf          time.Time           `json:"as_of"`
	TrackingSince *time.Time          `json:"tracking_since"`
	Models        []LLMHTTPModelStats `json:"models"`
	RecentLimits  []LLMHTTPAttempt    `json:"recent_limits"`
}

// LLMHTTPStats reads a bounded time window. Every HTTP attempt is counted,
// including retries hidden beneath the completion-level usage ledger.
func (d *DB) LLMHTTPStats(ctx context.Context, hours int) (LLMHTTPStats, error) {
	if hours < 1 || hours > 168 {
		hours = 24
	}
	now := time.Now().UTC()
	result := LLMHTTPStats{
		Hours: hours, Since: now.Add(-time.Duration(hours) * time.Hour), AsOf: now,
		Models: []LLMHTTPModelStats{}, RecentLimits: []LLMHTTPAttempt{},
	}
	if err := d.QueryRowContext(ctx, `SELECT min(ts) FROM llm_http_attempts`).Scan(&result.TrackingSince); err != nil {
		return result, err
	}
	rows, err := d.QueryContext(ctx, `
WITH windowed AS (
 SELECT * FROM llm_http_attempts WHERE ts >= $1 AND ts <= $2
), stats AS (
 SELECT model,profile_name,count(*) AS attempts,
 count(*) FILTER (WHERE status_code > 0) AS responses,
 count(*) FILTER (WHERE status_code = 429) AS rate_limited,
 count(*) FILTER (WHERE status_code >= 400) AS http_errors,
 count(*) FILTER (WHERE status_code = 0) AS transport_errors,
 count(*) FILTER (WHERE attempt > 1) AS sdk_retries,
 max(ts) AS last_attempt_at, max(ts) FILTER (WHERE status_code = 429) AS last_limit_at
 FROM windowed GROUP BY model,profile_name
)
SELECT s.*,h.ts,COALESCE(h.rate_headers,'{}'::jsonb)
FROM stats s LEFT JOIN LATERAL (
 SELECT ts,rate_headers FROM windowed h
 WHERE h.model=s.model AND h.profile_name=s.profile_name AND h.rate_headers<>'{}'::jsonb
 ORDER BY h.ts DESC,h.id DESC LIMIT 1
) h ON true ORDER BY s.rate_limited DESC,s.attempts DESC,s.model,s.profile_name`,
		result.Since, result.AsOf)
	if err != nil {
		return result, err
	}
	for rows.Next() {
		var model LLMHTTPModelStats
		var headers []byte
		if err = rows.Scan(&model.Model, &model.ProfileName, &model.Attempts,
			&model.Responses, &model.RateLimited, &model.HTTPErrors, &model.TransportErrors,
			&model.SDKRetries, &model.LastAttemptAt, &model.LastLimitAt, &model.HeadersAt, &headers); err != nil {
			rows.Close()
			return result, err
		}
		if err = json.Unmarshal(headers, &model.RateHeaders); err != nil {
			rows.Close()
			return result, err
		}
		if model.Responses > 0 {
			model.RateLimitPct = 100 * float64(model.RateLimited) / float64(model.Responses)
		}
		result.Models = append(result.Models, model)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return result, err
	}
	recent, err := d.QueryContext(ctx, `
SELECT id,ts,call_id,attempt,task_id,exploration_id,worker,model,profile_name,status_code,headers_ms,error_kind,rate_headers
FROM llm_http_attempts WHERE ts >= $1 AND ts <= $2 AND status_code=429 ORDER BY ts DESC,id DESC LIMIT 20`,
		result.Since, result.AsOf)
	if err != nil {
		return result, err
	}
	defer recent.Close()
	for recent.Next() {
		var a LLMHTTPAttempt
		var headers []byte
		if err = recent.Scan(&a.ID, &a.TS, &a.CallID, &a.Attempt, &a.TaskID, &a.ExplorationID,
			&a.Worker, &a.Model, &a.ProfileName, &a.StatusCode, &a.HeadersMs, &a.ErrorKind, &headers); err != nil {
			return result, err
		}
		if err = json.Unmarshal(headers, &a.RateHeaders); err != nil {
			return result, err
		}
		result.RecentLimits = append(result.RecentLimits, a)
	}
	return result, recent.Err()
}
