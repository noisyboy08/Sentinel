import React from "react";
import { useNavigate } from "react-router-dom";
import { HeaderNav } from "../components/HeaderNav";
import { FooterSection } from "../components/FooterSection";

export default function PricingPage() {
  const navigate = useNavigate();

  return (
    <div className="bg-[#000] text-white min-h-screen font-sans">
      <HeaderNav />

      {/* Hero */}
      <section className="px-7 md:px-12 py-20 border-b border-[#1c1c1c] max-w-5xl">
        <div className="inline-flex items-center gap-2 bg-[#1a0d00] border border-[#3a1a00] px-3 py-1.5 mb-8 font-mono">
          <span className="text-[#e05c00] text-[10px] tracking-widest">::::</span>
          <span className="text-[#e05c00] text-[10px] tracking-widest uppercase font-bold">PROJECT ROADMAP</span>
        </div>

        <h1 className="font-black text-white text-4xl md:text-6xl tracking-tight leading-tight mb-6">
          Implementation Scope &amp; Future Architecture
        </h1>
        <p className="text-[#888] text-sm md:text-base leading-relaxed max-w-3xl font-mono">
          An honest breakdown of what is built and runnable in this demo versus planned production extensions.
        </p>
      </section>

      {/* Roadmap 3-Card Grid */}
      <section className="px-7 md:px-12 py-16 border-b border-[#1c1c1c] font-mono">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl">
          {/* Card 1 */}
          <div className="border border-[#e05c00] bg-[#0d0700] p-8 flex flex-col justify-between">
            <div>
              <div className="text-[#e05c00] text-[10px] uppercase font-bold mb-2">PHASE 01 / SHIPPED</div>
              <h2 className="text-xl font-bold text-white mb-4">Runnable Demo Scope</h2>
              <ul className="space-y-3 text-xs text-[#aaa] mb-8">
                <li>✓ 4 Math Checks (Groundedness, Consistency, Calibration, CUSUM Drift)</li>
                <li>✓ Circuit Breaker Auto-Pause Engine</li>
                <li>✓ Slack Webhook Alert Dispatcher</li>
                <li>✓ Optional LLM-as-Judge Evaluator</li>
                <li>✓ Live POST /api/ingest REST Endpoint</li>
              </ul>
            </div>
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full bg-[#e05c00] text-black text-xs font-mono uppercase tracking-widest py-3.5 hover:bg-[#ff7722] transition-all text-center font-bold"
            >
              LAUNCH CONTROL TOWER →
            </button>
          </div>

          {/* Card 2 */}
          <div className="border border-[#1c1c1c] bg-[#070707] p-8 flex flex-col justify-between">
            <div>
              <div className="text-[#888] text-[10px] uppercase font-bold mb-2">PHASE 02 / NEXT STEPS</div>
              <h2 className="text-xl font-bold text-white mb-4">Production Extensions</h2>
              <ul className="space-y-3 text-xs text-[#888] mb-8">
                <li>• Embeddings-based grounding (replace TF-IDF with vector search)</li>
                <li>• Multi-agent handoff tracing across Agent Studio agents</li>
                <li>• Real-time Slack/PagerDuty incident escalation workflows</li>
                <li>• Claude Agent SDK native middleware hook</li>
              </ul>
            </div>
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full border border-[#2a2a2a] bg-[#080808] text-[#888] text-xs font-mono uppercase tracking-widest py-3.5 hover:border-white hover:text-white transition-all text-center font-bold"
            >
              VIEW DASHBOARD
            </button>
          </div>

          {/* Card 3 */}
          <div className="border border-[#1c1c1c] bg-[#070707] p-8 flex flex-col justify-between">
            <div>
              <div className="text-[#555] text-[10px] uppercase font-bold mb-2">OUT OF SCOPE</div>
              <h2 className="text-xl font-bold text-white mb-4">Non-Goals for Portfolio</h2>
              <ul className="space-y-3 text-xs text-[#666] mb-8">
                <li>× Auto-generating test cases from production errors</li>
                <li>× Company-wide plug-in SDK ecosystem</li>
                <li>× Persistent production-grade database cluster</li>
                <li>× Model training or fine-tuning pipelines</li>
              </ul>
            </div>
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full border border-[#2a2a2a] bg-[#080808] text-[#555] text-xs font-mono uppercase tracking-widest py-3.5 hover:border-white hover:text-white transition-all text-center font-bold"
            >
              EXPLORE CODE
            </button>
          </div>
        </div>
      </section>

      {/* Feature Matrix */}
      <section className="px-7 md:px-12 py-16 border-b border-[#1c1c1c] font-mono">
        <h2 className="text-2xl font-black text-white mb-8">Detailed Feature Status</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-[#1c1c1c]">
            <thead>
              <tr className="border-b border-[#1c1c1c] bg-[#070707] text-[#e05c00]">
                <th className="p-4 font-bold">Capability</th>
                <th className="p-4 font-bold">Implementation Detail</th>
                <th className="p-4 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c1c1c] text-[#888]">
              <tr>
                <td className="p-4 text-white font-semibold">Groundedness Score</td>
                <td className="p-4">TF-IDF Cosine Similarity between claim &amp; evidence</td>
                <td className="p-4 text-[#e05c00]">Shipped</td>
              </tr>
              <tr>
                <td className="p-4 text-white font-semibold">Consistency Check</td>
                <td className="p-4">Paraphrase pair invariance score</td>
                <td className="p-4 text-[#e05c00]">Shipped</td>
              </tr>
              <tr>
                <td className="p-4 text-white font-semibold">Calibration Metric</td>
                <td className="p-4">Brier Score &amp; Expected Calibration Error (ECE)</td>
                <td className="p-4 text-[#e05c00]">Shipped</td>
              </tr>
              <tr>
                <td className="p-4 text-white font-semibold">Drift Control Chart</td>
                <td className="p-4">One-sided CUSUM algorithm (k=0.5, h=4.0)</td>
                <td className="p-4 text-[#e05c00]">Shipped</td>
              </tr>
              <tr>
                <td className="p-4 text-white font-semibold">Circuit Breaker</td>
                <td className="p-4">Auto-pause agent status on critical score drop</td>
                <td className="p-4 text-[#e05c00]">Shipped</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}
