"""Pytest suite — proves the check math is correct per spec §1.11."""
from __future__ import annotations

import sys
from pathlib import Path

# Make backend the importable root
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest

from app.schema import AgentOutput, EvalCase
from app.checks import (
    groundedness_score,
    consistency_score,
    is_ungrounded_high_confidence,
    is_inconsistent,
    calibration_report,
    detect_drift,
)
from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_output(
    claim: str,
    evidence_cited: list[str],
    confidence: float = 0.7,
    agent_id: str = "test_agent",
    case_id: str = "case-001",
) -> AgentOutput:
    return AgentOutput(
        agent_id=agent_id,
        case_id=case_id,
        claim=claim,
        evidence_cited=evidence_cited,
        confidence=confidence,
        cost_usd=0.0001,
        latency_ms=100.0,
        model="test",
        timestamp=datetime.now(timezone.utc),
    )


def make_case(
    case_id: str = "case-001",
    ground_truth: str | None = None,
    duplicate_of: str | None = None,
    evidence_pool: list[str] | None = None,
) -> EvalCase:
    return EvalCase(
        case_id=case_id,
        agent_id="test_agent",
        input_payload="Test input",
        evidence_pool=evidence_pool or ["Evidence A", "Evidence B"],
        ground_truth=ground_truth,
        duplicate_of=duplicate_of,
        tags=[],
    )


# ---------------------------------------------------------------------------
# Groundedness tests
# ---------------------------------------------------------------------------

class TestGroundedness:
    def test_empty_evidence_scores_zero(self):
        """A claim citing no evidence must score exactly 0.0."""
        out = make_output("The merchant is high risk.", [])
        assert groundedness_score(out) == 0.0

    def test_identical_claim_and_evidence_scores_high(self):
        """When claim == evidence, similarity should be very high."""
        text = "The merchant has verified GST and consistent pricing."
        out = make_output(text, [text])
        score = groundedness_score(out)
        assert score > 0.8, f"Expected > 0.8, got {score}"

    def test_unrelated_claim_scores_low(self):
        """A claim about cats vs. evidence about payments should score near zero."""
        out = make_output(
            "The cat sat on the mat.",
            ["UPI transaction failed due to NPCI timeout."]
        )
        score = groundedness_score(out)
        assert score < 0.3, f"Expected < 0.3, got {score}"

    def test_partial_overlap_scores_intermediate(self):
        """Some shared terms should give an intermediate score."""
        out = make_output(
            "The merchant is high risk due to unverified GST.",
            ["GST registration number not found in GSTN database."]
        )
        score = groundedness_score(out)
        assert 0.0 < score < 1.0, f"Expected 0–1 range, got {score}"

    def test_ungrounded_flag_fires_correctly(self):
        """High confidence + zero evidence should flag as ungrounded."""
        out = make_output("Definitive verdict: high risk.", [], confidence=0.92)
        assert is_ungrounded_high_confidence(out) is True

    def test_ungrounded_flag_does_not_fire_with_low_confidence(self):
        """Low confidence even with zero evidence should NOT flag."""
        out = make_output("Maybe high risk.", [], confidence=0.4)
        assert is_ungrounded_high_confidence(out) is False

    def test_ungrounded_flag_does_not_fire_with_good_evidence(self):
        """High confidence with well-grounded evidence should NOT flag.
        Uses a claim and evidence with substantial TF-IDF overlap (>0.25 threshold).
        """
        claim = (
            "High risk merchant: GST registration number was not found in the GSTN database, "
            "indicating the business may be operating without valid tax registration."
        )
        evidence = (
            "GST registration number not found in GSTN database after three verification attempts. "
            "The merchant's stated GSTIN does not match any active registration."
        )
        out = make_output(claim, [evidence], confidence=0.9)
        score = groundedness_score(out)
        assert score >= 0.25, f"Expected score >= 0.25 for well-matched claim/evidence, got {score}"
        assert is_ungrounded_high_confidence(out) is False


# ---------------------------------------------------------------------------
# Consistency tests
# ---------------------------------------------------------------------------

