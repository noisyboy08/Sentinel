"""Backend implementations — SimulatedBackend (default, no API key needed)
plus optional AnthropicBackend and GeminiBackend stubs.
"""
from __future__ import annotations

import hashlib
import json
import os
import random
import time
from dataclasses import dataclass, field
from typing import Optional

from .schema import AgentOutput, EvalCase


@dataclass
class RawDecision:
    claim: str
    evidence_cited: list[str]
    confidence: float
    model: str
    cost_usd: float
    latency_ms: float


class SimulatedBackend:
    """Deterministic, seeded simulator with three controllable failure modes.

    fault_rates keys:
        inconsistency          — fraction of consistency-pair cases that get a different verdict
        ungrounded_confidence  — fraction of cases where confidence >= 0.9 but evidence = []
        miscalibration         — fraction of labeled cases where agent is confidently wrong
    """

    MODEL_NAME = "simulated-v1"

    def __init__(
        self,
        fault_rates: dict[str, float] | None = None,
        seed: int = 42,
    ):
        self.fault_rates = fault_rates or {}
        self.seed = seed

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _rng(self, case_id: str, fault_type: str) -> random.Random:
        """Return a *deterministic* RNG keyed to (seed, case_id, fault_type)."""
        key = f"{self.seed}:{case_id}:{fault_type}"
        h = int(hashlib.md5(key.encode()).hexdigest(), 16) % (2**31)
        r = random.Random(h)
        return r

    def _should_trigger(self, case_id: str, fault_type: str) -> bool:
        rate = self.fault_rates.get(fault_type, 0.0)
        return self._rng(case_id, fault_type).random() < rate

    # ------------------------------------------------------------------
    # Core decide method
    # ------------------------------------------------------------------

    def decide(self, system_prompt: str, case: EvalCase) -> RawDecision:
        t0 = time.perf_counter()
        result = self._decide_inner(system_prompt, case)
        elapsed = (time.perf_counter() - t0) * 1000  # ms
        result.latency_ms = max(result.latency_ms, elapsed)
        return result

    def _decide_inner(self, system_prompt: str, case: EvalCase) -> RawDecision:
        # --- Fault: ungrounded high confidence ---
        if self._should_trigger(case.case_id, "ungrounded_confidence"):
            return RawDecision(
                claim=f"Based on analysis, the matter requires immediate escalation. (Simulated ungrounded assertion for {case.case_id})",
                evidence_cited=[],
                confidence=0.92,
                model=self.MODEL_NAME,
                cost_usd=0.0001,
                latency_ms=120.0,
            )

        # --- Fault: miscalibration (confidently wrong) ---
        if case.ground_truth and self._should_trigger(case.case_id, "miscalibration"):
            contradicting_claim = f"CONTRADICTED: contrary to the evidence, this case is low priority. (Simulated miscalibration for {case.case_id})"
            return RawDecision(
                claim=contradicting_claim,
                evidence_cited=case.evidence_pool[:1] if case.evidence_pool else [],
                confidence=0.88,
                model=self.MODEL_NAME,
                cost_usd=0.0001,
                latency_ms=130.0,
            )

        # --- Fault: inconsistency (different verdict for duplicate case) ---
        if case.duplicate_of and self._should_trigger(case.case_id, "inconsistency"):
            alt_rng = self._rng(case.case_id, "inconsistency_alt")
            alt_idx = alt_rng.randint(0, max(0, len(case.evidence_pool) - 1))
            alt_evidence = case.evidence_pool[alt_idx: alt_idx + 1] if case.evidence_pool else []
            return RawDecision(
                claim=f"Alternative assessment reached for {case.case_id}: evidence reviewed, outcome differs from original analysis.",
                evidence_cited=alt_evidence,
                confidence=0.75,
                model=self.MODEL_NAME,
                cost_usd=0.0001,
                latency_ms=110.0,
            )

        # --- Nominal path ---
        evidence_rng = self._rng(case.case_id, "evidence_selection")
        n_cite = evidence_rng.randint(
            max(1, len(case.evidence_pool) // 2),
            len(case.evidence_pool)
        ) if case.evidence_pool else 0
        cited = evidence_rng.sample(case.evidence_pool, min(n_cite, len(case.evidence_pool)))

        base_claim = case.ground_truth if case.ground_truth else (
            f"Analysis complete for {case.case_id}: "
            + (cited[0] if cited else "No significant findings.")
        )
        confidence_rng = self._rng(case.case_id, "confidence")
        confidence = round(confidence_rng.uniform(0.65, 0.85), 2)

        return RawDecision(
            claim=base_claim,
            evidence_cited=cited,
            confidence=confidence,
            model=self.MODEL_NAME,
            cost_usd=0.0001,
            latency_ms=95.0,
        )


class AnthropicBackend:
    """Real Anthropic Claude backend — only instantiated when ANTHROPIC_API_KEY is set."""

    MODEL_NAME = "claude-3-5-haiku-20241022"

    def __init__(self, api_key: str):
        try:
            import anthropic  # type: ignore
            self._client = anthropic.Anthropic(api_key=api_key)
        except ImportError as exc:
            raise RuntimeError("pip install anthropic to use AnthropicBackend") from exc

    def decide(self, system_prompt: str, case: EvalCase) -> RawDecision:
        import anthropic  # type: ignore
        evidence_lines = "\n".join(f"[{i}] {e}" for i, e in enumerate(case.evidence_pool))
        user_msg = (
            f"Case: {case.input_payload}\n\n"
            f"Evidence pool:\n{evidence_lines}\n\n"
            "Respond ONLY with JSON: "
            '{"claim": "...", "evidence_indices": [0,1,...], "confidence": 0.0}'
        )
        t0 = time.perf_counter()
        resp = self._client.messages.create(
            model=self.MODEL_NAME,
            max_tokens=512,
            system=system_prompt,
            messages=[{"role": "user", "content": user_msg}],
        )
        elapsed = (time.perf_counter() - t0) * 1000
        raw = resp.content[0].text
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            import re
            m = re.search(r"\{.*\}", raw, re.DOTALL)
            data = json.loads(m.group()) if m else {"claim": raw, "evidence_indices": [], "confidence": 0.5}

        indices = [int(i) for i in data.get("evidence_indices", [])]
        cited = [case.evidence_pool[i] for i in indices if 0 <= i < len(case.evidence_pool)]
        usage = resp.usage
        cost = (usage.input_tokens * 0.25 + usage.output_tokens * 1.25) / 1_000_000
        return RawDecision(
            claim=data.get("claim", ""),
            evidence_cited=cited,
            confidence=float(data.get("confidence", 0.5)),
            model=self.MODEL_NAME,
            cost_usd=cost,
            latency_ms=elapsed,
        )


class GeminiBackend:
    """Real Gemini backend — only instantiated when GEMINI_API_KEY is set."""

    MODEL_NAME = "gemini-1.5-flash"

    def __init__(self, api_key: str):
        try:
            import google.generativeai as genai  # type: ignore
            genai.configure(api_key=api_key)
            self._model = genai.GenerativeModel(self.MODEL_NAME)
        except ImportError as exc:
            raise RuntimeError("pip install google-generativeai to use GeminiBackend") from exc

    def decide(self, system_prompt: str, case: EvalCase) -> RawDecision:
        evidence_lines = "\n".join(f"[{i}] {e}" for i, e in enumerate(case.evidence_pool))
        prompt = (
            f"{system_prompt}\n\n"
            f"Case: {case.input_payload}\n\n"
            f"Evidence pool:\n{evidence_lines}\n\n"
            "Respond ONLY with JSON: "
            '{"claim": "...", "evidence_indices": [0,1,...], "confidence": 0.0}'
        )
        t0 = time.perf_counter()
        resp = self._model.generate_content(prompt)
        elapsed = (time.perf_counter() - t0) * 1000
        raw = resp.text
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            import re
            m = re.search(r"\{.*\}", raw, re.DOTALL)
            data = json.loads(m.group()) if m else {"claim": raw, "evidence_indices": [], "confidence": 0.5}

        indices = [int(i) for i in data.get("evidence_indices", [])]
        cited = [case.evidence_pool[i] for i in indices if 0 <= i < len(case.evidence_pool)]
        return RawDecision(
            claim=data.get("claim", ""),
            evidence_cited=cited,
            confidence=float(data.get("confidence", 0.5)),
            model=self.MODEL_NAME,
            cost_usd=0.0,  # Gemini free tier doesn't expose usage easily
            latency_ms=elapsed,
        )


def get_best_available_backend(
    fault_rates: dict[str, float] | None = None,
    seed: int = 42,
) -> SimulatedBackend | AnthropicBackend | GeminiBackend:
    """Return a real backend if API keys are configured, else the simulator."""
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")
    if anthropic_key:
        return AnthropicBackend(api_key=anthropic_key)
    if gemini_key:
        return GeminiBackend(api_key=gemini_key)
    return SimulatedBackend(fault_rates=fault_rates, seed=seed)
