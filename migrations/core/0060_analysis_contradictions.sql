-- AGENT-002: grounded contradictions and explicit finding decisions.
CREATE TABLE analysis_contradictions (
 id TEXT PRIMARY KEY,
 run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
 position INTEGER NOT NULL,
 payload_json TEXT CHECK(payload_json IS NULL OR json_valid(payload_json)),
 UNIQUE(run_id,position)
);
CREATE TABLE analysis_finding_decisions (
 run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
 finding_id TEXT NOT NULL,
 decision TEXT NOT NULL CHECK(decision IN ('accepted','dismissed')),
 operator_id TEXT NOT NULL,
 decided_at TEXT NOT NULL,
 PRIMARY KEY(run_id,finding_id)
);
