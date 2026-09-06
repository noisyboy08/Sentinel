import React, { useEffect, useRef } from "react";

interface DotGridProps {
  className?: string;
  intensity?: number;
}

export function DotGridBackground({ className = "", intensity = 1 }: DotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 600;
      canvas.height = canvas.parentElement?.clientHeight || 600;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      t += 0.008;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const spacing = 18;
      const cols = Math.ceil(canvas.width / spacing) + 1;
      const rows = Math.ceil(canvas.height / spacing) + 1;
      // focal: bottom-right for hero, top-left for CTA etc.
      const fx = canvas.width * 0.85;
      const fy = canvas.height * 0.65;
      const maxD = Math.sqrt(canvas.width ** 2 + canvas.height ** 2) * 0.55;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * spacing;
          const y = j * spacing;
          const dx = x - fx;
          const dy = y - fy;
          const d = Math.sqrt(dx * dx + dy * dy);
          const prox = Math.max(0, 1 - d / maxD);
          const wave = Math.sin(t * 1.2 + i * 0.18 + j * 0.14) * 0.35 + 0.65;
          const alpha = Math.pow(prox, 1.8) * wave * intensity;
          if (alpha < 0.01) continue;
          const r = 1.2 + prox * 2.8;
          // Bright center → dimmer edges: orange to amber gradient
          const red = Math.round(255);
          const green = Math.round(80 + prox * 60);
          const blue = 0;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${red},${green},${blue},${alpha.toFixed(3)})`;
          ctx.fill();
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animId);
    };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
    />
  );
}
