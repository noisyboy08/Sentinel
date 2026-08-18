import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

/* ─────────────────────────────────────────────────────────────────────────────
   DOT MATRIX SENTINEL CANVAS — fills the entire footer with gray dots,
   SENTINEL letters glow orange on top of the gray dot grid.
   Dynamically scales dot size & grid step so SENTINEL is 100% visible and
   perfectly centered on all viewports (320px mobile to 4K desktop).
───────────────────────────────────────────────────────────────────────────── */
function SentinelDotMatrix() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    let t = 0;

    // 5×7 bitmaps for each letter of "SENTINEL"
    const font5x7: Record<string, number[]> = {
      S: [0x0e, 0x11, 0x10, 0x0e, 0x01, 0x11, 0x0e],
      E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
      N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
      T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
      I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
      L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
    };

    const word = "SENTINEL";
    const CHAR_COLS = 5;
    const CHAR_GAP  = 2;
    const totalLetterCols = word.length * CHAR_COLS + (word.length - 1) * CHAR_GAP; // 54 cols

    const resize = () => {
      const parent = canvas.parentElement;
      canvas.width  = parent ? parent.clientWidth  : 1200;
      canvas.height = parent ? parent.clientHeight : 280;
    };
    resize();

    const resizeObserver = new ResizeObserver(resize);
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

    const draw = () => {
      t += 0.022;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      /* ── DYNAMIC RESPONSIVE GRID CALCULATIONS ──
         Ensure 54 letter columns fit with margin on any canvas width */
      const marginX = 12;
      const availableW = Math.max(280, canvas.width - marginX * 2);

      // Total grid columns (at least 56 cols to fit 54 letter cols + 2 margin cols)
      const maxColStep = 14;
      const desiredCols = Math.max(56, Math.floor(availableW / maxColStep));
      const STEP = availableW / desiredCols; // Dynamic step size in px
      const DOT  = Math.max(2.5, Math.min(9, STEP - 2)); // Dynamic dot size
      const PAD  = (STEP - DOT) / 2;

      const gridCols = desiredCols;
      const gridRows = Math.max(9, Math.ceil(canvas.height / STEP));

      /* ── Where to centre SENTINEL word on the grid ── */
      const centerGridX = Math.max(1, Math.floor((gridCols - totalLetterCols) / 2));
      const centerGridY = Math.max(1, Math.floor((gridRows - 7) / 2));

      /* ── Build letter cell set at centered position ── */
      const letterCells = new Set<string>();
      let curCol = 0;
      for (let ci = 0; ci < word.length; ci++) {
        const glyph = font5x7[word[ci]] || [];
        for (let row = 0; row < 7; row++) {
          const bits = glyph[row] || 0;
          for (let col = 0; col < CHAR_COLS; col++) {
            const isSet = (bits & (1 << (CHAR_COLS - 1 - col))) !== 0;
            if (isSet) {
              const gx = centerGridX + curCol + col;
              const gy = centerGridY + row;
              letterCells.add(`${gx},${gy}`);
            }
          }
        }
        curCol += CHAR_COLS + CHAR_GAP;
      }

      /* ── Draw grid cells ── */
      for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
          const cx = marginX + col * STEP + PAD;
          const cy = row * STEP + PAD;

          if (letterCells.has(`${col},${row}`)) {
            /* === ORANGE GLOWING LETTER DOT === */
            const wave     = Math.sin(t * 2.2 + col * 0.18 + row * 0.1);
            const pulse    = 0.72 + wave * 0.28;
            const g        = Math.round(80 + wave * 50); // 80-130 → deep orange → bright orange

            // Glow halo (scaled by DOT size)
            const haloR = DOT * 1.5;
            const grd = ctx.createRadialGradient(cx + DOT/2, cy + DOT/2, 0, cx + DOT/2, cy + DOT/2, haloR);
            grd.addColorStop(0, `rgba(255,${g},0,${(pulse * 0.35).toFixed(2)})`);
            grd.addColorStop(1, "rgba(255,80,0,0)");
            ctx.fillStyle = grd;
            ctx.fillRect(cx - DOT * 0.5, cy - DOT * 0.5, DOT * 2, DOT * 2);

            // Solid letter dot
            ctx.fillStyle = `rgba(255, ${g}, 0, ${pulse.toFixed(2)})`;
            ctx.fillRect(cx, cy, DOT, DOT);
          } else {
            /* === GRAY BACKGROUND DOT === */
            const proximity = 1 - Math.min(1,
              Math.sqrt(
                ((col - gridCols / 2) / gridCols) ** 2 +
                ((row - gridRows / 2) / gridRows) ** 2
              ) * 2.2
            );
            const shimmer  = Math.sin(t * 0.6 + col * 0.08 + row * 0.06) * 0.04;
            const base     = 0.10 + proximity * 0.12 + shimmer;
            const g        = Math.round(28 + proximity * 18);
            ctx.fillStyle  = `rgba(${g}, ${g}, ${g}, ${Math.max(0.08, base).toFixed(2)})`;
            ctx.fillRect(cx, cy, DOT, DOT);
          }
        }
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

