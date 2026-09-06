"""Multi-day drift simulation — runs the full eval fleet once per simulated day."""
from __future__ import annotations

from dataclasses import dataclass

from .checks import detect_drift, DriftResult
from .tower import evaluate_agent, AgentEvalResult


@dataclass
class DayResult:
    day: int
    composite_score: float
    avg_groundedness: float
    avg_consistency: float
    brier_score: float


@dataclass
class AgentSimResult:
    agent_id: str
    daily_composite_scores: list[float]
    day_results: list[DayResult]
    drift: DriftResult


def run_simulation(days: int = 10, seed: int = 42) -> dict[str, AgentSimResult]:
    """Run the mock fleet for `days` simulated days and compute drift per agent.

    Returns a mapping of agent_id -> AgentSimResult.
    The risk_review agent will show drift from day 5 onwards due to its
    elevated inconsistency fault rate (see mock_fleet.build_fleet).
    """
    from agents.mock_fleet import build_fleet

    agent_daily: dict[str, list[DayResult]] = {}

    for day in range(days):
        fleet = build_fleet(seed=seed, day=day)
        for agent in fleet:
            result: AgentEvalResult = evaluate_agent(agent)
            dr = DayResult(
                day=day,
                composite_score=result.composite_score,
                avg_groundedness=result.avg_groundedness,
                avg_consistency=result.avg_consistency,
                brier_score=result.calibration.brier_score,
            )
            agent_daily.setdefault(agent.agent_id, []).append(dr)

    results: dict[str, AgentSimResult] = {}
    for agent_id, day_results in agent_daily.items():
        daily_scores = [d.composite_score for d in day_results]
        drift = detect_drift(daily_scores)
        results[agent_id] = AgentSimResult(
            agent_id=agent_id,
            daily_composite_scores=daily_scores,
            day_results=day_results,
            drift=drift,
        )

    return results
