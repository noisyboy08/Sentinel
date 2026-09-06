"""Shared output contract — every agent (mock or real) must produce these shapes."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class AgentOutput(BaseModel):
    agent_id: str
    case_id: str
    claim: str                    # the agent's decision/conclusion, in prose
    evidence_cited: list[str]     # subset of the case's evidence_pool the agent actually cited
    confidence: float             # self-reported, 0.0–1.0
    cost_usd: float
    latency_ms: float
    model: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EvalCase(BaseModel):
    case_id: str
    agent_id: str
    input_payload: str
    evidence_pool: list[str]      # everything the agent COULD cite
    ground_truth: Optional[str] = None   # enables calibration scoring when present
    duplicate_of: Optional[str] = None  # if set, this case is a paraphrase of another case_id
    tags: list[str] = Field(default_factory=list)
