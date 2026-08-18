import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/Landing";
import SolutionsPage from "./pages/Solutions";
import CaseStudyPage from "./pages/CaseStudy";
import PricingPage from "./pages/Pricing";
import AboutPage from "./pages/About";
import Dashboard from "./pages/Dashboard";
import AgentDetail from "./pages/AgentDetail";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/solutions" element={<SolutionsPage />} />
        <Route path="/case-study" element={<CaseStudyPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/agents/:id" element={<AgentDetail />} />
      </Routes>
    </BrowserRouter>
  );
}
