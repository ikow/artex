package server

import (
	"context"
	"net/http"
	"strconv"
	"time"
)

func (s *Server) llmHTTPStats(w http.ResponseWriter, r *http.Request) {
	hours := 24
	if raw := r.URL.Query().Get("hours"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 || parsed > 168 {
			writeErr(w, http.StatusBadRequest, "hours must be between 1 and 168")
			return
		}
		hours = parsed
	}
	pg := s.m.PG()
	if pg == nil {
		writeErr(w, http.StatusServiceUnavailable, errDataSourceUnavailable)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	stats, err := pg.LLMHTTPStats(ctx, hours)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "读取模型 HTTP 限流统计失败")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, stats)
}