/* ─────────────────────────────────────────────────────────────────────────────
   FOOTER SECTION
───────────────────────────────────────────────────────────────────────────── */
export function FooterSection() {
  return (
    <footer className="bg-[#000] border-t border-[#1c1c1c] w-full max-w-full overflow-hidden">
      {/* Top links bar */}
      <div className="px-5 sm:px-8 md:px-12 py-10 sm:py-16 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 border-b border-[#1c1c1c]">
        {/* Brand col */}
        <div className="col-span-2 md:col-span-1">
          <div className="font-mono font-black text-white text-[15px] sm:text-[16px] tracking-widest uppercase mb-3 flex items-center gap-2">
            <span className="text-[#e05c00]">::</span> SENTINEL AI
          </div>
          <p className="text-[#555] text-xs leading-relaxed max-w-[240px] font-mono">
            AI agent reliability control tower built for Razorpay's AI Builder role.
          </p>
        </div>

        {/* Explore */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#444] mb-4 font-semibold">
            EXPLORE
          </div>
          <ul className="space-y-2.5 text-xs text-[#777] font-mono">
            <li><Link to="/solutions" className="hover:text-white transition-colors">Solutions</Link></li>
            <li><Link to="/case-study" className="hover:text-white transition-colors">The Real Problem</Link></li>
            <li><Link to="/pricing" className="hover:text-white transition-colors">Roadmap</Link></li>
            <li><Link to="/about" className="hover:text-white transition-colors">About</Link></li>
            <li><Link to="/dashboard" className="hover:text-white transition-colors">Live Control Tower</Link></li>
          </ul>
        </div>

        {/* Reliability Checks */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#444] mb-4 font-semibold">
            RELIABILITY CHECKS
          </div>
          <ul className="space-y-2.5 text-xs text-[#777] font-mono">
            <li><Link to="/solutions" className="hover:text-white transition-colors">Groundedness (TF-IDF)</Link></li>
            <li><Link to="/solutions" className="hover:text-white transition-colors">Paraphrase Consistency</Link></li>
            <li><Link to="/solutions" className="hover:text-white transition-colors">Calibration (Brier &amp; ECE)</Link></li>
            <li><Link to="/solutions" className="hover:text-white transition-colors">Drift Detection (CUSUM)</Link></li>
          </ul>
        </div>

        {/* Research */}
        <div className="col-span-2 md:col-span-1">
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#444] mb-4 font-semibold">
            RAZORPAY RESEARCH
          </div>
          <ul className="space-y-2.5 text-xs text-[#777] font-mono">
            <li><a href="https://engineering.razorpay.com/meet-bumblebee-the-multi-agent-ai-architecture-that-changed-fraud-detection-at-razorpay-c2b6d5704f51" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Bumblebee Risk Architecture</a></li>
            <li><a href="https://dev.to/razorpaytech/project-viveka-a-multi-agent-ai-that-does-root-cause-analysis-in-under-90-seconds-4g44" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Project Viveka RCA Agent</a></li>
            <li><a href="https://engineering.razorpay.com/how-we-turned-5-hours-of-rca-writing-into-10-minutes-of-review-3a154e69c8ec" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Cosmos/Prism Model Router</a></li>
            <li><a href="https://razorpay.com/blog/razorpay-agent-studio-principles-guardrails-and-merchant-control/" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Agent Studio Marketplace</a></li>
          </ul>
        </div>
      </div>

      {/* Sub-footer copyright bar */}
      <div className="px-5 sm:px-8 md:px-12 py-5 border-b border-[#1c1c1c] flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <p className="text-[#444] text-[11px] font-mono">
          Built for <span className="text-white font-semibold">Razorpay AI Builder Role</span> · Aug 2026
        </p>
        <div className="flex items-center gap-5">
          <Link
            to="/dashboard"
            className="text-[#e05c00] hover:text-[#ff7722] transition-colors text-xs font-mono font-bold uppercase tracking-widest"
          >
            ⚡ Launch Control Tower →
          </Link>
        </div>
      </div>

      {/* ── MEGA DOT-MATRIX SENTINEL FOOTER BANNER ──
          Full-width gray dot grid wall, with SENTINEL glowing orange in the middle.
          Responsive height: 180px on mobile, 240px on tablet, 300px on desktop */}
      <div
        className="relative overflow-hidden w-full select-none h-[180px] sm:h-[240px] md:h-[300px]"
        style={{ background: "#000" }}
      >
        <SentinelDotMatrix />
      </div>
    </footer>
  );
}
