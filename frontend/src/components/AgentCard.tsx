import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkline } from "./Sparkline";
import { api, AgentSummary, AgentSimResult } from "../api/client";

const AGENT_PERSONAS: Record<string, string> = {
  risk_review: "Reviews new merchant signups for fraud risk",
  incident_rca: "Investigates production incidents to find root cause",
  merchant_support: "Answers merchant questions about payments & settlements",
  dispute_response: "Decides whether to contest or accept chargebacks",
};

const FLAG_LABELS: Record<string, string> = {
  ungrounded: "Ungrounded Claim",
  inconsistent: "Inconsistent Pair",
  drift_detected: "Drift Detected",
  manual_pause: "Manual Pause",
  auto_paused: "Auto-Paused",
};

const FLAG_COLORS: Record<string, string> = {
  ungrounded: "text-[#e05c00]",
  inconsistent: "text-[#ff8800]",
  drift_detected: "text-red-400",
  manual_pause: "text-[#666]",
  auto_paused: "text-red-400",
};

function ScorePill({ label }: { label: "NOMINAL" | "CAUTION" | "CRITICAL" }) {
  const styles: Record<string, string> = {
    NOMINAL: "bg-[#1a0d00] text-[#e05c00] border border-[#3a1a00]",
    CAUTION: "bg-[#1a0d00] text-[#ff8800] border border-[#3a1a00]",
    CRITICAL: "bg-red-950/40 text-red-400 border border-red-900/60 animate-pulse",
  };
  return (
    <span
      className={`px-2.5 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase tracking-wider ${styles[label]}`}
    >
      {label}
    </span>
  );
}

