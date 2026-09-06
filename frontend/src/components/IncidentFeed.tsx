import React, { useState } from "react";
import { IncidentFlag } from "../api/client";

const FLAG_LABELS: Record<string, string> = {
  ungrounded: "🔥 Ungrounded Claim",
  inconsistent: "⚡ Inconsistent Pair",
  drift_detected: "📉 Drift Detected",
  manual_pause: "⏸ Manual Pause",
  auto_paused: "🔴 Auto-Paused",
  ground_truth_update: "ℹ️ Ground Truth Update",
};

const FLAG_PILL: Record<string, string> = {
  ungrounded: "bg-[#1a0d00] text-[#e05c00] border-[#3a1a00]",
  inconsistent: "bg-[#1a0d00] text-[#ff8800] border-[#3a1a00]",
  drift_detected: "bg-red-950/40 text-red-400 border-red-900/60",
  manual_pause: "bg-[#111] text-[#888] border-[#222]",
  auto_paused: "bg-red-950/40 text-red-400 border-red-900/60",
  ground_truth_update: "bg-blue-950/40 text-blue-400 border-blue-900/60",
};

const AGENT_NAMES: Record<string, string> = {
  risk_review: "Risk Review",
  incident_rca: "Incident RCA",
  merchant_support: "Merchant Support",
  dispute_response: "Dispute Response",
};

interface IncidentFeedProps {
  incidents: IncidentFlag[];
  loading?: boolean;
}

export function IncidentFeed({ incidents, loading }: IncidentFeedProps) {
  const [agentFilter, setAgentFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const agents = Array.from(new Set(incidents.map((i) => i.agent_id || ""))).filter(Boolean);
  const types = Array.from(new Set(incidents.map((i) => i.flag_type))).filter(Boolean);

  const filtered = incidents.filter((inc) => {
    const matchAgent = !agentFilter || inc.agent_id === agentFilter;
    const matchType = !typeFilter || inc.flag_type === typeFilter;
    return matchAgent && matchType;
  });

  function formatTime(ts: string) {
    try {
      const d = new Date(ts);
      return d.toLocaleString("en-IN", {
        day: "2-digit", month: "short",
        hour: "2-digit", minute: "2-digit",
        hour12: false,
      });
    } catch {
      return ts;
    }
  }

  return (
    <div className="flex flex-col gap-4 font-mono">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          id="incident-agent-filter"
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="bg-[#070707] border border-[#1c1c1c] px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#e05c00]"
        >
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a} value={a}>
              {AGENT_NAMES[a] || a}
            </option>
          ))}
        </select>
        <select
          id="incident-type-filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-[#070707] border border-[#1c1c1c] px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#e05c00]"
        >
          <option value="">All flag types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="text-xs font-mono text-[#666] self-center">
          {filtered.length} event{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* List */}
      {loading && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-[#0a0a0a] border border-[#1c1c1c] animate-pulse" />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-[#555] font-mono text-xs">
          <div className="text-3xl mb-2 text-[#e05c00]">✓</div>
          <div>No incidents match filters</div>
          <div className="text-[11px] mt-1 text-[#444]">
            Run an evaluation or simulate to populate the feed
          </div>
        </div>
      )}

      {!loading && (
        <div className="flex flex-col gap-2">
          {filtered.map((inc, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-4 bg-[#070707] border border-[#1c1c1c] hover:border-[#3a1a00] transition-colors"
            >
              <div className="shrink-0 mt-0.5">
                <span
                  className={`inline-block px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider border ${
                    FLAG_PILL[inc.flag_type] || "bg-[#111] text-[#888] border-[#222]"
                  }`}
                >
                  {FLAG_LABELS[inc.flag_type]?.split(" ").slice(1).join(" ") || inc.flag_type}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-bold text-white font-mono">
                    {AGENT_NAMES[inc.agent_id || ""] || inc.agent_id}
                  </span>
                  {inc.case_id && (
                    <span className="text-[10px] font-mono text-[#555]">
                      {inc.case_id}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#888] font-mono leading-relaxed truncate">
                  {inc.detail}
                </p>
              </div>
              <div className="text-[10px] font-mono text-[#555] shrink-0 whitespace-nowrap">
                {formatTime(inc.timestamp)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
