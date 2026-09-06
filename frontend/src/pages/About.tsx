import React from "react";
import { useNavigate } from "react-router-dom";
import { HeaderNav } from "../components/HeaderNav";
import { FooterSection } from "../components/FooterSection";

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="bg-[#000] text-white min-h-screen font-sans">
      <HeaderNav />

      {/* Hero */}
      <section className="px-7 md:px-12 py-20 border-b border-[#1c1c1c] max-w-5xl">
        <div className="inline-flex items-center gap-2 bg-[#1a0d00] border border-[#3a1a00] px-3 py-1.5 mb-8 font-mono">
          <span className="text-[#e05c00] text-[10px] tracking-widest">::::</span>
          <span className="text-[#e05c00] text-[10px] tracking-widest uppercase font-bold">ABOUT SENTINEL</span>
        </div>

        <h1 className="font-black text-white text-4xl md:text-6xl tracking-tight leading-tight mb-6">
          Fleet-Wide Reliability Architecture for Autonomous Agents
        </h1>
        <p className="text-[#888] text-sm md:text-base leading-relaxed max-w-3xl font-mono">
          Built as a technical submission for Razorpay's AI Builder role (Aug 2026). Sentinel unifies reliability governance across independent AI agents.
        </p>
      </section>

      {/* Origin Story */}
      <section className="px-7 md:px-12 py-16 border-b border-[#1c1c1c] font-mono">
        <div className="max-w-4xl border border-[#1c1c1c] bg-[#070707] p-8 md:p-12">
          <div className="text-[#e05c00] text-xs font-bold uppercase mb-3">ORIGIN STORY</div>
          <h2 className="text-2xl font-black text-white mb-6">Why I Built Sentinel</h2>
          <div className="space-y-4 text-xs text-[#aaa] leading-relaxed">
            <p>
              While researching Razorpay's engineering blog for this application, I noticed a pattern: three separate posts — about Bumblebee (merchant risk review), about Project Viveka (incident RCA), and about the Cosmos/Prism model-routing layer — each independently described fighting the same category of problem (inconsistent verdicts, hallucinated claims, unreliable outputs) with a different one-off fix.
            </p>
            <p>
              Nobody was watching the fleet of agents as a fleet. That gap is Sentinel.
            </p>
          </div>
        </div>
      </section>

      {/* 4 Trust Dimensions Grid */}
      <section className="px-7 md:px-12 py-16 border-b border-[#1c1c1c] font-mono">
        <h2 className="text-2xl font-black text-white mb-10">The 4 Dimensions of Agent Trust</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl">
          <div className="border border-[#1c1c1c] bg-[#070707] p-8">
            <div className="text-[#e05c00] text-xs font-bold uppercase mb-2">DIMENSION 01</div>
            <h3 className="text-lg font-bold text-white mb-3">Groundedness (TF-IDF Similarity)</h3>
            <p className="text-xs text-[#888] leading-relaxed">
              Verifies that an agent's claim is mathematically supported by cited evidence documents, preventing hallucinated conclusions.
            </p>
          </div>

          <div className="border border-[#1c1c1c] bg-[#070707] p-8">
            <div className="text-[#e05c00] text-xs font-bold uppercase mb-2">DIMENSION 02</div>
            <h3 className="text-lg font-bold text-white mb-3">Paraphrase Pair Consistency</h3>
            <p className="text-xs text-[#888] leading-relaxed">
              Feeds paraphrased case duplicates to check if outputs remain invariant across prompt variations.
            </p>
          </div>

          <div className="border border-[#1c1c1c] bg-[#070707] p-8">
            <div className="text-[#e05c00] text-xs font-bold uppercase mb-2">DIMENSION 03</div>
            <h3 className="text-lg font-bold text-white mb-3">Confidence Calibration (Brier / ECE)</h3>
            <p className="text-xs text-[#888] leading-relaxed">
              Evaluates whether an agent's stated confidence matches real-world accuracy outcomes to catch overconfidence.
            </p>
          </div>

          <div className="border border-[#1c1c1c] bg-[#070707] p-8">
            <div className="text-[#e05c00] text-xs font-bold uppercase mb-2">DIMENSION 04</div>
            <h3 className="text-lg font-bold text-white mb-3">CUSUM Statistical Drift Detection</h3>
            <p className="text-xs text-[#888] leading-relaxed">
              Runs a continuous one-sided CUSUM control chart (k=0.5, h=4.0) to catch rolling performance drops after prompt or model updates.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-7 md:px-12 py-16 text-center border-b border-[#1c1c1c] font-mono">
        <h2 className="text-2xl font-black text-white mb-4">Explore the Live Engine</h2>
        <p className="text-xs text-[#888] mb-8 max-w-md mx-auto">
          Test real evaluation pipelines and view live fleet statistics in the dashboard.
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
