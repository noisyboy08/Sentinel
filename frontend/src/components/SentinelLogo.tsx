import React from "react";
import symbolOnlyImg from "../image/Symbol_only.png";

interface SentinelLogoProps {
  className?: string;
  size?: number;
}

export function SentinelLogo({ className = "", size = 32 }: SentinelLogoProps) {
  return (
    <img
      src={symbolOnlyImg}
      alt="Sentinel Emblem"
      className={`object-contain filter drop-shadow-[0_0_8px_rgba(168,85,247,0.6)] transition-transform hover:scale-105 ${className}`}
      style={{ height: size, width: "auto" }}
    />
  );
}
