import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

export function HeaderNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const links = [
    { label: "Solutions", path: "/solutions" },
    { label: "The Real Problem", path: "/case-study" },
    { label: "Roadmap", path: "/pricing" },
    { label: "About", path: "/about" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-[#000] border-b border-[#1c1c1c]">
      <div className="flex items-center justify-between h-[56px] px-6 md:px-10">
        {/* Left: brand + separator + nav links */}
        <div className="flex items-center gap-0">
          <Link
            to="/"
            className="font-black text-white text-[18px] tracking-tight uppercase mr-4 hover:text-[#e05c00] transition-colors"
          >
            Sentinel
          </Link>
          <span className="text-[#2a2a2a] mr-4 text-lg font-light">/</span>
          <div className="hidden sm:flex items-center gap-6 text-[11px] uppercase tracking-widest font-medium text-[#666]">
            {links.map((link) => {
              const active = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`transition-colors duration-150 ${
                    active ? "text-white font-bold text-[#e05c00]" : "hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right: Dashboard CTA */}
        <button
          onClick={() => navigate("/dashboard")}
          className="border border-[#e05c00] bg-[#1a0d00] text-[#e05c00] hover:bg-[#e05c00] hover:text-black text-[11px] uppercase tracking-widest font-semibold px-4 py-2 transition-all duration-150 flex items-center gap-1.5 font-mono"
        >
          Launch Dashboard <span className="text-base leading-none">→</span>
        </button>
      </div>
    </nav>
  );
}
