import React, { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, AgentDetail as AgentDetailType, CaseDetail, JudgeResult } from "../api/client";

const AGENT_PERSONAS: Record<string, string> = {
  risk_review: "Reviews new merchant signups for fraud risk",
  incident_rca: "Investigates production incidents to find root cause",
  merchant_support: "Answers merchant questions about payments & settlements",
  dispute_response: "Decides whether to contest or accept chargebacks",
};

function Pill({ label, variant }: { label: string; variant: "ok" | "warn" | "bad" | "neutral" }) {
  const styles = {
    ok: "bg-teal-950/40 text-teal-300 border-teal-800/50",
    warn: "bg-amber-950/40 text-amber-300 border-amber-800/50",
    bad: "bg-red-950/40 text-red-400 border-red-800/50",
    neutral: "bg-neutral-900 text-neutral-400 border-neutral-800",
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono border ${styles[variant]}`}>
      {label}
    </span>
  );
}

function CaseRow({ c, onJudge }: { c: CaseDetail; onJudge: (caseId: string) => Promise<JudgeResult> }) {
  const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null);
  const [judging, setJudging] = useState(false);

  const isFlagged = c.is_ungrounded || c.is_correct === false;

  async function handleJudge() {
    setJudging(true);
    try {
      const r = await onJudge(c.case_id);
      setJudgeResult(r);
    } catch {
      setJudgeResult({ verdict: "NO", reasoning: "Judge check failed.", fallback: true });
    } finally {
      setJudging(false);
    }
  }

  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-3 transition-colors ${
        isFlagged
          ? "border-amber-900/40 bg-amber-950/15"
          : "border-[#1F1F23] bg-[#09090C]"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-neutral-500">{c.case_id}</span>
          {c.is_ungrounded && <Pill label="UNGROUNDED" variant="warn" />}
          {c.is_correct === false && <Pill label="WRONG" variant="bad" />}
          {c.is_correct === true && <Pill label="CORRECT" variant="ok" />}
          {c.duplicate_of && (
            <Pill label={`dup of ${c.duplicate_of}`} variant="neutral" />
          )}
        </div>
        <div className="flex items-center gap-3 font-mono text-xs text-neutral-500">
          <span>conf {(c.confidence * 100).toFixed(0)}%</span>
          <span>gnd {(c.groundedness_score * 100).toFixed(0)}%</span>
          <span>{c.latency_ms.toFixed(0)}ms</span>
        </div>
      </div>

      {/* Input */}
      <div>
        <div className="text-[10px] text-neutral-500 font-mono mb-1">INPUT</div>
        <p className="text-xs text-neutral-400 leading-relaxed">{c.input_payload}</p>
      </div>

      {/* Claim */}
      <div>
        <div className="text-[10px] text-neutral-500 font-mono mb-1">CLAIM</div>
        <p className="text-sm text-neutral-200 leading-relaxed">{c.claim}</p>
      </div>

      {/* Evidence */}
      {c.evidence_cited.length > 0 && (
        <div>
          <div className="text-[10px] text-neutral-500 font-mono mb-1">
            EVIDENCE CITED ({c.evidence_cited.length})
          </div>
          <ul className="space-y-1">
            {c.evidence_cited.map((ev, i) => (
              <li key={i} className="text-xs text-neutral-400 flex gap-2">
                <span className="text-teal-500 shrink-0">›</span>
                {ev}
              </li>
            ))}
          </ul>
        </div>
      )}
      {c.evidence_cited.length === 0 && (
        <div className="text-xs text-amber-400 font-mono">⚠ No evidence cited</div>
      )}

      {/* Ground truth */}
      {c.ground_truth && (
        <div>
          <div className="text-[10px] text-neutral-500 font-mono mb-1">GROUND TRUTH</div>
          <p className="text-xs text-neutral-500 italic">{c.ground_truth}</p>
        </div>
      )}

      {/* Judge */}
      {isFlagged && (
        <div className="border-t border-[#1F1F23] pt-3 flex flex-col gap-2">
          <button
            id={`judge-btn-${c.case_id}`}
            onClick={handleJudge}
            disabled={judging}
            className="self-start px-3 py-1.5 rounded text-xs font-semibold bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 border border-purple-800/60 transition-all duration-200 disabled:opacity-50"
          >
            {judging ? "Checking…" : "⚖ Run Judge Check"}
          </button>
          {judgeResult && (
            <div className="bg-[#000000] rounded p-3 text-xs font-mono border border-[#1F1F23]">
              <span
                className={`font-bold mr-2 ${
                  judgeResult.verdict === "YES" ? "text-teal-400" : "text-red-400"
                }`}
              >
                {judgeResult.verdict}
              </span>
              <span className="text-neutral-300">{judgeResult.reasoning}</span>
              {judgeResult.fallback && (
                <span className="text-neutral-500 ml-2">[heuristic fallback]</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AgentDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const d = await api.getAgent(id);
      setData(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleJudge(caseId: string): Promise<JudgeResult> {
    return api.judgeAgent(id!);
  }

  const statusColor =
    data?.health_label === "NOMINAL"
      ? "text-teal-400"
      : data?.health_label === "CAUTION"
      ? "text-amber-400"
      : "text-red-400";

  return (
    <div className="min-h-screen bg-[#000000] text-[#F4F4F5]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#000000]/95 backdrop-blur border-b border-[#1F1F23]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <Link to="/" className="text-neutral-500 hover:text-amber-400 text-xs transition-colors font-mono">
            Home
          </Link>
          <span className="text-neutral-700 font-mono text-xs">/</span>
          <Link to="/dashboard" className="text-neutral-400 hover:text-neutral-200 text-xs transition-colors font-mono font-semibold">
            Dashboard
          </Link>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h1 className="font-display font-bold text-[#F4F4F5] text-base truncate">

              {id?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </h1>
            {data && (
              <span
                className={`text-xs font-mono font-semibold px-2 py-0.5 rounded border ${
                  data.health_label === "NOMINAL"
                    ? "bg-teal-950/40 text-teal-300 border-teal-800/50"
                    : data.health_label === "CAUTION"
                    ? "bg-amber-950/40 text-amber-300 border-amber-800/50"
                    : "bg-red-950/40 text-red-400 border-red-800/50"
                }`}
              >
                {data.health_label}
              </span>
            )}
            {data?.status === "PAUSED" && (
              <span className="text-xs font-mono bg-neutral-900 text-neutral-400 px-2 py-0.5 rounded border border-neutral-800">
                PAUSED
              </span>
            )}
          </div>
          {data && (
            <span className={`font-mono font-bold text-xl ${statusColor}`}>
              {(data.composite_score * 100).toFixed(0)}
              <span className="text-xs text-neutral-500 font-normal"> / 100</span>
            </span>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {loading && (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-neutral-900/50 rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="text-red-400 font-mono text-sm p-4 bg-red-950/30 rounded-lg border border-red-900/50">
            ⚠ {error}
          </div>
        )}

        {data && !loading && (
          <div className="flex flex-col gap-6">
            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Avg Groundedness", value: `${(data.avg_groundedness * 100).toFixed(1)}%` },
                { label: "Avg Consistency", value: `${(data.avg_consistency * 100).toFixed(1)}%` },
                { label: "Brier Score", value: data.calibration.brier_score.toFixed(3) },
                { label: "ECE", value: data.calibration.expected_calibration_error.toFixed(3) },
              ].map((s) => (
                <div key={s.label} className="bg-[#09090C] border border-[#1F1F23] rounded-xl p-3">
                  <div className="text-[10px] text-neutral-500 font-mono mb-1">{s.label}</div>
                  <div className="text-lg font-mono font-bold text-[#F4F4F5]">{s.value}</div>
                </div>
              ))}
            </div>

            {/* Consistency pairs */}
            {data.consistency_pairs.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-neutral-400 mb-3 font-display">
                  Consistency Pairs
                </h2>
                <div className="flex flex-col gap-2">
                  {data.consistency_pairs.map((pair, i) => (
                    <div
                      key={i}
                      className={`rounded-xl border p-3 text-xs font-mono ${
                        pair.flagged
                          ? "border-amber-900/40 bg-amber-950/15"
                          : "border-[#1F1F23] bg-[#09090C]"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-neutral-500">{pair.case_id_a}</span>
                        <span className="text-neutral-600">vs</span>
                        <span className="text-neutral-500">{pair.case_id_b}</span>
                        <span
                          className={`ml-auto px-2 py-0.5 rounded border text-[10px] ${
                            pair.flagged
                              ? "text-amber-300 border-amber-800/50 bg-amber-950/40"
                              : "text-teal-300 border-teal-800/50 bg-teal-950/40"
                          }`}
                        >
                          {pair.flagged ? "⚡ INCONSISTENT" : "✓ CONSISTENT"} — {(pair.score * 100).toFixed(0)}%
                        </span>
                      </div>
                      {pair.claim_a && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <div className="text-[9px] text-neutral-500 mb-1">ORIGINAL</div>
                            <p className="text-neutral-400 text-[11px] leading-relaxed">{pair.claim_a}</p>
                          </div>
                          <div>
                            <div className="text-[9px] text-neutral-500 mb-1">DUPLICATE</div>
                            <p className="text-neutral-400 text-[11px] leading-relaxed">{pair.claim_b}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Case list */}
            <div>
              <h2 className="text-sm font-semibold text-neutral-400 mb-3 font-display">
                All Cases ({data.cases.length})
              </h2>
              <div className="flex flex-col gap-3">
                {data.cases.map((c) => (
                  <CaseRow key={c.case_id} c={c} onJudge={handleJudge} />
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