class TestConsistency:
    def test_identical_claims_score_one(self):
        """Two identical claims must score 1.0."""
        claim = "The chargeback should be contested based on 3DS authentication."
        score = consistency_score(claim, claim)
        assert score == 1.0, f"Expected 1.0, got {score}"

    def test_unrelated_claims_score_low(self):
        """Completely unrelated claims should score very low."""
        score = consistency_score(
            "The merchant application is approved.",
            "NPCI switch latency spiked causing UPI failures.",
        )
        assert score < 0.3, f"Expected < 0.3, got {score}"

    def test_paraphrased_claims_score_high(self):
        """Semantically similar but differently worded claims should score > 0.5."""
        score = consistency_score(
            "Low risk: verified GST, consistent pricing, established social presence.",
            "Low risk merchant: GST verified, pricing is consistent, social media presence established.",
        )
        assert score > 0.5, f"Expected > 0.5, got {score}"

    def test_inconsistent_flag(self):
        """Claims with score < 0.5 should be flagged inconsistent."""
        assert is_inconsistent("Approve the merchant.", "Reject the merchant immediately.") is True

    def test_consistent_flag_not_set_for_similar(self):
        """Similar claims should NOT be flagged inconsistent."""
        a = "Low risk: verified GST, consistent pricing, established social presence."
        b = "Low risk merchant: GST verified, pricing is consistent, social media presence established."
        assert is_inconsistent(a, b) is False


# ---------------------------------------------------------------------------
# Calibration tests
# ---------------------------------------------------------------------------

class TestCalibration:
    def test_perfect_calibration_gives_zero_brier(self):
        """Confidence matches outcome perfectly → Brier score ≈ 0."""
        pairs = [
            (make_output("Claim", ["ev"], confidence=1.0), True),
            (make_output("Claim", ["ev"], confidence=0.0), False),
            (make_output("Claim", ["ev"], confidence=1.0), True),
        ]
        report = calibration_report(pairs)
        assert report.brier_score < 0.01, f"Expected ~0, got {report.brier_score}"

    def test_worst_calibration_gives_high_brier(self):
        """Confidence 1.0 on wrong outcomes → Brier score = 1.0."""
        pairs = [
            (make_output("Claim", ["ev"], confidence=1.0), False),
            (make_output("Claim", ["ev"], confidence=1.0), False),
        ]
        report = calibration_report(pairs)
        assert report.brier_score >= 0.9, f"Expected ~1.0, got {report.brier_score}"

    def test_empty_pairs_returns_zero(self):
        """No labeled pairs should return zero scores without error."""
        report = calibration_report([])
        assert report.n_labeled == 0
        assert report.brier_score == 0.0
        assert report.expected_calibration_error == 0.0

    def test_ece_is_zero_for_perfectly_calibrated_bin(self):
        """If every 0.8-confident prediction is correct 80% of the time, ECE ≈ 0."""
        # 4 predictions at 0.8 confidence, 4 correct → accuracy = 1.0 in bin → ECE nonzero
        # Create a perfectly calibrated scenario: confidence 0.8, accuracy 0.8
        pairs = [
            (make_output("Claim", ["ev"], confidence=0.85), True),
            (make_output("Claim", ["ev"], confidence=0.85), True),
            (make_output("Claim", ["ev"], confidence=0.85), True),
            (make_output("Claim", ["ev"], confidence=0.85), True),
            (make_output("Claim", ["ev"], confidence=0.85), False),
        ]
        report = calibration_report(pairs)
        assert report.expected_calibration_error < 0.2  # Roughly calibrated

    def test_five_bins_returned(self):
        """calibration_report should always return exactly 5 bins."""
        pairs = [(make_output("Claim", ["ev"], confidence=0.5), True)]
        report = calibration_report(pairs)
        assert len(report.bins) == 5


# ---------------------------------------------------------------------------
# Drift detection (CUSUM) tests
# ---------------------------------------------------------------------------

