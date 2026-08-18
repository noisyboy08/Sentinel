import React from "react";
import { useNavigate } from "react-router-dom";
import { HeaderNav } from "../components/HeaderNav";
import { FooterSection } from "../components/FooterSection";

export default function CaseStudyPage() {
  const navigate = useNavigate();

  return (
    <div className="bg-[#000] text-white min-h-screen font-sans">
      <HeaderNav />

      {/* Hero */}
      <section className="px-7 md:px-12 py-20 border-b border-[#1c1c1c] max-w-5xl">
        <div className="inline-flex items-center gap-2 bg-[#1a0d00] border border-[#3a1a00] px-3 py-1.5 mb-8 font-mono">
          <span className="text-[#e05c00] text-[10px] tracking-widest">::::</span>
          <span className="text-[#e05c00] text-[10px] tracking-widest uppercase font-bold">THE REAL PROBLEM</span>
        </div>

        <h1 className="font-black text-white text-4xl md:text-6xl tracking-tight leading-tight mb-6">
          Documented Failure Modes in Production Agent Fleets
        </h1>
        <p className="text-[#888] text-sm md:text-base leading-relaxed max-w-3xl font-mono">
          Rather than inventing fictitious clients, Sentinel addresses three specific reliability challenges documented directly in Razorpay's public engineering blog.
        </p>
      </section>

      {/* Demo Verified Capabilities Bar */}
      <section className="border-b border-[#1c1c1c] bg-[#040404] font-mono">
        <div className="px-7 md:px-12 py-4 border-b border-[#1c1c1c] text-[11px] text-[#e05c00] font-bold uppercase tracking-widest">
          ● Capabilities Verified by Sentinel's Test Suite &amp; Demo Engine
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#1c1c1c]">
          <div className="p-8">
            <div className="text-2xl font-black text-white mb-2">Day 5 Drift Catch</div>
            <p className="text-xs text-[#888] leading-relaxed">
              Detects an injected performance regression within 24 hours of onset during a 10-day CUSUM drift simulation.
            </p>
          </div>
          <div className="p-8">
            <div className="text-2xl font-black text-white mb-2">100% Grounding Check</div>
            <p className="text-xs text-[#888] leading-relaxed">
              Flags any confident claim that lacks cited evidence using TF-IDF cosine similarity vectorization.
            </p>
          </div>
          <div className="p-8">
            <div className="text-2xl font-black text-white mb-2">Paraphrase Pair Flag</div>
            <p className="text-xs text-[#888] leading-relaxed">
              Identifies conflicting claims generated across paraphrased input prompts before decisions hit production.
            </p>
          </div>
        </div>
      </section>

      {/* Documented Cases */}
      <section className="px-7 md:px-12 py-16 border-b border-[#1c1c1c] font-mono">
        <h2 className="text-2xl font-black text-white mb-10">
          3 Documented Razorpay Agent Challenges
        </h2>

        <div className="space-y-12 max-w-5xl">
          {/* Case 1 */}
          <div className="border border-[#1c1c1c] bg-[#070707] p-8">
            <div className="text-[#e05c00] text-xs font-bold uppercase mb-2">CASE 01 / BUMBLEBEE RISK AGENT</div>
            <h3 className="text-xl font-bold text-white mb-4">Verdict Inconsistency Across Review Passes</h3>
            <p className="text-xs text-[#aaa] leading-relaxed mb-6">
              Razorpay's engineering team documented that prior to Bumblebee's multi-agent redesign, different review passes on the same merchant website could reach completely opposite risk verdicts — one flagging privacy policy text while another passed it.
            </p>
            <div className="bg-[#000] border border-[#1c1c1c] p-4 text-xs text-[#888]">
              <span className="text-[#e05c00] font-bold">Sentinel Solution:</span> The consistency check feeds paraphrased case duplicates and flags variance when TF-IDF cosine similarity drops below 0.50.
            </div>
          </div>

          {/* Case 2 */}
          <div className="border border-[#1c1c1c] bg-[#070707] p-8">
            <div className="text-[#e05c00] text-xs font-bold uppercase mb-2">CASE 02 / PROJECT VIVEKA RCA AGENT</div>
            <h3 className="text-xl font-bold text-white mb-4">Ungrounded Causal Assertions</h3>
            <p className="text-xs text-[#aaa] leading-relaxed mb-6">
              Project Viveka was explicitly designed around forcing every incident root-cause assertion to be backed by explicit evidence documents, because ungrounded claims are the default failure mode when relying on model memory.
            </p>
            <div className="bg-[#000] border border-[#1c1c1c] p-4 text-xs text-[#888]">
              <span className="text-[#e05c00] font-bold">Sentinel Solution:</span> Groundedness evaluation compares claim TF-IDF vectors against cited evidence, raising an ungrounded flag whenever high-confidence claims lack document support.
            </div>
          </div>

          {/* Case 3 */}
          <div className="border border-[#1c1c1c] bg-[#070707] p-8">
            <div className="text-[#e05c00] text-xs font-bold uppercase mb-2">CASE 03 / COSMOS &amp; PRISM ROUTER</div>
            <h3 className="text-xl font-bold text-white mb-4">Multi-Model Hallucination Mitigation</h3>
            <p className="text-xs text-[#aaa] leading-relaxed mb-6">
              Razorpay built the Cosmos/Prism routing layer to spread diagnostic workload across Claude, GPT, Gemini, and open-source models specifically because single-model paths exhibited recurring hallucination rates.
            </p>
            <div className="bg-[#000] border border-[#1c1c1c] p-4 text-xs text-[#888]">
              <span className="text-[#e05c00] font-bold">Sentinel Solution:</span> Model-agnostic governance contract evaluates outputs regardless of model provider or routing layer.
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-7 md:px-12 py-16 text-center border-b border-[#1c1c1c] font-mono">
        <h2 className="text-2xl font-black text-white mb-4">Experience the Evaluation Engine</h2>
        <p className="text-xs text-[#888] mb-8 max-w-md mx-auto">
          Run live simulations or ingest custom agent claims directly in the dashboard.
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          className="bg-[#e05c00] text-black text-xs font-mono font-bold uppercase tracking-widest px-8 py-4 hover:bg-[#ff7722] transition-all"
        >
          Launch Control Tower →
        </button>
      </section>

      <FooterSection />
    </div>
  );
}
