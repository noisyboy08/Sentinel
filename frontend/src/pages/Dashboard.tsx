import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, FleetData, SimulationData } from "../api/client";
import { AgentCard, AgentCardSkeleton } from "../components/AgentCard";
import { IncidentFeed } from "../components/IncidentFeed";
import { SentinelLogo } from "../components/SentinelLogo";

const PREFERRED_ORDER = [
  "risk_review",
  "incident_rca",
  "merchant_support",
  "dispute_response",
  "onboarding_kyc",
  "fraud_alert",
  "settlement_query",
  "compliance_check",
];

const SIM_DAYS = 10;
const SIM_FRAME_MS = 600;

export default function Dashboard() {
  const [fleet, setFleet] = useState<FleetData | null>(null);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [fleetError, setFleetError] = useState<string | null>(null);

  const [simData, setSimData] = useState<SimulationData | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simVisible, setSimVisible] = useState<number | undefined>(undefined);
  const [simRunning, setSimRunning] = useState(false);
  const simTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [tab, setTab] = useState<"agents" | "incidents">("agents");
  const [incidents, setIncidents] = useState<any[]>([]);
  const [incLoading, setIncLoading] = useState(false);

  // Ingest modal
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);
  const [ingestSending, setIngestSending] = useState(false);

  // Register Agent Modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regId, setRegId] = useState("");
  const [regPersona, setRegPersona] = useState("");
  const [regModel, setRegModel] = useState("claude-3-5-sonnet");
  const [regStatus, setRegStatus] = useState<string | null>(null);
  const [regSending, setRegSending] = useState(false);

  async function handleTestIngest() {
    setIngestSending(true);
    setIngestStatus(null);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "production_risk_agent",
          case_id: "live_case_" + Math.floor(Math.random() * 1000),
          claim: "Live merchant signup flagged as high risk due to missing regulatory license.",
          evidence_cited: ["FSSAI license registration missing from food business application."],
          confidence: 0.94,
          cost_usd: 0.0018,
          latency_ms: 210.0,
          model: "claude-3-5-sonnet",
        }),
      });
      const data = await res.json();
      setIngestStatus(`Success! Groundedness: ${(data.eval.groundedness_score * 100).toFixed(0)}%, Circuit Breaker: ${data.eval.circuit_breaker_status}`);
      runEvaluation();
      loadIncidents();
    } catch (e: any) {
      setIngestStatus(`Failed: ${e.message}`);
    } finally {
      setIngestSending(false);
    }
  }

  async function handleRegisterAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!regId.trim()) return;
    setRegSending(true);
    setRegStatus(null);
    try {
      const res = await fetch("/api/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: regId.trim().toLowerCase().replace(/\s+/g, "_"),
          persona: regPersona || `Custom AI agent for ${regId}`,
          model_name: regModel,
        }),
      });
      const data = await res.json();
      setRegStatus(`Registered ${data.agent_id} successfully! Total fleet size: ${data.total_agents}`);
      setRegId("");
      setRegPersona("");
      runEvaluation();
    } catch (err: any) {
      setRegStatus(`Failed: ${err.message}`);
    } finally {
      setRegSending(false);
    }
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const runEvaluation = useCallback(async () => {
    setFleetLoading(true);
    setFleetError(null);
    try {
      const data = await api.getFleet();
      setFleet(data);
    } catch (e: any) {
      setFleetError(e.message || "Failed to reach backend");
    } finally {
      setFleetLoading(false);
    }
  }, []);

  const loadIncidents = useCallback(async () => {
    setIncLoading(true);
    try {
      const data = await api.getIncidents();
      setIncidents(data);
    } catch {
      setIncidents([]);
    } finally {
      setIncLoading(false);
    }
  }, []);

  useEffect(() => {
    runEvaluation();
    loadIncidents();
  }, []);

  const runSimulation = useCallback(async () => {
    if (simRunning || simLoading) return;
    setSimLoading(true);
    setSimData(null);
    setSimVisible(undefined);
    try {
      const data = await api.simulate(SIM_DAYS);
      setSimData(data);
      setSimLoading(false);

      if (prefersReducedMotion) {
        setSimVisible(SIM_DAYS);
        return;
      }

      setSimRunning(true);
      setSimVisible(1);
      let day = 1;
      function tick() {
        day++;
        setSimVisible(day);
        if (day < SIM_DAYS) {
          simTimerRef.current = setTimeout(tick, SIM_FRAME_MS);
        } else {
          setSimRunning(false);
          setTimeout(() => runEvaluation(), 500);
          setTimeout(() => loadIncidents(), 600);
        }
      }
      simTimerRef.current = setTimeout(tick, SIM_FRAME_MS);
    } catch (e: any) {
      setFleetError(e.message || "Simulation failed");
      setSimLoading(false);
    }
  }, [simRunning, simLoading, prefersReducedMotion, runEvaluation, loadIncidents]);

  useEffect(
    () => () => {
      if (simTimerRef.current) clearTimeout(simTimerRef.current);
    },
    []
  );

  // Compute full agent list dynamically (preferred order first, then any custom ones)
  const agentList = React.useMemo(() => {
    if (!fleet) return [];
    const knownKeys = new Set(PREFERRED_ORDER);
    const ordered = PREFERRED_ORDER.filter((id) => fleet.agents[id]);
    const extra = Object.keys(fleet.agents).filter((id) => !knownKeys.has(id));
    return [...ordered, ...extra].map((id) => ({
      id,
      data: fleet.agents[id],
    }));
  }, [fleet]);

  const totalAgents = agentList.length;
  const driftingCount = simData
    ? Object.values(simData).filter((s) => s.drift.drift_detected).length
    : 0;
  const openFlags = agentList.reduce(
    (acc, a) => acc + (a.data.incidents?.length || 0),
    0
  );
  const pausedCount = agentList.filter((a) => a.data.status === "PAUSED").length;

  return (
    <div className="min-h-screen bg-[#000000] text-[#F4F4F5] font-sans">
      {/* Masthead */}
      <header className="sticky top-0 z-10 bg-[#000000]/95 backdrop-blur border-b border-[#1c1c1c]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Logo + Go Back to Website button */}
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="inline-flex items-center gap-2 border border-[#3a1a00] bg-[#1a0d00] text-[#e05c00] hover:bg-[#e05c00] hover:text-black text-[11px] font-mono uppercase tracking-widest px-3 py-1.5 transition-all font-semibold"
              >
                ← Back to Website
              </Link>
              <span className="text-[#2a2a2a] text-lg font-light">/</span>
              <Link to="/" className="flex items-center gap-2.5 group">
                <SentinelLogo size={32} />
                <div>
                  <h1 className="font-mono font-black text-white text-base leading-none group-hover:text-[#e05c00] transition-colors uppercase tracking-tight">
                    Sentinel AI
                  </h1>
                  <p className="text-[10px] text-[#555] font-mono mt-0.5">
                    Agent Fleet Reliability Engine
                  </p>
                </div>
              </Link>
            </div>

            {/* Fleet stats */}
            <div className="hidden lg:flex items-center gap-5 text-xs font-mono">
              <Stat label="Fleet Size" value={totalAgents} color="text-white" />
              <Stat label="Drifting" value={driftingCount} color={driftingCount > 0 ? "text-red-400" : "text-[#e05c00]"} />
              <Stat label="Open flags" value={openFlags} color={openFlags > 0 ? "text-[#e05c00]" : "text-[#888]"} />
              <Stat label="Paused" value={pausedCount} color={pausedCount > 0 ? "text-red-400" : "text-[#888]"} />
              {fleet && (
                <span className="text-[#444]">
                  {new Date(fleet.generated_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </span>
              )}
            </div>

            {/* Global controls — 4 UNIFORM ACTION BUTTONS (equal height h-9, identical styling & sizing) */}
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto pt-2 sm:pt-0">
              <button
                onClick={() => setShowRegisterModal(true)}
                className="h-9 px-3 text-[11px] sm:text-xs font-mono font-semibold bg-[#111111] hover:bg-[#e05c00] text-[#e05c00] hover:text-black border border-[#2a2a2a] hover:border-[#e05c00] transition-all duration-150 flex items-center justify-center gap-1.5 rounded-sm shrink-0 whitespace-nowrap"
              >
                <span>+ Register Agent</span>
              </button>
              <button
                id="realworld-ingest-btn"
                onClick={() => setShowIngestModal(true)}
                className="h-9 px-3 text-[11px] sm:text-xs font-mono font-semibold bg-[#111111] hover:bg-[#e05c00] text-[#e05c00] hover:text-black border border-[#2a2a2a] hover:border-[#e05c00] transition-all duration-150 flex items-center justify-center gap-1.5 rounded-sm shrink-0 whitespace-nowrap"
              >
                <span>⚡ Live Ingest API</span>
              </button>
              <button
                id="run-evaluation-btn"
                onClick={runEvaluation}
                disabled={fleetLoading}
                className="h-9 px-3 text-[11px] sm:text-xs font-mono font-semibold bg-[#111111] hover:bg-[#e05c00] text-[#e05c00] hover:text-black border border-[#2a2a2a] hover:border-[#e05c00] transition-all duration-150 flex items-center justify-center gap-1.5 rounded-sm shrink-0 whitespace-nowrap disabled:opacity-50"
              >
                {fleetLoading ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#e05c00] animate-ping inline-block" />
                    Evaluating…
                  </span>
                ) : (
                  <span>▶ Run Evaluation</span>
                )}
              </button>
              <button
                id="simulate-btn"
                onClick={runSimulation}
                disabled={simLoading || simRunning}
                className="h-9 px-3 text-[11px] sm:text-xs font-mono font-semibold bg-[#111111] hover:bg-[#e05c00] text-[#e05c00] hover:text-black border border-[#2a2a2a] hover:border-[#e05c00] transition-all duration-150 flex items-center justify-center gap-1.5 rounded-sm shrink-0 whitespace-nowrap disabled:opacity-50"
              >
                {simLoading ? (
                  <span>Simulating…</span>
                ) : simRunning ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#e05c00] animate-pulse inline-block" />
                    Day {simVisible}/{SIM_DAYS}
                  </span>
                ) : (
                  <span>⏩ Simulate 10 Days</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {fleetError && (
        <div className="bg-red-950/40 border-b border-red-900/50 px-6 py-3 text-sm text-red-300 font-mono flex items-center gap-2">
          <span>⚠</span>
          <span>{fleetError}</span>
          <span className="text-red-400 text-xs">— is backend running on port 8000?</span>
        </div>
      )}

      {/* Simulation progress bar */}
      {(simLoading || simRunning) && (
        <div className="h-0.5 bg-[#1c1c1c]">
          <div
            className="h-full bg-[#e05c00] transition-all duration-500"
            style={{
              width: simLoading
                ? "20%"
                : `${((simVisible || 0) / SIM_DAYS) * 100}%`,
            }}
          />
        </div>
      )}

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-[#1c1c1c]">
          <button
            onClick={() => setTab("agents")}
            className={`px-5 py-2.5 text-xs font-mono uppercase tracking-widest transition-colors font-semibold ${
              tab === "agents"
                ? "text-[#e05c00] border-b-2 border-[#e05c00] bg-[#1a0d00]/30"
                : "text-[#555] hover:text-white"
            }`}
          >
            Agent Fleet ({totalAgents})
          </button>
          <button
            onClick={() => { setTab("incidents"); loadIncidents(); }}
            className={`px-5 py-2.5 text-xs font-mono uppercase tracking-widest transition-colors flex items-center gap-2 font-semibold ${
              tab === "incidents"
                ? "text-[#e05c00] border-b-2 border-[#e05c00] bg-[#1a0d00]/30"
                : "text-[#555] hover:text-white"
            }`}
          >
            Incident Feed
            {openFlags > 0 && (
              <span className="px-1.5 py-0.5 bg-[#e05c00] text-black text-[10px] font-mono font-bold">
                {openFlags}
              </span>
            )}
          </button>
        </div>

        {tab === "agents" && (
          <>
            {/* Simulation context banner */}
            {simData && simVisible !== undefined && (
              <div className="mb-6 p-4 bg-[#1a0d00] border border-[#3a1a00] text-xs font-mono text-[#e05c00] flex items-center gap-3">
                <span>⏩</span>
                <span>
                  Showing simulation day {Math.min(simVisible, SIM_DAYS)} / {SIM_DAYS} —
                  watch sparklines fill in. risk_review &amp; fraud_alert show drift around day 5.
                </span>
              </div>
            )}

            {/* Agent grid — 8 agents in 2/4 column layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {fleetLoading && !fleet
                ? Array.from({ length: 8 }).map((_, i) => <AgentCardSkeleton key={i} />)
                : agentList.map(({ id, data }) => (
                    <AgentCard
                      key={id}
                      agentId={id}
                      data={data}
                      simResult={simData?.[id]}
                      simVisibleDays={simData ? simVisible : undefined}
                      onPauseResume={runEvaluation}
                    />
                  ))}
            </div>

            {fleet && agentList.length === 0 && (
              <div className="text-center py-20 text-[#555] font-mono text-xs">
                No agents returned. Check backend connection.
              </div>
            )}
          </>
        )}

        {tab === "incidents" && (
          <IncidentFeed incidents={incidents} loading={incLoading} />
        )}
      </main>

      {/* REGISTER NEW AGENT MODAL */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-[#262626] p-6 max-w-md w-full font-mono text-xs space-y-4 rounded-sm shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#1c1c1c] pb-3">
              <span className="font-bold text-white uppercase text-sm">Register New AI Agent</span>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-[#666] hover:text-white text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterAgent} className="space-y-4">
              <div>
                <label className="block text-[#888] mb-1">Agent ID (e.g. payout_reconciliation)</label>
                <input
                  type="text"
                  required
                  value={regId}
                  onChange={(e) => setRegId(e.target.value)}
                  placeholder="payout_reconciliation"
                  className="w-full bg-[#000] border border-[#222] p-2.5 text-white text-xs font-mono focus:border-[#e05c00] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#888] mb-1">Persona Prompt</label>
                <textarea
                  rows={3}
                  value={regPersona}
                  onChange={(e) => setRegPersona(e.target.value)}
                  placeholder="You are a payout reconciliation agent checking bank statement logs..."
                  className="w-full bg-[#000] border border-[#222] p-2.5 text-white text-xs font-mono focus:border-[#e05c00] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#888] mb-1">Base Model</label>
                <select
                  value={regModel}
                  onChange={(e) => setRegModel(e.target.value)}
                  className="w-full bg-[#000] border border-[#222] p-2.5 text-white text-xs font-mono focus:border-[#e05c00] outline-none"
                >
                  <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gemini-1-5-pro">Gemini 1.5 Pro</option>
                </select>
              </div>

              {regStatus && (
                <div className={`p-3 border text-xs ${regStatus.startsWith("Success") || regStatus.startsWith("Registered") ? "bg-[#1a0d00] border-[#3a1a00] text-[#e05c00]" : "bg-red-950/40 border-red-900/60 text-red-300"}`}>
                  {regStatus}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={regSending}
                  className="flex-1 bg-[#e05c00] text-black font-bold uppercase tracking-widest py-2.5 hover:bg-[#ff7722] transition-colors"
                >
                  {regSending ? "Registering..." : "Register Agent"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 border border-[#222] text-[#888] hover:text-white"
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIVE INGEST MODAL */}
      {showIngestModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-[#262626] p-6 max-w-md w-full font-mono text-xs space-y-4 rounded-sm shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#1c1c1c] pb-3">
              <span className="font-bold text-white uppercase text-sm">⚡ Live Ingest Production Payload</span>
              <button
                onClick={() => setShowIngestModal(false)}
                className="text-[#666] hover:text-white text-base"
              >
                ✕
              </button>
            </div>

            <p className="text-[#888]">
              Simulate sending a real-time output payload from an external agent to <code className="text-[#e05c00]">POST /api/ingest</code>:
            </p>

            <pre className="bg-[#000] border border-[#1c1c1c] p-3 text-[11px] text-[#aaa] overflow-x-auto">
{`POST /api/ingest
{
  "agent_id": "production_risk_agent",
  "claim": "Merchant flagged as high risk...",
  "evidence_cited": ["FSSAI missing..."],
  "confidence": 0.94
}`}
            </pre>

            {ingestStatus && (
              <div className="p-3 bg-[#1a0d00] border border-[#3a1a00] text-[#e05c00] text-xs">
                {ingestStatus}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleTestIngest}
                disabled={ingestSending}
                className="flex-1 bg-[#e05c00] text-black font-bold uppercase tracking-widest py-2.5 hover:bg-[#ff7722] transition-colors"
              >
                {ingestSending ? "Sending..." : "Send Production Payload"}
              </button>
              <button
                onClick={() => setShowIngestModal(false)}
                className="px-4 border border-[#222] text-[#888] hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color = "text-white",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-base font-bold font-mono ${color}`}>{value}</span>
      <span className="text-[10px] text-[#555] uppercase">{label}</span>
    </div>
  );
}