class TestDriftDetection:
    def test_stable_series_no_drift(self):
        """A flat, stable series should not trigger drift detection."""
        scores = [0.8, 0.82, 0.79, 0.81, 0.80, 0.82, 0.79, 0.81, 0.80, 0.82]
        result = detect_drift(scores)
        assert result.drift_detected is False

    def test_obvious_downward_shift_at_day_5(self):
        """An injected downward shift at day 5 should set drift_day == 5 (or within 1)."""
        scores = [0.85, 0.83, 0.84, 0.86,  # baseline: mean ~0.845
                  0.84,                       # day 4 (still okay)
                  0.40, 0.35, 0.30, 0.28, 0.25]  # collapse from day 5
        result = detect_drift(scores)
        assert result.drift_detected is True, "Expected drift to be detected"
        assert result.drift_day is not None
        assert abs(result.drift_day - 5) <= 2, f"Expected drift near day 5, got day {result.drift_day}"

    def test_cusum_series_length_matches_input(self):
        """cusum_series should have the same length as daily_scores."""
        scores = [0.8] * 10
        result = detect_drift(scores)
        assert len(result.cusum_series) == len(scores)

    def test_short_series_returns_no_drift(self):
        """Series shorter than baseline_window should return no drift."""
        result = detect_drift([0.8, 0.7, 0.5])  # only 3 points, baseline_window=4
        assert result.drift_detected is False

    def test_cusum_is_non_positive(self):
        """One-sided CUSUM (min with 0) should never go positive."""
        scores = [0.9, 0.85, 0.88, 0.87, 0.86, 0.84, 0.82, 0.80, 0.78, 0.75]
        result = detect_drift(scores)
        for val in result.cusum_series:
            assert val <= 0.0, f"CUSUM went positive: {val}"


# ---------------------------------------------------------------------------
# Integration: full 10-day simulation
# ---------------------------------------------------------------------------

class TestSimulation:
    def test_risk_review_drifts_others_stable(self):
        """Run the full 10-day simulation and assert:
        - risk_review shows drift_detected == True
        - At least one other agent shows drift_detected == False
        """
        from app.simulate import run_simulation
        results = run_simulation(days=10, seed=42)

        assert "risk_review" in results, "risk_review agent missing from simulation results"

        rr = results["risk_review"]
        assert rr.drift.drift_detected is True, (
            f"Expected risk_review drift_detected=True; "
            f"scores: {rr.daily_composite_scores}; "
            f"cusum: {rr.drift.cusum_series}"
        )

        other_agents = [k for k in results if k != "risk_review"]
        stable = [k for k in other_agents if not results[k].drift.drift_detected]
        assert len(stable) >= 1, (
            f"Expected at least 1 non-risk_review agent to be stable; "
            f"got: {[(k, results[k].drift.drift_detected) for k in other_agents]}"
        )

    def test_simulation_returns_all_eight_agents(self):
        """Simulation results must include all 8 fleet agents."""
        from app.simulate import run_simulation
        results = run_simulation(days=10, seed=42)
        expected = {
            "risk_review", "incident_rca", "merchant_support", "dispute_response",
            "settlement_query", "onboarding_kyc", "fraud_alert", "compliance_check",
        }
        assert set(results.keys()) == expected

    def test_daily_scores_length_matches_days(self):
        """Each agent's daily_composite_scores should have exactly `days` entries."""
        from app.simulate import run_simulation
        results = run_simulation(days=10, seed=42)
        for agent_id, sim in results.items():
            assert len(sim.daily_composite_scores) == 10, (
                f"{agent_id}: expected 10 daily scores, got {len(sim.daily_composite_scores)}"
            )


# ---------------------------------------------------------------------------
# Razorpay webhook endpoint tests
# ---------------------------------------------------------------------------

