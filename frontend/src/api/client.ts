/**
 * API client — all calls to the Sentinel FastAPI backend.
 */

const BASE_URL = "";

export interface CalibrationBin {
  lower: number;
  upper: number;
  count: number;
  avg_confidence: number;
  accuracy: number;
}

export interface CalibrationData {
  n_labeled: number;
  brier_score: number;
  expected_calibration_error: number;
  bins?: CalibrationBin[];
}

export interface ConsistencyPair {
  case_id_a: string;
  case_id_b: string;
  claim_a?: string;
  claim_b?: string;
  score: number;
  flagged: boolean;
}

export interface IncidentFlag {
  flag_type: string;
  detail: string;
  case_id: string | null;
  timestamp: string;
  agent_id?: string;
}

export interface AgentSummary {
  composite_score: number;
  avg_groundedness: number;
  avg_consistency: number;
  ungrounded_flags: number;
  consistency_pairs: ConsistencyPair[];
  calibration: CalibrationData;
  status: "ACTIVE" | "PAUSED";
  health_label: "NOMINAL" | "CAUTION" | "CRITICAL";
  total_cost_usd: number;
  avg_latency_ms: number;
  case_count: number;
  incidents: IncidentFlag[];
}

export interface FleetData {
  generated_at: string;
  agents: Record<string, AgentSummary>;
}

export interface CaseDetail {
  case_id: string;
  input_payload: string;
  claim: string;
  evidence_cited: string[];
  confidence: number;
  groundedness_score: number;
  is_ungrounded: boolean;
  is_correct: boolean | null;
  cost_usd: number;
  latency_ms: number;
  model: string;
  timestamp: string;
  duplicate_of: string | null;
  ground_truth: string | null;
}

export interface AgentDetail {
  agent_id: string;
  status: "ACTIVE" | "PAUSED";
  health_label: "NOMINAL" | "CAUTION" | "CRITICAL";
  composite_score: number;
  avg_groundedness: number;
  avg_consistency: number;
  calibration: CalibrationData;
  consistency_pairs: ConsistencyPair[];
  cases: CaseDetail[];
  incidents: IncidentFlag[];
}

export interface DriftData {
  drift_detected: boolean;
  drift_day: number | null;
  cusum_series: number[];
}

export interface AgentSimResult {
  daily_composite_scores: number[];
  drift: DriftData;
}

export type SimulationData = Record<string, AgentSimResult>;

export interface JudgeResult {
  verdict: "YES" | "NO" | "NO_CASES";
  reasoning: string;
  fallback: boolean;
  case_id?: string;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export const api = {
  getFleet: () => apiFetch<FleetData>("/api/fleet"),

  getAgent: (agentId: string) =>
    apiFetch<AgentDetail>(`/api/agents/${agentId}`),

  simulate: (days = 10) =>
    apiFetch<SimulationData>(`/api/simulate?days=${days}`, { method: "POST" }),

  getIncidents: (agentId?: string, flagType?: string) => {
    const params = new URLSearchParams();
    if (agentId) params.set("agent_id", agentId);
    if (flagType) params.set("flag_type", flagType);
    const qs = params.toString();
    return apiFetch<IncidentFlag[]>(`/api/incidents${qs ? "?" + qs : ""}`);
  },

  pauseAgent: (agentId: string) =>
    apiFetch<{ agent_id: string; status: "PAUSED" }>(
      `/api/agents/${agentId}/pause`,
      { method: "POST" }
    ),

  resumeAgent: (agentId: string) =>
    apiFetch<{ agent_id: string; status: "ACTIVE" }>(
      `/api/agents/${agentId}/resume`,
      { method: "POST" }
    ),

  judgeAgent: (agentId: string) =>
    apiFetch<JudgeResult>(`/api/agents/${agentId}/judge`, { method: "POST" }),
};