function MetricBar({
  label,
  value,
  max = 1,
  inverse = false,
}: {
  label: string;
  value: number;
  max?: number;
  inverse?: boolean;
}) {
  const pct = Math.min(1, Math.max(0, inverse ? 1 - value / max : value / max));
  const color =
    pct >= 0.7 ? "bg-[#e05c00]" : pct >= 0.4 ? "bg-[#ff8800]" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-[#888] w-24 shrink-0 font-mono text-[11px]">{label}</span>
      <div className="flex-1 h-1.5 bg-[#111] border border-[#222] overflow-hidden">
        <div
          className={`h-full transition-all duration-700 ${color}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <span className="font-mono text-[#ccc] w-10 text-right text-[11px] font-semibold">
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

interface AgentCardProps {
  agentId: string;
  data: AgentSummary;
  simResult?: AgentSimResult;
  simVisibleDays?: number;
  onPauseResume?: () => void;
}

export function AgentCard({
  agentId,
  data,
  simResult,
  simVisibleDays,
  onPauseResume,
}: AgentCardProps) {
  const [loading, setLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState(data.status);
  const [judgeResult, setJudgeResult] = useState<string | null>(null);
  const [judging, setJudging] = useState(false);

  const isPaused = localStatus === "PAUSED";
  const healthLabel = data.health_label;

  const scoreColor =
    healthLabel === "NOMINAL"
      ? "text-[#e05c00]"
      : healthLabel === "CAUTION"
      ? "text-[#ff8800]"
      : "text-red-400";

  const sparklineScores = simResult
    ? simResult.daily_composite_scores
    : [data.composite_score];
  const sparklineDrift = simResult?.drift?.drift_day ?? null;
  const sparklineVisible =
    simVisibleDays !== undefined && simResult
      ? simVisibleDays
      : undefined;

  const hasDrift = simResult?.drift?.drift_detected ?? false;

  async function handlePauseResume() {
    setLoading(true);
    try {
      if (isPaused) {
        await api.resumeAgent(agentId);
        setLocalStatus("ACTIVE");
      } else {
        await api.pauseAgent(agentId);
        setLocalStatus("PAUSED");
      }
      onPauseResume?.();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleJudge() {
    setJudging(true);
    setJudgeResult(null);
    try {
      const result = await api.judgeAgent(agentId);
      setJudgeResult(
        `${result.verdict}: ${result.reasoning}${result.fallback ? " [heuristic]" : ""}`
      );
    } catch (e) {
      setJudgeResult("Judge check failed.");
    } finally {
      setJudging(false);
    }
  }

  return (
    <article
      className={`border transition-all duration-300 ${
        isPaused
          ? "border-[#1c1c1c] bg-[#050505] opacity-70"
          : healthLabel === "CRITICAL"
          ? "border-red-900/50 bg-[#09090C] shadow-[0_0_25px_rgba(239,68,68,0.06)]"
          : healthLabel === "CAUTION"
          ? "border-[#3a1a00] bg-[#080808]"
          : "border-[#1c1c1c] bg-[#070707]"
      }`}
    >
      <div className="p-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="font-mono font-bold text-white text-base leading-tight truncate">
                {agentId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </h2>
              <ScorePill label={healthLabel} />
              {data.has_live_corrections ? (
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-950/50 text-emerald-400 border border-emerald-800/60 uppercase tracking-wider">
                  LIVE DATA
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-mono bg-[#111] text-[#555] border border-[#222] uppercase tracking-wider">
                  SIMULATED
                </span>
              )}
              {isPaused && (
                <span className="px-2 py-0.5 text-[10px] font-mono bg-[#111] text-[#888] border border-[#222]">
                  PAUSED
                </span>
              )}
            </div>
            <p className="text-xs text-[#666] font-mono truncate">
              {AGENT_PERSONAS[agentId] || agentId}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-3xl font-mono font-black ${scoreColor}`}>
              {(data.composite_score * 100).toFixed(0)}
            </div>
            <div className="text-[10px] text-[#555] font-mono">/ 100</div>
          </div>
        </div>

        {/* Metric bars */}
        <div className="flex flex-col gap-2.5">
          <MetricBar label="Groundedness" value={data.avg_groundedness} />
          <MetricBar label="Consistency" value={data.avg_consistency} />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#888] w-24 shrink-0 font-mono text-[11px]">Calibration</span>
            <span className="font-mono text-[#888] text-[11px]">
              Brier <span className="text-white font-semibold">{data.calibration.brier_score.toFixed(3)}</span> · ECE <span className="text-white font-semibold">{data.calibration.expected_calibration_error.toFixed(3)}</span>
            </span>
          </div>
        </div>

        {/* Sparkline */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#666] font-mono uppercase tracking-wider">
              Health trend
            </span>
            {hasDrift && (
              <span className="text-[10px] font-mono text-red-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block animate-pulse" />
                drift @ day {simResult?.drift?.drift_day}
              </span>
            )}
          </div>
          <Sparkline
            scores={sparklineScores}
            driftDay={sparklineDrift}
            width={280}
            height={52}
            visibleDays={sparklineVisible}
          />
        </div>

        {/* Stats row */}
        <div className="flex gap-3 text-[11px] font-mono text-[#666] border-t border-[#1c1c1c] pt-3">
          <span>
            <span className="text-white font-semibold">{data.case_count}</span> cases
          </span>
          <span>·</span>
          <span>
            <span className="text-white font-semibold">${(data.total_cost_usd * 1000).toFixed(2)}</span>
            <span className="text-[#444]">m</span>
          </span>
          <span>·</span>
          <span>
            <span className="text-white font-semibold">{data.avg_latency_ms.toFixed(0)}</span> ms
          </span>
          {data.ungrounded_flags > 0 && (
            <>
              <span>·</span>
              <span className="text-[#e05c00] font-semibold">
                {data.ungrounded_flags} ungrounded
              </span>
            </>
          )}
        </div>

        {/* Incidents */}
        {data.incidents.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-[#1c1c1c] pt-3">
            <span className="text-[10px] text-[#666] font-mono uppercase tracking-wider mb-1">
              Flags this run
            </span>
            {data.incidents.slice(0, 3).map((inc, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px] font-mono">
                <span className={`shrink-0 ${FLAG_COLORS[inc.flag_type] || "text-[#666]"}`}>■</span>
                <span className="text-[#888] leading-tight">
                  <span className={FLAG_COLORS[inc.flag_type] || "text-[#666]"}>
                    {FLAG_LABELS[inc.flag_type] || inc.flag_type}
                  </span>{" "}
                  — {inc.detail.slice(0, 80)}
                  {inc.detail.length > 80 ? "…" : ""}
                </span>
              </div>
            ))}
          </div>
        )}

        {data.incidents.length === 0 && (
          <div className="text-[11px] text-[#e05c00] font-mono border-t border-[#1c1c1c] pt-3">
            ✓ No flags this run
          </div>
        )}

        {/* Judge result */}
        {judgeResult && (
          <div className="text-[11px] font-mono bg-[#000000] p-3 border border-[#1c1c1c] text-[#ccc] leading-relaxed">
            <span className="text-[#e05c00] font-semibold">Judge: </span>
            {judgeResult}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 border-t border-[#1c1c1c] pt-3">
          <button
            id={`${agentId}-pause-btn`}
            onClick={handlePauseResume}
            disabled={loading}
            className={`flex-1 py-2 px-3 text-xs font-mono font-semibold uppercase tracking-wider transition-all disabled:opacity-50 ${
              isPaused
                ? "bg-[#1a0d00] text-[#e05c00] border border-[#3a1a00] hover:bg-[#e05c00] hover:text-black"
                : "bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-900/60"
            }`}
          >
            {loading ? "…" : isPaused ? "▶ Resume" : "⏸ Pause"}
          </button>
          <button
            id={`${agentId}-judge-btn`}
            onClick={handleJudge}
            disabled={judging}
            className="flex-1 py-2 px-3 text-xs font-mono font-semibold bg-[#0a0a0a] hover:bg-white text-white hover:text-black border border-[#2a2a2a] transition-all uppercase tracking-wider disabled:opacity-50"
          >
            {judging ? "Checking…" : "⚖ Judge"}
          </button>
          <Link
            to={`/agents/${agentId}`}
            className="py-2 px-4 text-xs font-mono font-semibold bg-[#0a0a0a] hover:bg-white text-white hover:text-black border border-[#2a2a2a] transition-all uppercase tracking-wider text-center"
          >
            Detail →
          </Link>
        </div>
      </div>
    </article>
  );
}

export function AgentCardSkeleton() {
  return (
    <article className="border border-[#1c1c1c] bg-[#070707] p-6 flex flex-col gap-4 animate-pulse">
      <div className="flex justify-between">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-[#111] rounded w-32" />
          <div className="h-3 bg-[#111] rounded w-48" />
        </div>
        <div className="h-10 w-12 bg-[#111] rounded" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-2 items-center">
            <div className="h-3 bg-[#111] rounded w-24" />
            <div className="flex-1 h-1.5 bg-[#111] rounded" />
            <div className="h-3 bg-[#111] rounded w-10" />
          </div>
        ))}
      </div>
    </article>
  );
}
