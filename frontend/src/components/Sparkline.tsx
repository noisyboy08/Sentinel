import React from "react";

interface SparklineProps {
  scores: number[];
  driftDay: number | null;
  width?: number;
  height?: number;
  animate?: boolean;
  visibleDays?: number; // how many days to show (for animation)
}

export function Sparkline({
  scores,
  driftDay,
  width = 200,
  height = 48,
  animate = false,
  visibleDays,
}: SparklineProps) {
  const displayScores = visibleDays !== undefined ? scores.slice(0, visibleDays) : scores;

  if (displayScores.length === 0) {
    return (
      <svg width={width} height={height} className="sparkline">
        <text x={width / 2} y={height / 2} textAnchor="middle" fill="#7C8A9A" fontSize="10">
          No data
        </text>
      </svg>
    );
  }

  const padX = 6;
  const padY = 6;
  const w = width - padX * 2;
  const h = height - padY * 2;

  const minScore = Math.min(...displayScores, 0);
  const maxScore = Math.max(...displayScores, 1);
  const range = maxScore - minScore || 1;

  const toX = (i: number) =>
    padX + (displayScores.length === 1 ? w / 2 : (i / (displayScores.length - 1)) * w);
  const toY = (v: number) => padY + h - ((v - minScore) / range) * h;

  // Build polyline points
  const points = displayScores.map((s, i) => `${toX(i)},${toY(s)}`).join(" ");

  // Area fill path
  const areaPath =
    `M ${toX(0)},${toY(displayScores[0])} ` +
    displayScores.map((s, i) => `L ${toX(i)},${toY(s)}`).join(" ") +
    ` L ${toX(displayScores.length - 1)},${padY + h} L ${toX(0)},${padY + h} Z`;

  // Color based on last value
  const lastScore = displayScores[displayScores.length - 1];
  const lineColor =
    lastScore >= 0.7 ? "#3DD6C4" : lastScore >= 0.4 ? "#E8A33D" : "#E85D4A";

  // Threshold lines at 0.7 (caution) and 0.4 (critical)
  const y70 = toY(0.7);
  const y40 = toY(0.4);

  // Drift marker (only show if driftDay exists and is within visible range)
  const showDrift =
    driftDay !== null &&
    driftDay !== undefined &&
    driftDay < displayScores.length;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="sparkline overflow-visible"
    >
      <defs>
        <linearGradient id={`grad-${lineColor.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Threshold lines */}
      <line
        x1={padX} y1={y70} x2={width - padX} y2={y70}
        stroke="#3DD6C4" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.4"
      />
      <line
        x1={padX} y1={y40} x2={width - padX} y2={y40}
        stroke="#E85D4A" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.4"
      />

      {/* Area fill */}
      <path
        d={areaPath}
        fill={`url(#grad-${lineColor.replace("#", "")})`}
      />

      {/* Main line */}
      <polyline
        points={points}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Drift marker */}
      {showDrift && driftDay !== null && (
        <>
          <line
            x1={toX(driftDay)}
            y1={padY}
            x2={toX(driftDay)}
            y2={padY + h}
            stroke="#E85D4A"
            strokeWidth="1.5"
            strokeDasharray="3,2"
            opacity="0.9"
          />
          <circle
            cx={toX(driftDay)}
            cy={toY(displayScores[driftDay])}
            r={4}
            fill="#E85D4A"
            stroke="#0A0E14"
            strokeWidth="1.5"
          />
          <text
            x={toX(driftDay) + 5}
            y={toY(displayScores[driftDay]) - 5}
            fill="#E85D4A"
            fontSize="8"
            fontFamily="'IBM Plex Mono', monospace"
          >
            drift
          </text>
        </>
      )}

      {/* Last point dot */}
      <circle
        cx={toX(displayScores.length - 1)}
        cy={toY(lastScore)}
        r={3}
        fill={lineColor}
        stroke="#0A0E14"
        strokeWidth="1.5"
      />
    </svg>
  );
}