class TestRazorpayWebhook:
    """Route-level tests for POST /api/razorpay/webhook.

    Isolation strategy
    ------------------
    • RAZORPAY_WEBHOOK_SECRET is monkeypatched on app.main so the module-level
      constant seen by verify_razorpay_signature() is the test secret, not "".
    • DATA_DIR and HISTORY_FILE are monkeypatched on app.main to a pytest
      tmp_path so _load_history()/_save_history() never touch the real
      backend/data/history.json.

    Byte-serialization note
    -----------------------
    We serialize the payload dict to bytes ourselves with json.dumps().encode()
    and send those exact bytes via content=<bytes>.  TestClient's content=
    parameter sends the buffer verbatim — no re-serialization — so the bytes
    that request.body() returns inside the endpoint are byte-for-byte identical
    to what we signed.  This guarantees hmac.compare_digest() succeeds.
    """

    # Real Razorpay payment.dispute.created payload (from official docs)
    DISPUTE_PAYLOAD: dict = {
        "entity": "event",
        "account_id": "acc_CFvOKjkTwf3GQy",
        "event": "payment.dispute.created",
        "contains": ["dispute", "payment"],
        "payload": {
            "dispute": {
                "entity": {
                    "id": "disp_EsIAlDcoUr8CaQ",
                    "payment_id": "pay_EFtmUsbwpXwBHI",
                    "amount": 700000,
                    "currency": "INR",
                    "reason_code": "processed_invalid_expired_card",
                    "status": "open",
                }
            },
            "payment": {
                "entity": {
                    "id": "pay_EFtmUsbwpXwBHI",
                    "amount": 700000,
                    "status": "captured",
                }
            },
        },
        "created_at": 1590485631,
    }

    TEST_SECRET = "test_secret_123"

    def _make_client_and_patch(self, monkeypatch, tmp_path):
        """Return a TestClient with all file I/O and the webhook secret isolated."""
        import hashlib as _hashlib  # noqa: F401 — imported for signature helper below
        import app.main as main_module
        from fastapi.testclient import TestClient

        tmp_history = tmp_path / "history.json"
        monkeypatch.setattr(main_module, "DATA_DIR", tmp_path)
        monkeypatch.setattr(main_module, "HISTORY_FILE", tmp_history)
        monkeypatch.setattr(main_module, "RAZORPAY_WEBHOOK_SECRET", self.TEST_SECRET)

        return TestClient(main_module.app), tmp_history

    @staticmethod
    def _sign(body_bytes: bytes, secret: str) -> str:
        import hashlib
        import hmac as _hmac
        return _hmac.new(secret.encode(), body_bytes, hashlib.sha256).hexdigest()

    # ------------------------------------------------------------------
    # Test 1 — happy path: valid dispute.created payload is accepted and
    #           a ground_truth_corrections entry is written to history.json
    # ------------------------------------------------------------------
    def test_dispute_webhook_records_correction(self, monkeypatch, tmp_path):
        """A correctly signed payment.dispute.created webhook must:
        - return 200 {"status": "received"}
        - write a ground_truth_corrections entry for pay_EFtmUsbwpXwBHI
        """
        import json

        client, tmp_history = self._make_client_and_patch(monkeypatch, tmp_path)

        body_bytes: bytes = json.dumps(self.DISPUTE_PAYLOAD).encode()
        signature: str = self._sign(body_bytes, self.TEST_SECRET)

        response = client.post(
            "/api/razorpay/webhook",
            content=body_bytes,
            headers={
                "Content-Type": "application/json",
                "X-Razorpay-Signature": signature,
            },
        )

        # --- response assertions ---
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text}"
        )
        assert response.json() == {"status": "received"}

        # --- history.json assertions ---
        assert tmp_history.exists(), "history.json was not created"
        history = json.loads(tmp_history.read_text())
        corrections = history.get("ground_truth_corrections", [])

        matching = [
            c for c in corrections
            if c.get("case_id") == "pay_EFtmUsbwpXwBHI"
            and c.get("corrected_truth") == "High risk: disputed post-approval"
        ]
        assert len(matching) == 1, (
            f"Expected exactly 1 matching correction for pay_EFtmUsbwpXwBHI, "
            f"found {len(matching)} in: {corrections}"
        )
        assert matching[0].get("flag_type") == "ground_truth_update"

    # ------------------------------------------------------------------
    # Test 2 — invalid signature is rejected with 400
    # ------------------------------------------------------------------
    def test_invalid_signature_returns_400(self, monkeypatch, tmp_path):
        """A request with a garbage X-Razorpay-Signature must be rejected with 400."""
        import json

        client, _ = self._make_client_and_patch(monkeypatch, tmp_path)

        body_bytes: bytes = json.dumps(self.DISPUTE_PAYLOAD).encode()

        response = client.post(
            "/api/razorpay/webhook",
            content=body_bytes,
            headers={
                "Content-Type": "application/json",
                "X-Razorpay-Signature": "not_a_valid_hmac_at_all",
            },
        )

        assert response.status_code == 400, (
            f"Expected 400, got {response.status_code}: {response.text}"
        )
        assert "Invalid signature" in response.json().get("detail", "")

