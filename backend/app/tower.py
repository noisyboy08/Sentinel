"""Orchestrator — runs every agent through every check and computes composite health scores."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

from .schema import AgentOutput, EvalCase
from .checks import (
    groundedness_score,
    is_ungrounded_high_confidence,
    consistency_score,
    is_inconsistent,
    is_correct,
    calibration_report,
    CalibrationReport,
    _get_ground_truth_override,
)
from .razorpay_data import fetch_payment_evidence

EVAL_SETS_DIR = Path(__file__).parent.parent / "eval_sets"

# On serverless platforms (Vercel) the deploy directory is read-only; use /tmp.
_on_serverless = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
_DATA_DIR = (
    Path("/tmp/sentinel_data")
    if _on_serverless
    else Path(__file__).parent.parent / "data"
)
_HISTORY_FILE = _DATA_DIR / "history.json"


def load_eval_cases(agent_id: str) -> list[EvalCase]:
    path = EVAL_SETS_DIR / f"{agent_id}_cases.json"
    if path.exists():
        with open(path) as f:
            data = json.load(f)
        return [EvalCase(**d) for d in data]

    # Dynamic fallback cases for custom registered agents
    return [
        EvalCase(
            case_id=f"{agent_id}-001",
            agent_id=agent_id,
            input_payload=f"Custom production case for agent {agent_id}. Evaluate task.",
            evidence_pool=[
                f"Verified system log for {agent_id} execution.",
                "Policy compliance guidelines matched.",
                "API credentials verified.",
            ],
            ground_truth="Approved: all policy guidelines and logs matched.",
            tags=["custom_agent", "nominal"],
        ),
        EvalCase(
            case_id=f"{agent_id}-002",
            agent_id=agent_id,
            input_payload=f"Custom production case for agent {agent_id} (paraphrase variant). Evaluate task.",
            evidence_pool=[
                f"Verified system log for {agent_id} execution.",
                "Policy compliance guidelines matched.",
                "API credentials verified.",
            ],
            ground_truth="Approved: all policy guidelines and logs matched.",
            duplicate_of=f"{agent_id}-001",
            tags=["custom_agent", "consistency_pair"],
        ),
    ]


@dataclass
class IncidentFlag:
    agent_id: str
    flag_type: str   # "ungrounded", "inconsistent", "miscalibrated", "drift", "paused"
    detail: str
    case_id: str | None = None
    timestamp: str = ""


@dataclass
class ConsistencyPairResult:
    case_id_a: str
    case_id_b: str
    claim_a: str
    claim_b: str
    score: float
    flagged: bool


@dataclass
class AgentEvalResult:
    agent_id: str
    outputs: list[AgentOutput]
    groundedness_scores: list[float]
    avg_groundedness: float
    ungrounded_flags: list[IncidentFlag]
    consistency_pairs: list[ConsistencyPairResult]
    avg_consistency: float
    calibration: CalibrationReport
    composite_score: float
    total_cost_usd: float
    avg_latency_ms: float
    incidents: list[IncidentFlag]
    has_live_corrections: bool = False  # True if any ground_truth_corrections entry matches this agent's case_ids


def compute_composite(
    avg_groundedness: float,
    avg_consistency: float,
    brier_score: float,
) -> float:
    """Composite health score per spec §1.4:
    composite = (0.45 * avg_groundedness + 0.35 * avg_consistency - 0.20 * brier_score) / (0.45 + 0.35)
    Clamped to [0, 1].
    """
    raw = (0.45 * avg_groundedness + 0.35 * avg_consistency - 0.20 * brier_score) / (0.45 + 0.35)
    return max(0.0, min(1.0, round(raw, 4)))


def evaluate_agent(agent, cases: list[EvalCase] | None = None) -> AgentEvalResult:
    """Run one agent through all its eval cases and return a full result."""
    from datetime import datetime, timezone

    if cases is None:
        cases = load_eval_cases(agent.agent_id)

    # --- Phase C: Enrich evidence_pool with real Razorpay payment data ---
    # For any case whose case_id looks like a Razorpay payment ID (pay_*),
    # fetch live details from the Payments API and append them to evidence_pool.
    # fetch_payment_evidence() is a no-op (returns []) when:
    #   - RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured, OR
    #   - the case_id does not start with 'pay_'
    # So this loop adds zero overhead for all existing static eval-set cases.
    enriched_cases: list[EvalCase] = []
    for case in cases:
        live_evidence = fetch_payment_evidence(case.case_id)
        if live_evidence:
            # Prepend real data so the agent sees it first, then static fallback
            merged = live_evidence + list(case.evidence_pool)
            case = case.model_copy(update={"evidence_pool": merged})
        enriched_cases.append(case)
    cases = enriched_cases
    # --------------------------------------------------------------------------

    now = datetime.now(timezone.utc).isoformat()

    # --- Run all cases ---
    outputs: list[AgentOutput] = []
    for case in cases:
        out = agent.run(case)
        out.timestamp = datetime.now(timezone.utc)
        outputs.append(out)

    case_map = {c.case_id: c for c in cases}
    output_map = {o.case_id: o for o in outputs}

    # --- Groundedness ---
    g_scores = [groundedness_score(o) for o in outputs]
    avg_g = sum(g_scores) / len(g_scores) if g_scores else 0.0
    ungrounded_flags: list[IncidentFlag] = []
    for o in outputs:
        if is_ungrounded_high_confidence(o):
            ungrounded_flags.append(IncidentFlag(
                agent_id=agent.agent_id,
                flag_type="ungrounded",
                detail=f"Confidence {o.confidence:.2f} but groundedness {groundedness_score(o):.2f} on case {o.case_id}",
                case_id=o.case_id,
                timestamp=now,
            ))

    # --- Consistency ---
    consistency_pairs: list[ConsistencyPairResult] = []
    for case in cases:
        if case.duplicate_of and case.duplicate_of in output_map and case.case_id in output_map:
            o_orig = output_map[case.duplicate_of]
            o_dup = output_map[case.case_id]
            score = consistency_score(o_orig.claim, o_dup.claim)
            flagged = is_inconsistent(o_orig.claim, o_dup.claim)
            consistency_pairs.append(ConsistencyPairResult(
                case_id_a=case.duplicate_of,
                case_id_b=case.case_id,
                claim_a=o_orig.claim,
                claim_b=o_dup.claim,
                score=round(score, 4),
                flagged=flagged,
            ))

    consistency_scores_list = [p.score for p in consistency_pairs] if consistency_pairs else [avg_g]
    avg_consistency = sum(consistency_scores_list) / len(consistency_scores_list)

    # --- Calibration ---
    # Load any ground-truth corrections recorded from real Razorpay webhook events.
    # Kept read-only here; checks.py stays pure (no file I/O inside it).
    _gt_corrections: list[dict] = []
    try:
        _gt_corrections = (
            json.loads(_HISTORY_FILE.read_text())
            .get("ground_truth_corrections", [])
        )
    except Exception:
        _gt_corrections = []

    labeled_pairs: list[tuple[AgentOutput, bool]] = []
    for o in outputs:
        case = case_map.get(o.case_id)
        if case:
            override = _get_ground_truth_override(o.case_id, _gt_corrections)
            scored_case = (
                case.model_copy(update={"ground_truth": override})
                if override is not None
                else case
            )
            outcome = is_correct(o, scored_case)
            if outcome is not None:
                labeled_pairs.append((o, outcome))
    cal = calibration_report(labeled_pairs)

    # --- Data provenance: did any real Razorpay correction apply to this agent? ---
    # Reuses _gt_corrections (already loaded above) and case_map — zero extra file I/O.
    _agent_case_ids = set(case_map.keys())
    has_live_corrections = any(
        c.get("case_id") in _agent_case_ids for c in _gt_corrections
    )

    # --- Composite ---
    composite = compute_composite(avg_g, avg_consistency, cal.brier_score)

    # --- Build full incident list ---
    incidents: list[IncidentFlag] = list(ungrounded_flags)
    for pair in consistency_pairs:
        if pair.flagged:
            incidents.append(IncidentFlag(
                agent_id=agent.agent_id,
                flag_type="inconsistent",
                detail=f"Inconsistent pair: {pair.case_id_a} vs {pair.case_id_b} (score {pair.score:.2f})",
                case_id=pair.case_id_b,
                timestamp=now,
            ))

    total_cost = sum(o.cost_usd for o in outputs)
    avg_lat = sum(o.latency_ms for o in outputs) / len(outputs) if outputs else 0.0

    return AgentEvalResult(
        agent_id=agent.agent_id,
        outputs=outputs,
        groundedness_scores=g_scores,
        avg_groundedness=round(avg_g, 4),
        ungrounded_flags=ungrounded_flags,
        consistency_pairs=consistency_pairs,
        avg_consistency=round(avg_consistency, 4),
        calibration=cal,
        composite_score=composite,
        total_cost_usd=round(total_cost, 6),
        avg_latency_ms=round(avg_lat, 2),
        incidents=incidents,
        has_live_corrections=has_live_corrections,
    )
