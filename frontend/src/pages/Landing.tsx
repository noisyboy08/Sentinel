import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HeaderNav } from "../components/HeaderNav";
import { FooterSection } from "../components/FooterSection";

/* ─────────────────────────────────────────────────────────────────────────────
   ANIMATED HALFTONE DOT GRID (Sphere sweep & ripple animation)
───────────────────────────────────────────────────────────────────────────── */
function HalftoneDots({
  className = "",
  focalX = 1.0,
  focalY = 1.0,
}: {
  className?: string;
  focalX?: number;
  focalY?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    let t = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      canvas.width = parent ? parent.clientWidth : 600;
      canvas.height = parent ? parent.clientHeight : 600;
    };
    resize();

    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    const draw = () => {
      t += 0.014;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const SPACING = 15;
      const cols = Math.ceil(canvas.width / SPACING) + 1;
      const rows = Math.ceil(canvas.height / SPACING) + 1;

      const fpx = canvas.width * focalX;
      const fpy = canvas.height * focalY;
      const maxDist = Math.sqrt(
        Math.max(fpx, canvas.width - fpx) ** 2 +
        Math.max(fpy, canvas.height - fpy) ** 2
      );

      for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
          const x = col * SPACING;
          const y = row * SPACING;

          const dx = x - fpx;
          const dy = y - fpy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const proximity = Math.max(0, 1 - dist / maxDist);

          const normX = x / canvas.width;
          const normY = y / canvas.height;
          const diag = normX + normY;
          const sweep = Math.sin(t * 1.4 + diag * 3.5) * 0.38 + 0.62;
          const ripple = Math.sin(t * 1.8 - dist * 0.018) * 0.82;

          const alpha = Math.pow(proximity, 0.9) * sweep * ripple;
          if (alpha < 0.025) continue;

          const radius = 1.0 + proximity * 3.2;
          const g = Math.round(40 + proximity * 100);

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,${g},0,${Math.min(alpha, 0.92).toFixed(3)})`;
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animId);
    };
  }, [focalX, focalY]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ANIMATED VECTOR GRID (Rotating slash lines for "The Solution" panel)
───────────────────────────────────────────────────────────────────────────── */
function VectorGridCanvas({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    let t = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      canvas.width = parent ? parent.clientWidth : 600;
      canvas.height = parent ? parent.clientHeight : 500;
    };
    resize();

    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    const draw = () => {
      t += 0.018;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const SPACING = 20;
      const cols = Math.ceil(canvas.width / SPACING) + 1;
      const rows = Math.ceil(canvas.height / SPACING) + 1;
      const lineLen = 9;

      for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
          const cx = col * SPACING;
          const cy = row * SPACING;

          const angle = Math.sin(t + col * 0.18 + row * 0.12) * Math.PI * 0.45;
          const dx = (Math.cos(angle) * lineLen) / 2;
          const dy = (Math.sin(angle) * lineLen) / 2;

          const normX = cx / canvas.width;
          const normY = cy / canvas.height;
          const distFromCenter = Math.sqrt((normX - 0.5) ** 2 + (normY - 0.5) ** 2);
          const alpha = Math.max(0.12, 0.45 - distFromCenter * 0.4);

          ctx.beginPath();
          ctx.moveTo(cx - dx, cy - dy);
          ctx.lineTo(cx + dx, cy + dy);

          const isOrangeWave = Math.sin(t * 1.5 - (col * 0.2 + row * 0.15)) > 0.7;
          if (isOrangeWave) {
            ctx.strokeStyle = `rgba(255, 107, 0, ${(alpha * 1.5).toFixed(2)})`;
            ctx.lineWidth = 1.5;
          } else {
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
            ctx.lineWidth = 1.0;
          }

          ctx.stroke();
        }
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   FAQ ACCORDION ROW
───────────────────────────────────────────────────────────────────────────── */
function FaqRow({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[#1c1c1c]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between py-5 text-left gap-6 group"
      >
        <span className={`text-sm font-medium leading-snug transition-colors ${open ? "text-white" : "text-[#aaa] group-hover:text-white"}`}>
          {q}
        </span>
        <span className="text-[#555] text-base mt-0.5 shrink-0 group-hover:text-[#999] transition-colors font-mono">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <p className="pb-5 text-xs text-[#888] leading-relaxed max-w-3xl font-mono">
          {a}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ORANGE SECTION BADGE  ":::: LABEL TEXT"
───────────────────────────────────────────────────────────────────────────── */
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 bg-[#1a0d00] border border-[#3a1a00] px-3 py-1.5 mb-8 font-mono">
      <span className="text-[#e05c00] text-[10px] tracking-widest">::::</span>
      <span className="text-[#e05c00] text-[10px] tracking-widest uppercase font-bold">{children}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN LANDING PAGE
───────────────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const navigate = useNavigate();
  const [activeFeature, setActiveFeature] = useState(0);
  const [visiblePanels, setVisiblePanels] = useState<Set<number>>(new Set([0]));
  const featureRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Scroll-spy: which panel is the main active one?
    const handleObserver = () => {
      featureRefs.current.forEach((el, i) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.top <= window.innerHeight * 0.55 && rect.bottom >= window.innerHeight * 0.15) {
          setActiveFeature(i);
        }
      });
    };
    window.addEventListener("scroll", handleObserver, { passive: true });
    handleObserver();

    // IntersectionObserver: panel slide-in when it enters viewport
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = featureRefs.current.indexOf(entry.target as HTMLDivElement);
            if (idx !== -1) setVisiblePanels((prev) => new Set([...prev, idx]));
          }
        });
      },
      { threshold: 0.12 }
    );
    featureRefs.current.forEach((el) => el && io.observe(el));

    return () => {
      window.removeEventListener("scroll", handleObserver);
      io.disconnect();
    };
  }, []);

  const scrollToFeature = (idx: number) => {
    setActiveFeature(idx);
    const el = featureRefs.current[idx];
    if (el) {
      const yOffset = -90;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const faqs = [
    {
      q: "What exactly does Sentinel monitor across Razorpay's AI fleet?",
      a: "Sentinel continuously evaluates AI agent outputs across four trust dimensions: groundedness (TF-IDF evidence alignment), consistency (paraphrase pair invariance), calibration (Brier score & ECE binned error), and statistical drift (one-sided CUSUM control chart). It auto-flags failing agents before merchants are affected.",
      defaultOpen: true,
    },
    {
      q: "How does Sentinel integrate with Agent Studio or custom models?",
      a: "Sentinel is model-agnostic. Agents (built on Claude Agent SDK, LangChain, or custom scripts) send a single JSON payload to POST /api/ingest: claim, cited evidence, confidence, cost, and latency. Sentinel computes reliability metrics instantly.",
    },
    {
      q: "How does Sentinel handle drift detection?",
      a: "Rather than relying solely on snapshot checks, Sentinel calculates a daily composite score and runs a one-sided CUSUM control chart (k=0.5, h=4.0). When cumulative drift crosses h=4.0, the agent is automatically paused.",
    },
    {
      q: "Why is a fleet-wide control tower necessary when individual agents have accuracy checks?",
      a: "Razorpay's engineering blog highlights three distinct failure modes: Bumblebee's pre-redesign inconsistency, Viveka's evidence grounding rule, and Cosmos/Prism's hallucination-driven routing. Sentinel unifies governance so every agent adheres to identical reliability standards.",
    },
  ];

  return (
    <div
      className="bg-[#000] text-white min-h-screen overflow-x-hidden font-sans"
      style={{ fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}
    >
      <HeaderNav />

      {/* ══════════════════════════════════════════════════════════════════════
          HERO SECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="border-b border-[#1c1c1c] flex flex-col" style={{ minHeight: "calc(100vh - 56px)" }}>
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2" style={{ minHeight: 0 }}>
          {/* Left Column */}
          <div className="border-r border-[#1c1c1c] px-7 md:px-12 flex flex-col justify-center py-16 min-h-[420px]">
            <Badge>PORTFOLIO PROJECT — BUILT FOR RAZORPAY'S AI BUILDER ROLE</Badge>

            <h1
              className="font-black text-white leading-[1.05] tracking-tight mb-6"
              style={{ fontSize: "clamp(38px, 5.2vw, 72px)" }}
            >
              Automate trust across your AI agent fleet.
            </h1>

            <p className="text-[#e05c00] text-sm leading-relaxed mb-10 max-w-[420px] font-mono">
              Sentinel catches an AI agent lying confidently, contradicting itself, or quietly getting worse — before a merchant ever notices.
            </p>

            <button
              onClick={() => navigate("/dashboard")}
              className="self-start flex items-center gap-3 border border-[#e05c00] bg-[#1a0d00] text-[#e05c00] hover:bg-[#e05c00] hover:text-black text-[12px] uppercase tracking-widest font-semibold font-mono px-5 py-3.5 transition-all duration-150"
            >
              <span className="grid grid-cols-2 gap-[3px] shrink-0">
                <span className="w-[5px] h-[5px] bg-current" />
                <span className="w-[5px] h-[5px] bg-current" />
                <span className="w-[5px] h-[5px] bg-current" />
                <span className="w-[5px] h-[5px] bg-current" />
              </span>
              Launch Control Tower
            </button>
          </div>

          {/* Right Column — Halftone dots + Workflow card */}
          <div className="relative hidden lg:flex items-center overflow-hidden bg-[#000]">
            <HalftoneDots focalX={1.05} focalY={1.05} />

            <div className="relative z-10 ml-10 bg-[#0d0d0d] border border-[#262626] shadow-2xl p-6 w-[320px] font-mono">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#1e1e1e]">
                <span className="text-[11px] uppercase tracking-widest text-white font-bold">
                  Fleet Monitor
                </span>
                <span className="text-[10px] uppercase tracking-widest text-[#e05c00] animate-pulse">
                  ● Live Ingest
                </span>
              </div>

              <div className="space-y-3 text-xs mb-4">
                {[
                  { label: "Bumblebee (Risk Review)",   status: "Grounded 94%", ok: true },
                  { label: "Project Viveka (RCA)",      status: "Evidence Cited", ok: true },
                  { label: "Ray Support Agent",         status: "Calibrated",   ok: true },
                  { label: "Dispute Auto-Responder",    status: "Drift Monitor", ok: true },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 border-b border-[#141414]">
                    <span className="text-[#aaa] text-[11px] truncate max-w-[170px]">{item.label}</span>
                    <span className="text-[#e05c00] text-[10px]">{item.status}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 text-[10px] text-[#555] leading-relaxed border-t border-[#1e1e1e]">
                Model-agnostic evaluation contract running 4 math checks 24/7.
              </div>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="border-t border-[#1c1c1c] grid grid-cols-2 md:grid-cols-4 divide-x divide-[#1c1c1c] shrink-0 bg-[#040404]">
          {[
            { num: "15+",         label: "Production AI agents running at Razorpay" },
            { num: "~70%",        label: "Support queries handled by Ray agent" },
            { num: "800 hrs/mo",  label: "Manual review time Bumblebee replaced" },
            { num: "4 Checks",    label: "Groundedness, Consistency, Calibration, Drift" },
          ].map((s) => (
            <div key={s.label} className="px-7 md:px-10 py-8">
              <div className="font-black text-white leading-none mb-2 font-mono" style={{ fontSize: "clamp(26px, 3.2vw, 42px)" }}>
                {s.num}
              </div>
              <div className="text-[#666] text-xs font-mono leading-tight">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          THE PROBLEM SECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="border-b border-[#1c1c1c]">
        <div className="w-full h-[28px] border-b border-[#1c1c1c]" style={{ background: "repeating-linear-gradient(45deg,#111 0px,#111 8px,#0a0a0a 8px,#0a0a0a 16px)" }} />

        <div className="px-7 md:px-12 pt-12 pb-10 border-b border-[#1c1c1c]">
          <Badge>The Problem</Badge>
          <h2 className="font-black text-white leading-[1.1] tracking-tight max-w-4xl" style={{ fontSize: "clamp(26px, 3.8vw, 50px)" }}>
            Nobody watches the AI agent fleet as a fleet.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#1c1c1c]">
          {[
            {
              title: "Same case, different verdict",
              desc: "Razorpay's own Bumblebee team described different review passes reaching completely different conclusions on the same merchant before they redesigned it.",
              source: "Bumblebee Engineering Post (2025)",
            },
            {
              title: "Confident claim, no evidence",
              desc: "Razorpay's Project Viveka was built specifically because letting an agent state root-cause conclusions without forcing it to cite grounded evidence is the default failure mode.",
              source: "Viveka Engineering Post (2025)",
            },
            {
              title: "Silent drift, nobody watching",
              desc: "None of Razorpay's published agent systems have a public way to catch a slow accuracy decline over weeks after prompt tweaks, only single-snapshot checks.",
              source: "Systemic Monitoring Gap",
            },
          ].map((card, i) => (
            <div key={i} className="p-8 md:p-10 flex flex-col justify-between min-h-[280px]">
              <div>
                <div className="grid grid-cols-3 gap-[6px] w-fit mb-6">
                  {Array.from({ length: 9 }).map((_, k) => (
                    <span key={k} className="w-[6px] h-[6px] rounded-full bg-[#2a2a2a]" />
                  ))}
                </div>
                <div className="text-sm font-bold text-white mb-2 font-mono">{card.title}</div>
                <p className="text-xs text-[#888] leading-relaxed mb-6 font-mono">{card.desc}</p>
              </div>
              <div className="text-[10px] font-mono text-[#e05c00] border-t border-[#1c1c1c] pt-4">
                ● {card.source}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          THE SOLUTION SECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="border-b border-[#1c1c1c]">
        <div className="w-full h-[28px] border-b border-[#1c1c1c]" style={{ background: "repeating-linear-gradient(45deg,#111 0px,#111 8px,#0a0a0a 8px,#0a0a0a 16px)" }} />

        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="px-7 md:px-12 py-16 border-b lg:border-b-0 lg:border-r border-[#1c1c1c] flex flex-col justify-center">
            <Badge>The Solution</Badge>
            <h2 className="font-black text-white leading-[1.05] tracking-tight mb-6" style={{ fontSize: "clamp(26px, 3.5vw, 44px)" }}>
              One shared contract to govern all 15+ agents
            </h2>
            <p className="text-[#888] text-xs leading-relaxed mb-8 max-w-md font-mono">
              Every agent reports through one contract: claim, cited evidence, confidence, cost, latency. Sentinel runs 4 checks on every output, model-agnostic.
            </p>
            <ul className="space-y-3 font-mono">
              {[
                "Groundedness — TF-IDF cosine similarity against cited evidence",
                "Consistency — Invariance checks across paraphrased case duplicates",
                "Calibration — Brier score & ECE confidence binning",
                "Drift Detection — One-sided CUSUM control chart (k=0.5, h=4.0)",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-xs text-[#aaa]">
                  <span className="text-[#e05c00] text-[10px] mt-1 shrink-0">■</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative bg-[#050505] px-8 md:px-12 py-16 flex items-center justify-center overflow-hidden">
            <VectorGridCanvas />

            <div className="relative z-10 bg-[#0d0d0d] border border-[#222] p-7 w-full max-w-md font-mono text-[13px] shadow-2xl">
              <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#1e1e1e]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                <span className="text-[10px] text-[#666] ml-2">sentinel_eval.py</span>
              </div>
              <div className="space-y-2">
                <p className="text-[#888]">$ python -m sentinel.tower</p>
                <p className="text-[#666]">→ Groundedness (TF-IDF): <span className="text-[#e05c00]">0.88 OK</span></p>
                <p className="text-[#666]">→ Consistency (Paraphrase): <span className="text-[#e05c00]">0.92 OK</span></p>
                <p className="text-[#666]">→ Calibration (Brier): <span className="text-[#e05c00]">0.042 OK</span></p>
                <p className="text-[#666]">→ CUSUM Drift (h=4.0): <span className="text-[#e05c00]">1.20 Nominal</span></p>
                <div className="pt-3 mt-3 border-t border-[#1e1e1e]">
                  <p className="text-[#4caf50]">✓ Composite Score: 91/100 [ACTIVE]</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          WHAT WE BUILD — PINNED SPLIT-SCREEN INTERACTIVE ANIMATED SHOWCASE
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="features" className="border-b border-[#1c1c1c]">
        <div className="w-full h-[28px] border-b border-[#1c1c1c]" style={{ background: "repeating-linear-gradient(45deg,#111 0px,#111 8px,#0a0a0a 8px,#0a0a0a 16px)" }} />

        {/* MOBILE SECTION HEADER (visible only on screens < lg) */}
        <div className="block lg:hidden p-6 border-b border-[#1c1c1c] bg-[#000]">
          <Badge>What We Build</Badge>
          <h2 className="font-black text-white leading-[1.1] tracking-tight text-2xl sm:text-3xl mb-3">
            The 4 Mathematical Reliability Checks
          </h2>
          <p className="text-xs text-[#888] font-mono leading-relaxed mb-6">
            Model-agnostic governance running continuously across Claude, GPT, and Gemini agents.
          </p>

          {/* Horizontal scrollable nav tabs for mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none font-mono">
            {[
              { num: "01", label: "Groundedness" },
              { num: "02", label: "Consistency" },
              { num: "03", label: "Calibration" },
              { num: "04", label: "Drift" },
            ].map((item, i) => (
              <button
                key={i}
                onClick={() => scrollToFeature(i)}
                className={`shrink-0 px-3 py-2 text-[11px] uppercase tracking-wider font-semibold border transition-all ${
                  activeFeature === i
                    ? "text-[#e05c00] border-[#e05c00] bg-[#1a0d00]"
                    : "text-[#666] border-[#1c1c1c] bg-[#050505]"
                }`}
              >
                {item.num}. {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-start">
          {/* STICKY PINNED LEFT COLUMN (desktop only, lg+) */}
          <div
            className="hidden lg:flex flex-col shrink-0 border-r border-[#1c1c1c] bg-[#000] z-20"
            style={{
              width: "420px",
              position: "sticky",
              top: "56px",
              height: "calc(100vh - 56px)",
              overflowY: "auto",
              padding: "48px",
              gap: "32px",
            }}
          >
            <div>
              <Badge>What We Build</Badge>
              <h2 className="font-black text-white leading-[1.1] tracking-tight text-3xl md:text-4xl mb-3">
                The 4 Mathematical Reliability Checks
              </h2>
              <p className="text-xs text-[#888] font-mono leading-relaxed">
                Model-agnostic governance running continuously across Claude, GPT, and Gemini agents.
              </p>
            </div>

            {/* Nav Menu Items */}
            <div className="space-y-2.5 border-t border-[#1c1c1c] pt-6 font-mono">
              {[
                { num: "01", label: "Groundedness Check" },
                { num: "02", label: "Consistency Pair Check" },
                { num: "03", label: "Calibration Bins Check" },
                { num: "04", label: "CUSUM Drift Control" },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={() => scrollToFeature(i)}
                  className={`w-full flex items-center justify-between p-3.5 text-left text-xs font-mono uppercase tracking-widest transition-all border ${
                    activeFeature === i
                      ? "text-[#e05c00] font-bold border-[#e05c00] bg-[#1a0d00] shadow-[0_0_15px_rgba(224,92,0,0.15)]"
                      : "text-[#666] hover:text-white border-[#1c1c1c] bg-[#050505]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] ${activeFeature === i ? "text-[#e05c00]" : "text-[#444]"}`}>
                      ■
                    </span>
                    <span>{item.num}. {item.label}</span>
                  </div>
                  {activeFeature === i && (
                    <span className="text-[10px] text-[#e05c00] font-bold animate-pulse">ACTIVE →</span>
                  )}
                </button>
              ))}
            </div>

            <div className="pt-2">
              <button
                onClick={() => navigate("/dashboard")}
                className="w-full border border-[#e05c00] bg-[#e05c00] text-black text-xs font-mono font-bold uppercase tracking-widest px-4 py-3.5 hover:bg-[#ff7722] transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <span>Launch Control Tower</span>
                <span>→</span>
              </button>
            </div>
          </div>

          {/* RIGHT SCROLLING ANIMATED SHOWCASE PANELS */}
          <div className="flex-1 min-w-0 w-full max-w-full font-mono divide-y divide-[#1c1c1c] overflow-hidden">
            {/* Panel 1: Groundedness Visual Showcase */}
            <div
              ref={el => (featureRefs.current[0] = el)}
              className={`w-full max-w-full min-w-0 overflow-hidden p-4 sm:p-8 md:p-14 py-10 lg:min-h-[750px] flex flex-col justify-center transition-all duration-700 ${
                activeFeature === 0 ? "bg-[#070707]" : "bg-[#000] lg:opacity-60"
              }`}
              style={{
                opacity: visiblePanels.has(0) ? 1 : 0,
                transform: visiblePanels.has(0) ? "translateY(0)" : "translateY(44px)",
                transition: "opacity 0.7s ease, transform 0.7s ease, background-color 0.5s",
              }}
            >
              <div className="text-xs font-mono text-[#e05c00] uppercase mb-2 font-bold flex items-center gap-2 flex-wrap">
                <span>CHECK 01 / GROUNDEDNESS EVALUATOR</span>
                <span className="w-2 h-2 rounded-full bg-[#e05c00] animate-pulse" />
              </div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-4 break-words w-full max-w-full">
                TF-IDF Cosine Similarity Evidence Alignment
              </h3>
              <p className="text-xs text-[#888] leading-relaxed mb-8 max-w-2xl break-words w-full">
                Compares the agent's claim against cited source documents. If confidence is high but groundedness score is low, an ungrounded flag is raised immediately.
              </p>

              {/* Interactive Visual Box 1 */}
              <div className="w-full max-w-full min-w-0 overflow-hidden bg-[#0d0d0d] border border-[#222] p-4 sm:p-6 mb-6 space-y-4 rounded-sm">
                <div className="flex items-center justify-between border-b border-[#1c1c1c] pb-3 text-xs flex-wrap gap-1">
                  <span className="text-[#888]">Agent Input Claim</span>
                  <span className="text-[#e05c00] font-bold">Score: 88% Grounded [NOMINAL]</span>
                </div>
                <div className="p-3 bg-[#000] border border-[#1c1c1c] text-xs text-white break-words">
                  "Merchant flagged for high fraud risk due to unverified regulatory license."
                </div>

                <div className="text-xs text-[#888] pt-1">Cited Evidence Document:</div>
                <div className="p-3 bg-[#000] border border-[#1c1c1c] text-xs text-[#aaa] font-mono break-words">
                  "FSSAI license registration missing from food business application."
                </div>

                {/* Meter Bar */}
                <div className="space-y-1 pt-2 w-full">
                  <div className="flex justify-between text-[11px] text-[#666] flex-wrap gap-1">
                    <span>TF-IDF Vector Alignment</span>
                    <span className="text-[#e05c00] font-bold">0.88 Cosine Match</span>
                  </div>
                  <div className="h-2 bg-[#1c1c1c] overflow-hidden rounded-full w-full">
                    <div className="h-full bg-gradient-to-r from-[#e05c00] to-[#ff7722] w-[88%] transition-all duration-700" />
                  </div>
                </div>
              </div>

              <pre className="w-full max-w-full min-w-0 bg-[#040404] border border-[#1c1c1c] p-3.5 sm:p-5 text-[10px] sm:text-xs text-[#aaa] overflow-x-auto rounded-sm leading-relaxed whitespace-pre-wrap sm:whitespace-pre break-all sm:break-normal">
{`# From checks.py — TF-IDF Groundedness Check
def check_groundedness(claim: str, evidence_cited: list[str]) -> float:
    if not evidence_cited: return 0.0
    text_evidence = " ".join(evidence_cited)
    vectorizer = TfidfVectorizer().fit_transform([claim, text_evidence])
    return float((vectorizer * vectorizer.T).toarray()[0, 1])`}
              </pre>
            </div>

            {/* Panel 2: Consistency Visual Showcase */}
            <div
              ref={el => (featureRefs.current[1] = el)}
              className={`w-full max-w-full min-w-0 overflow-hidden p-4 sm:p-8 md:p-14 py-10 lg:min-h-[750px] flex flex-col justify-center ${
                activeFeature === 1 ? "bg-[#070707]" : "bg-[#000] lg:opacity-60"
              }`}
              style={{
                opacity: visiblePanels.has(1) ? 1 : 0,
                transform: visiblePanels.has(1) ? "translateY(0)" : "translateY(44px)",
                transition: "opacity 0.7s ease 0.1s, transform 0.7s ease 0.1s, background-color 0.5s",
              }}
            >
              <div className="text-xs font-mono text-[#e05c00] uppercase mb-2 font-bold flex items-center gap-2 flex-wrap">
                <span>CHECK 02 / PARAPHRASE PAIR EVALUATOR</span>
                <span className="w-2 h-2 rounded-full bg-[#e05c00] animate-pulse" />
              </div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-4 break-words w-full max-w-full">
                Paraphrase Pair Semantic Invariance
              </h3>
              <p className="text-xs text-[#888] leading-relaxed mb-8 max-w-2xl break-words w-full">
                Feeds the agent a paraphrased duplicate case and checks if output claims remain consistent. Directly prevents Bumblebee's pre-fix verdict variance.
              </p>

              {/* Interactive Visual Box 2 */}
              <div className="w-full max-w-full min-w-0 overflow-hidden bg-[#0d0d0d] border border-[#222] p-4 sm:p-6 mb-6 space-y-4 rounded-sm">
                <div className="flex items-center justify-between border-b border-[#1c1c1c] pb-3 text-xs flex-wrap gap-1">
                  <span className="text-[#888]">Dual-Pass Paraphrase Test</span>
                  <span className="text-[#e05c00] font-bold">Invariance: 94% [PASSED]</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-[#000] border border-[#1c1c1c] text-xs space-y-1 break-words">
                    <div className="text-[10px] text-[#555]">PASS 1 (ORIGINAL PROMPT)</div>
                    <div className="text-[#ccc]">"Merchant website pass 1 → Flagged suspicious privacy policy."</div>
                  </div>
                  <div className="p-3 bg-[#000] border border-[#1c1c1c] text-xs space-y-1 break-words">
                    <div className="text-[10px] text-[#555]">PASS 2 (PARAPHRASED PROMPT)</div>
                    <div className="text-[#ccc]">"Merchant website pass 2 → Flagged suspicious privacy policy."</div>
                  </div>
                </div>

                <div className="space-y-1 pt-2 w-full">
                  <div className="flex justify-between text-[11px] text-[#666] flex-wrap gap-1">
                    <span>Semantic Vector Invariance</span>
                    <span className="text-[#e05c00] font-bold">0.94 Cosine Match</span>
                  </div>
                  <div className="h-2 bg-[#1c1c1c] overflow-hidden rounded-full w-full">
                    <div className="h-full bg-gradient-to-r from-[#e05c00] to-[#ff7722] w-[94%] transition-all duration-700" />
                  </div>
                </div>
              </div>

              <pre className="w-full max-w-full min-w-0 bg-[#040404] border border-[#1c1c1c] p-3.5 sm:p-5 text-[10px] sm:text-xs text-[#aaa] overflow-x-auto rounded-sm leading-relaxed whitespace-pre-wrap sm:whitespace-pre break-all sm:break-normal">
{`# From checks.py — Paraphrase Consistency Check
def check_consistency(claim_orig: str, claim_para: str) -> float:
    vectorizer = TfidfVectorizer().fit_transform([claim_orig, claim_para])
    return float((vectorizer * vectorizer.T).toarray()[0, 1])`}
              </pre>
            </div>

            {/* Panel 3: Calibration Visual Showcase */}
            <div
              ref={el => (featureRefs.current[2] = el)}
              className={`w-full max-w-full min-w-0 overflow-hidden p-4 sm:p-8 md:p-14 py-10 lg:min-h-[750px] flex flex-col justify-center ${
                activeFeature === 2 ? "bg-[#070707]" : "bg-[#000] lg:opacity-60"
              }`}
              style={{
                opacity: visiblePanels.has(2) ? 1 : 0,
                transform: visiblePanels.has(2) ? "translateY(0)" : "translateY(44px)",
                transition: "opacity 0.7s ease 0.05s, transform 0.7s ease 0.05s, background-color 0.5s",
              }}
            >
              <div className="text-xs font-mono text-[#e05c00] uppercase mb-2 font-bold flex items-center gap-2 flex-wrap">
                <span>CHECK 03 / CONFIDENCE CALIBRATION</span>
                <span className="w-2 h-2 rounded-full bg-[#e05c00] animate-pulse" />
              </div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-4 break-words w-full max-w-full">
                Brier Score &amp; ECE Confidence Binning
              </h3>
              <p className="text-xs text-[#888] leading-relaxed mb-8 max-w-2xl break-words w-full">
                Quantifies overconfidence by binning stated confidence against actual accuracy outcomes to prevent overconfident hallucinations.
              </p>

              {/* Interactive Visual Box 3 */}
              <div className="w-full max-w-full min-w-0 overflow-hidden bg-[#0d0d0d] border border-[#222] p-4 sm:p-6 mb-6 space-y-4 rounded-sm">
                <div className="flex items-center justify-between border-b border-[#1c1c1c] pb-3 text-xs flex-wrap gap-1">
                  <span className="text-[#888]">Calibration Binned Error</span>
                  <span className="text-[#e05c00] font-bold">Brier Score: 0.042 | ECE: 0.038</span>
                </div>

                {/* Binned Histogram Bars */}
                <div className="space-y-3 pt-2 w-full">
                  {[
                    { range: "Bin 0.8 - 1.0", conf: "92% Conf", acc: "94% Acc", pct: 94 },
                    { range: "Bin 0.6 - 0.8", conf: "74% Conf", acc: "71% Acc", pct: 72 },
                    { range: "Bin 0.4 - 0.6", conf: "51% Conf", acc: "49% Acc", pct: 50 },
                  ].map((bin, k) => (
                    <div key={k} className="space-y-1 w-full">
                      <div className="flex justify-between text-[11px] text-[#aaa] flex-wrap gap-1">
                        <span>{bin.range}</span>
                        <span className="text-[#e05c00]">{bin.conf} vs {bin.acc}</span>
                      </div>
                      <div className="h-2 bg-[#1c1c1c] overflow-hidden rounded-full w-full">
                        <div className="h-full bg-[#e05c00]" style={{ width: `${bin.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <pre className="w-full max-w-full min-w-0 bg-[#040404] border border-[#1c1c1c] p-3.5 sm:p-5 text-[10px] sm:text-xs text-[#aaa] overflow-x-auto rounded-sm leading-relaxed whitespace-pre-wrap sm:whitespace-pre break-all sm:break-normal">
{`# From checks.py — Brier & ECE Calibration Calculation
def compute_brier_score(confidences: list[float], outcomes: list[int]) -> float:
    return float(np.mean([(c - o) ** 2 for c, o in zip(confidences, outcomes)]))`}
              </pre>
            </div>

            {/* Panel 4: Drift Visual Showcase */}
            <div
              ref={el => (featureRefs.current[3] = el)}
              className={`w-full max-w-full min-w-0 overflow-hidden p-4 sm:p-8 md:p-14 py-10 lg:min-h-[750px] flex flex-col justify-center ${
                activeFeature === 3 ? "bg-[#070707]" : "bg-[#000] lg:opacity-60"
              }`}
              style={{
                opacity: visiblePanels.has(3) ? 1 : 0,
                transform: visiblePanels.has(3) ? "translateY(0)" : "translateY(44px)",
                transition: "opacity 0.7s ease 0.05s, transform 0.7s ease 0.05s, background-color 0.5s",
              }}
            >
              <div className="text-xs font-mono text-red-400 uppercase mb-2 font-bold flex items-center gap-2 flex-wrap">
                <span>CHECK 04 / CUSUM DRIFT CONTROL</span>
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              </div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-4 break-words w-full max-w-full">
                One-Sided CUSUM Control Chart
              </h3>
              <p className="text-xs text-[#888] leading-relaxed mb-8 max-w-2xl break-words w-full">
                Tracks cumulative daily performance drop against baseline mean (k=0.5, h=4.0) to catch sustained model regressions before users notice.
              </p>

              {/* Interactive Visual Box 4 */}
              <div className="w-full max-w-full min-w-0 overflow-hidden bg-[#0d0d0d] border border-red-900/60 p-4 sm:p-6 mb-6 space-y-4 rounded-sm shadow-[0_0_25px_rgba(239,68,68,0.1)]">
                <div className="flex items-center justify-between border-b border-[#1c1c1c] pb-3 text-xs flex-wrap gap-1">
                  <span className="text-[#888]">10-Day Rolling Drift Monitor</span>
                  <span className="text-red-400 font-bold">🚨 Drift @ Day 5 (CUSUM = -4.82)</span>
                </div>

                <div className="p-3 bg-red-950/40 border border-red-900/60 text-[11px] sm:text-xs text-red-300 font-mono flex items-center justify-between gap-2 flex-wrap">
                  <span>⚡ CIRCUIT BREAKER TRIPPED — Agent risk_review auto-paused!</span>
                  <span className="px-2 py-0.5 bg-red-900 text-white text-[10px] uppercase font-bold shrink-0">PAUSED</span>
                </div>

                <div className="space-y-2 text-xs text-[#aaa]">
                  <div className="flex justify-between text-[11px] flex-wrap gap-1">
                    <span>Baseline (Days 1-4) Mean Score: 88%</span>
                    <span className="text-emerald-400">NOMINAL</span>
                  </div>
                  <div className="flex justify-between text-[11px] flex-wrap gap-1">
                    <span>Injected Drift (Days 5-10) Mean Score: 52%</span>
                    <span className="text-red-400 font-bold">DRIFT DETECTED</span>
                  </div>
                </div>
              </div>

              <pre className="w-full max-w-full min-w-0 bg-[#040404] border border-[#1c1c1c] p-3.5 sm:p-5 text-[10px] sm:text-xs text-[#aaa] overflow-x-auto rounded-sm leading-relaxed whitespace-pre-wrap sm:whitespace-pre break-all sm:break-normal">
{`# From checks.py — CUSUM Statistical Control Chart Algorithm
def check_cusum_drift(scores: list[float], k=0.5, h=4.0) -> dict:
    mu, std = np.mean(scores[:4]), np.std(scores[:4]) or 0.01
    cusum = 0.0
    for s in scores[4:]:
        z = (s - mu) / std
        cusum = min(0.0, cusum + z + k)
    return {"drift_detected": cusum < -h, "cusum_val": cusum}`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          PROCESS SECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="process" className="border-b border-[#1c1c1c] grid grid-cols-1 lg:grid-cols-2 font-mono">
        <div className="px-7 md:px-12 py-16 md:py-24 border-b lg:border-b-0 lg:border-r border-[#1c1c1c] flex flex-col justify-center">
          <Badge>Production Deployment</Badge>
          <h2 className="font-black text-white leading-[1.1] tracking-tight" style={{ fontSize: "clamp(28px, 3.8vw, 52px)" }}>
            Staged Rollout Plan
          </h2>
        </div>

        <div className="divide-y divide-[#1c1c1c]">
          {[
            {
              num: "01",
              label: "Watch-Only Mode",
              desc: "Log every claim flag, act on nothing. Build baseline confidence in the TF-IDF and CUSUM metrics over real traffic.",
            },
            {
              num: "02",
              label: "Alert a Human",
              desc: "Push flags via Slack webhook to on-call engineers instead of letting issues sit unnoticed in a dashboard.",
            },
            {
              num: "03",
              label: "Circuit Breaker Enabled",
              desc: "Only once proven, enable automatic agent pausing when composite health drops below 40 or drift crosses h=4.0.",
            },
          ].map((step, i) => (
            <div key={i} className="px-7 md:px-12 py-10 flex gap-5 items-start">
              <div className="w-8 h-8 border border-[#3a1a00] bg-[#1a0d00] text-[#e05c00] flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                {step.num}
              </div>
              <div>
                <div className="text-sm font-bold text-white mb-2">{step.label}</div>
                <p className="text-xs text-[#888] leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          FOUNDER / ABOUT SECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="border-b border-[#1c1c1c] grid grid-cols-1 lg:grid-cols-2">
        <div className="relative min-h-[360px] lg:min-h-[480px] bg-[#070707] border-b lg:border-b-0 lg:border-r border-[#1c1c1c] overflow-hidden flex items-end p-8">
          <HalftoneDots focalX={0.3} focalY={0.7} />
          <div className="relative z-10 font-mono">
            <p className="text-white text-sm font-bold">Built for Razorpay AI Builder Role</p>
            <p className="text-[#e05c00] text-[11px] mt-0.5">Aug 2026 Hiring Funnel</p>
          </div>
        </div>

        <div className="px-7 md:px-12 py-16 md:py-20 flex flex-col justify-center font-mono">
          <Badge>Why I Built This</Badge>
          <h2 className="font-black text-white leading-[1.1] tracking-tight mb-6" style={{ fontSize: "clamp(24px, 3vw, 42px)" }}>
            Three posts. One recurring gap.
          </h2>
          <p className="text-[#aaa] text-xs leading-relaxed mb-6">
            While researching Razorpay's engineering blog for this application, I noticed a pattern: three separate posts — about Bumblebee, about Project Viveka, and about the Cosmos/Prism model-routing layer — each independently described fighting the same category of problem (inconsistent verdicts, hallucinated claims, unreliable outputs) with a different one-off fix.
          </p>
          <p className="text-[#aaa] text-xs leading-relaxed mb-8">
            Nobody was watching the fleet of agents as a fleet. That gap is Sentinel.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="self-start border border-[#e05c00] bg-[#1a0d00] text-[#e05c00] hover:bg-[#e05c00] hover:text-black text-xs font-mono uppercase tracking-widest px-6 py-3 transition-all font-semibold"
          >
            Launch Control Tower →
          </button>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          FAQ SECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="faq" className="border-b border-[#1c1c1c]">
        <div className="px-7 md:px-12 py-16 md:py-24">
          <h2 className="font-black text-white leading-tight mb-14" style={{ fontSize: "clamp(32px, 4.5vw, 60px)" }}>
            Got Any Questions?
          </h2>
          <div className="max-w-4xl">
            {faqs.map((faq, i) => (
              <FaqRow key={i} q={faq.q} a={faq.a} defaultOpen={faq.defaultOpen} />
            ))}
          </div>
        </div>
        <div className="w-full h-[28px] border-t border-[#1c1c1c]" style={{ background: "repeating-linear-gradient(45deg,#111 0px,#111 8px,#0a0a0a 8px,#0a0a0a 16px)" }} />
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          CTA BANNER
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="border-b border-[#1c1c1c] relative overflow-hidden flex items-center justify-center py-24 min-h-[420px]">
        <HalftoneDots focalX={0.5} focalY={0.5} className="opacity-90" />

        <div className="relative z-10 bg-[#070707] border border-[#262626] p-10 md:p-12 text-center max-w-sm w-full shadow-2xl rounded-sm font-mono">
          <h3 className="font-black text-white text-[22px] md:text-[26px] leading-tight mb-6">
            Test the live evaluation engine
          </h3>
          <p className="text-xs text-[#888] mb-8">
            Ingest live claims or simulate a 10-day drift run.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full bg-[#e05c00] text-black text-[11px] font-mono font-bold uppercase tracking-widest py-3.5 px-6 hover:bg-[#ff7722] transition-all flex items-center justify-center gap-3 shadow-lg"
          >
            <span>LAUNCH CONTROL TOWER</span>
            <span className="grid grid-cols-3 gap-[2px] bg-black/20 p-1 rounded-sm">
              {Array.from({ length: 9 }).map((_, k) => (
                <span key={k} className="w-[3px] h-[3px] bg-black" />
              ))}
            </span>
          </button>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}
