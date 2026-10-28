export interface LLMHTTPAttempt {
  id: number;
  ts: string;
  call_id: string;
  attempt: number;
  task_id: string;
  exploration_id: number;
  worker: string;
  model: string;
  profile_name: string;
  status_code: number;
  headers_ms: number;
  error_kind?: string;
  rate_headers: Record<string, string>;
}

export interface LLMHTTPModelStats {
  model: string;
  profile_name: string;
  attempts: number;
  responses: number;
  rate_limited: number;
  http_errors: number;
  transport_errors: number;
  sdk_retries: number;
  rate_limit_pct: number;
  last_attempt_at: string;
  last_limit_at: string | null;
  headers_at: string | null;
  rate_headers: Record<string, string>;
}

export interface LLMHTTPStats {
  hours: number;
  since: string;
  as_of: string;
  tracking_since: string | null;
  models: LLMHTTPModelStats[];
  recent_limits: LLMHTTPAttempt[];
}
