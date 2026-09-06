"""Base Agent wrapper — persona + backend."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.schema import AgentOutput, EvalCase


@dataclass
class Agent:
    agent_id: str
    persona_prompt: str
    backend: Any  # SimulatedBackend | AnthropicBackend | GeminiBackend

    def run(self, case: EvalCase) -> AgentOutput:
        """Run a single eval case and return a structured AgentOutput."""
        raw = self.backend.decide(self.persona_prompt, case)
        return AgentOutput(
            agent_id=self.agent_id,
            case_id=case.case_id,
            claim=raw.claim,
            evidence_cited=raw.evidence_cited,
            confidence=raw.confidence,
            cost_usd=raw.cost_usd,
            latency_ms=raw.latency_ms,
            model=raw.model,
        )
