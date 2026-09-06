import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HeaderNav } from "../components/HeaderNav";
import { FooterSection } from "../components/FooterSection";
import { DotGridBackground } from "../components/DotGridBackground";

export default function SolutionsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);

  const solutions = [
    {
      id: "workflow-automation",
      title: "Workflow Automation",
      subtitle: "Eliminate manual handoffs across your tech stack",
      badge: "AUTOMATION",
      desc: "Sentinel connects your CRM, support desk, database, and Slack channels into automated, fault-tolerant execution graphs that operate 24/7.",
      bullets: [
        "Real-time event triggers & webhook ingestion",
        "Automated fallback branches & human-in-the-loop routing",
        "Zero data-loss audit trails & execution logs",
      ],
      codeSnippet: `// Sentinel Workflow Trigger
import { SentinelSDK } from "@sentinel/sdk";

const sentinel = new SentinelSDK({ apiKey: process.env.SENTINEL_KEY });

await sentinel.executeWorkflow("lead_enrichment", {
  trigger: "new_lead_submitted",
  groundingThreshold: 0.70,
  autoPauseOnDrift: true,
});`,
    },
    {
      id: "agent-deployment",
      title: "AI Agent Deployment",
      subtitle: "Deploy autonomous agents governed by mathematical trust",
      badge: "AGENTS",
      desc: "Deploy LLM agents for risk assessment, chargeback disputes, customer support, and root-cause analysis with real-time hallucination circuit breakers.",
      bullets: [
        "Multi-model routing (Claude 3.5, GPT-4o, Gemini 1.5)",
        "TF-IDF groundedness verification on cited evidence",
        "Paraphrase pair consistency checking across runs",
      ],
      codeSnippet: `# Python Ingestion SDK
from sentinel_sdk import SentinelSDK

sentinel = SentinelSDK(base_url="http://localhost:8000")

# Report decision output for instant 4-dimension eval
result = sentinel.report_output(
    agent_id="risk_review",
    case_id="CASE-9021",
    output="Approve merchant refund based on policy doc §4.2",
    evidence_text="Policy doc §4.2 permits full refund within 30 days."
)
print(f"Health Score: {result['health_score']}/100")`,
    },
    {
      id: "strategy-roadmap",
      title: "AI Strategy & Roadmap",
      subtitle: "Data-driven ROI mapping before writing a single line of code",
      badge: "STRATEGY",
      desc: "We audit your business processes, identify high-ROI automation opportunities, calculate expected annual cost savings, and deliver a phased deployment roadmap.",
      bullets: [
        "Automated process diagnosis & bottleneck discovery",
        "Precise ROI & labor cost reduction projections",
        "Risk matrix & security compliance guidelines",
      ],
      codeSnippet: `$ sentinel-cli audit --target=customer_ops

[DIAGNOSTIC COMPLETE]
------------------------------------------------
Support Ticket Classification : 84% automatable
Merchant Risk Triage          : 91% automatable
Chargeback Response           : 76% automatable

Estimated Annual Savings: $240,000 / year
Recommended Sprint     : 6-week full deployment`,
    },
    {
      id: "systems-integration",
      title: "Systems Integration",
      subtitle: "Unified data layer across all your tools and APIs",
      badge: "INTEGRATION",
      desc: "Bridge legacy databases, internal APIs, Slack, HubSpot, Salesforce, and custom REST APIs into one unified, searchable knowledge graph.",
      bullets: [
        "Native connectors for 50+ enterprise SaaS platforms",
        "Encrypted vector store & RAG document indexing",
        "Real-time bidirectional synchronization",
      ],
      codeSnippet: `// Unified Data Bridge Config
export const integrationConfig = {
  connectors: ["hubspot", "slack", "salesforce", "zendesk"],
  syncIntervalMs: 5000,
  circuitBreaker: {
    maxConsecutiveErrors: 3,
    alertChannel: "#sentinel-incidents",
  },
};`,
    },
  ];

  return (
    <div className="bg-[#000] text-white min-h-screen font-sans">
      <HeaderNav />

      {/* Hero */}
      <section className="relative border-b border-[#1c1c1c] overflow-hidden py-24 px-6 md:px-12">
        <DotGridBackground className="opacity-80" />
        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2 bg-[#1a0d00] border border-[#3a1a00] px-3 py-1.5 mb-8">
            <span className="text-[#e05c00] text-[10px] font-mono tracking-widest">::::</span>
            <span className="text-[#e05c00] text-[10px] font-mono tracking-widest uppercase">SOLUTIONS</span>
          </div>
          <h1 className="font-black text-white text-4xl md:text-7xl leading-tight tracking-tight mb-6">
            Production AI Workflows Built for Scale.
          </h1>
          <p className="text-[#e05c00] text-sm md:text-base leading-relaxed max-w-2xl mb-10 font-mono">
            From simple triggers to multi-step agent pipelines — fully governed by Sentinel's 4-dimension reliability engine.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="border border-white text-white text-xs font-mono uppercase tracking-widest px-6 py-3.5 hover:bg-white hover:text-black transition-all flex items-center gap-3 font-semibold"
          >
            Launch Dashboard <span>→</span>
          </button>
        </div>
      </section>

      {/* Hatched Stripe Divider */}
      <div className="w-full h-[28px] border-b border-[#1c1c1c]" style={{ background: "repeating-linear-gradient(45deg,#111 0px,#111 8px,#0a0a0a 8px,#0a0a0a 16px)" }} />

      {/* Interactive Solution Tabs */}
      <section className="border-b border-[#1c1c1c]">
        <div className="px-6 md:px-12 py-16 border-b border-[#1c1c1c]">
          <h2 className="font-black text-white text-3xl md:text-5xl tracking-tight">
            Our Core AI Solutions
          </h2>
        </div>

        {/* Tab Header */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[#1c1c1c] border-b border-[#1c1c1c] bg-[#050505]">
          {solutions.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActiveTab(i)}
              className={`p-6 text-left transition-all ${
                activeTab === i
                  ? "bg-[#0d0d0d] text-white border-b-2 border-[#e05c00]"
                  : "text-[#666] hover:text-[#aaa]"
              }`}
            >
              <div className="text-[10px] font-mono uppercase text-[#e05c00] mb-2">{s.badge}</div>
              <div className="text-sm font-bold">{s.title}</div>
            </button>
          ))}
        </div>

        {/* Active Tab Body */}
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#1c1c1c]">
          {/* Left info */}
          <div className="p-8 md:p-12 flex flex-col justify-between">
            <div>
              <div className="inline-block text-[10px] font-mono uppercase text-[#e05c00] border border-[#e05c00]/30 px-2.5 py-1 mb-4">
                {solutions[activeTab].badge}
              </div>
              <h3 className="font-black text-white text-2xl md:text-3xl mb-3">
                {solutions[activeTab].subtitle}
              </h3>
              <p className="text-xs text-[#888] leading-relaxed mb-8">
                {solutions[activeTab].desc}
              </p>
              <ul className="space-y-3 mb-8">
                {solutions[activeTab].bullets.map((bullet, k) => (
                  <li key={k} className="flex items-start gap-3 text-xs text-[#ccc]">
                    <span className="text-[#e05c00] text-[10px] mt-0.5">■</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => navigate("/dashboard")}
              className="border border-[#333] text-white text-xs font-mono uppercase tracking-widest py-3 px-5 hover:border-[#e05c00] hover:text-[#e05c00] transition-all self-start"
            >
              Configure Solution →
            </button>
          </div>

          {/* Right code snippet */}
          <div className="bg-[#070707] p-8 md:p-12 flex items-center justify-center">
            <div className="w-full bg-[#0d0d0d] border border-[#222] p-6 rounded font-mono text-xs shadow-2xl">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#1e1e1e]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                <span className="text-[10px] text-[#555] ml-2">solution_spec.ts</span>
              </div>
              <pre className="text-[#a0a0a0] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {solutions[activeTab].codeSnippet}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Hatched Stripe Divider */}
      <div className="w-full h-[28px] border-b border-[#1c1c1c]" style={{ background: "repeating-linear-gradient(45deg,#111 0px,#111 8px,#0a0a0a 8px,#0a0a0a 16px)" }} />

      {/* CTA Card */}
      <section className="py-24 px-6 text-center bg-[#050505] border-b border-[#1c1c1c]">
        <h2 className="font-black text-white text-3xl md:text-5xl mb-6">
          Ready to automate your agent fleet?
        </h2>
        <p className="text-xs text-[#888] font-mono max-w-md mx-auto mb-8">
          Get integrated in 30 minutes with our Python SDK or REST ingestion API.
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          className="bg-[#e05c00] text-black text-xs font-mono font-bold uppercase tracking-widest px-8 py-4 hover:bg-[#ff7722] transition-all"
        >
          Launch Dashboard →
        </button>
      </section>

      <FooterSection />
    </div>
  );
}
