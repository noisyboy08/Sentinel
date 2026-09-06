"""Evaluation checks — groundedness, consistency, calibration, drift.

All implementations use specific, standard techniques as specified in §1.3.
"""
from __future__ import annotations

import collections
import math
from dataclasses import dataclass
from typing import Optional

from .schema import AgentOutput, EvalCase


# ---------------------------------------------------------------------------
# Groundedness
# ---------------------------------------------------------------------------

def groundedness_score(output: AgentOutput) -> float:
    """TF-IDF cosine similarity between the claim and joined evidence_cited.
    Returns 0.0 if nothing was cited.
    """
    if not output.evidence_cited:
        return 0.0
    evidence_text = " ".join(output.evidence_cited)
    return _cosine_similarity(output.claim, evidence_text)


def is_ungrounded_high_confidence(output: AgentOutput) -> bool:
    """Flag when confidence >= 0.6 AND groundedness < 0.25."""
    return output.confidence >= 0.6 and groundedness_score(output) < 0.25


# ---------------------------------------------------------------------------
# Consistency
# ---------------------------------------------------------------------------

def consistency_score(claim_a: str, claim_b: str) -> float:
    """TF-IDF cosine similarity between two claims.
    Flagged as inconsistent if score < 0.5.
    """
    return _cosine_similarity(claim_a, claim_b)


def is_inconsistent(claim_a: str, claim_b: str) -> bool:
    return consistency_score(claim_a, claim_b) < 0.5


# ---------------------------------------------------------------------------
# Correctness helper
# ---------------------------------------------------------------------------

def is_correct(output: AgentOutput, case: EvalCase) -> Optional[bool]:
    """None when no ground truth; otherwise checks membership and non-contradiction."""
    if case.ground_truth is None:
        return None
    return (case.ground_truth in output.claim) and ("CONTRADICTED" not in output.claim)


def _get_ground_truth_override(case_id: str, corrections: list[dict]) -> Optional[str]:
    """Return the first corrected_truth from *corrections* whose case_id matches,
    or None if no match exists.  Pure function — no file I/O.
    """
    for entry in corrections:
        if entry.get("case_id") == case_id:
            return entry.get("corrected_truth")
    return None


# ---------------------------------------------------------------------------
# Calibration
# ---------------------------------------------------------------------------

@dataclass
class CalibrationBin:
    lower: float
    upper: float
    count: int
    avg_confidence: float
    accuracy: float


@dataclass
class CalibrationReport:
    n_labeled: int
    brier_score: float
    expected_calibration_error: float
    bins: list[CalibrationBin]


def calibration_report(pairs: list[tuple[AgentOutput, bool]]) -> CalibrationReport:
    """Compute Brier score and ECE over (output, outcome) pairs.

    Args:
        pairs: list of (AgentOutput, bool) — outcome True means prediction was correct.

    Returns:
        CalibrationReport with brier_score, expected_calibration_error, and per-bin data.
    """
    if not pairs:
        return CalibrationReport(
            n_labeled=0,
            brier_score=0.0,
            expected_calibration_error=0.0,
            bins=[],
        )

    n = len(pairs)

    # Brier score
    brier = sum((o.confidence - (1.0 if outcome else 0.0)) ** 2 for o, outcome in pairs) / n

    # ECE — 5 equal-width bins [0.0, 0.2), [0.2, 0.4), ..., [0.8, 1.0]
    bin_edges = [i / 5 for i in range(6)]  # 0.0, 0.2, 0.4, 0.6, 0.8, 1.0
    bins: list[CalibrationBin] = []
    ece = 0.0

    for i in range(5):
        lo, hi = bin_edges[i], bin_edges[i + 1]
        bin_pairs = [
            (o, out) for o, out in pairs
            if lo <= o.confidence < hi or (hi == 1.0 and o.confidence == 1.0)
        ]
        if bin_pairs:
            avg_conf = sum(o.confidence for o, _ in bin_pairs) / len(bin_pairs)
            accuracy = sum(1 for _, out in bin_pairs if out) / len(bin_pairs)
            ece += (len(bin_pairs) / n) * abs(avg_conf - accuracy)
            bins.append(CalibrationBin(
                lower=lo, upper=hi,
                count=len(bin_pairs),
                avg_confidence=round(avg_conf, 4),
                accuracy=round(accuracy, 4),
            ))
        else:
            bins.append(CalibrationBin(lower=lo, upper=hi, count=0, avg_confidence=0.0, accuracy=0.0))

    return CalibrationReport(
        n_labeled=n,
        brier_score=round(brier, 4),
        expected_calibration_error=round(ece, 4),
        bins=bins,
    )


# ---------------------------------------------------------------------------
# Drift detection — one-sided CUSUM
# ---------------------------------------------------------------------------

@dataclass
class DriftResult:
    drift_detected: bool
    drift_day: Optional[int]
    cusum_series: list[float]


def detect_drift(
    daily_scores: list[float],
    baseline_window: int = 4,
    k: float = 0.5,
    h: float = 4.0,
) -> DriftResult:
    """One-sided CUSUM control chart (downward shift detection).

    Args:
        daily_scores: list of daily composite health scores (float in [0,1]).
        baseline_window: number of initial days used to estimate mean/std.
        k: allowance parameter (in σ units).
        h: decision threshold (in σ units) — triggers when cusum < -h.

    Returns:
        DriftResult with drift_detected flag, first drift_day index, and full cusum_series.
    """
    if len(daily_scores) <= baseline_window:
        return DriftResult(drift_detected=False, drift_day=None, cusum_series=[])

    baseline = daily_scores[:baseline_window]
    mu = sum(baseline) / len(baseline)
    variance = sum((x - mu) ** 2 for x in baseline) / len(baseline)
    sigma = math.sqrt(variance) if variance > 0 else 1e-6

    cusum = 0.0
    cusum_series: list[float] = []
    drift_day: Optional[int] = None

    for i, score in enumerate(daily_scores):
        z = (score - mu) / sigma
        cusum = min(0.0, cusum + z + k)
        cusum_series.append(round(cusum, 4))
        if cusum < -h and drift_day is None:
            drift_day = i

    return DriftResult(
        drift_detected=drift_day is not None,
        drift_day=drift_day,
        cusum_series=cusum_series,
    )


# ---------------------------------------------------------------------------
# Internal helper — pure-Python TF-IDF cosine similarity (no sklearn)
# ---------------------------------------------------------------------------

def _tokenize(text: str) -> list[str]:
    """Lowercase, split on non-alphanumeric characters."""
    import re
    return re.findall(r"[a-z0-9]+", text.lower())


def _tfidf_vector(tokens: list[str], idf: dict[str, float]) -> dict[str, float]:
    """Compute TF-IDF vector for a list of tokens given a precomputed IDF dict."""
    tf = collections.Counter(tokens)
    total = len(tokens) or 1
    return {t: (count / total) * idf.get(t, 0.0) for t, count in tf.items()}


def _cosine_similarity(text_a: str, text_b: str) -> float:
    """Compute TF-IDF cosine similarity between two text strings.
    Pure Python implementation — no external dependencies.
    Returns 0.0 when either string is empty/whitespace.
    """
    a = (text_a or "").strip()
    b = (text_b or "").strip()
    if not a or not b:
        return 0.0
    try:
        tok_a = _tokenize(a)
        tok_b = _tokenize(b)
        if not tok_a or not tok_b:
            return 0.0

        # IDF over the two-document corpus
        vocab = set(tok_a) | set(tok_b)
        idf: dict[str, float] = {}
        for term in vocab:
            df = (term in set(tok_a)) + (term in set(tok_b))
            idf[term] = math.log((2 + 1) / (df + 1)) + 1.0  # smooth IDF

        vec_a = _tfidf_vector(tok_a, idf)
        vec_b = _tfidf_vector(tok_b, idf)

        # Dot product
        dot = sum(vec_a.get(t, 0.0) * vec_b.get(t, 0.0) for t in vocab)
        norm_a = math.sqrt(sum(v ** 2 for v in vec_a.values())) or 1e-10
        norm_b = math.sqrt(sum(v ** 2 for v in vec_b.values())) or 1e-10

        return float(round(dot / (norm_a * norm_b), 4))
    except Exception:
        return 0.0
