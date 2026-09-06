"""Mock agent fleet — 8 agents modeled on Razorpay's real AI systems.

Each agent has a distinct failure mode persona:
  risk_review       — Bumblebee-style; inconsistency spike after day 5
  incident_rca      — Viveka-style; ungrounded hallucinations under pressure
  merchant_support  — Ray-style; overconfident / miscalibrated
  dispute_response  — chargeback auto-responder; high inconsistency variance
  onboarding_kyc    — KYC agent; occasionally cites irrelevant evidence (ungrounded)
  fraud_alert       — real-time fraud signal classifier; calibration degrades over time
  settlement_query  — settlement status resolver; high accuracy but slow drift
  compliance_check  — regulatory compliance reviewer; mostly nominal, rare spikes
"""
from __future__ import annotations

from app.backends import SimulatedBackend
from agents.base import Agent


_PERSONAS = {
    "risk_review": (
        "You are Bumblebee, Razorpay's risk-review agent for new merchant signups. "
        "Review each merchant for fraud risk, citing specific evidence from the provided pool. "
        "Output a clear LOW / MEDIUM / HIGH risk determination with a one-sentence rationale."
    ),
    "incident_rca": (
        "You are Project Viveka, Razorpay's incident root-cause analysis agent. "
        "Investigate production incidents on the payments platform and identify the single "
        "most likely root cause, always citing specific evidence from logs, metrics, and alerts. "
        "Never speculate without evidence."
    ),
    "merchant_support": (
        "You are Ray, Razorpay's merchant support agent. "
        "Answer merchant questions about settlements, payouts, UPI mandates, and disputed fees. "
        "Provide clear, accurate, confident answers grounded only in verified policy documents."
    ),
    "dispute_response": (
        "You are Razorpay's dispute-response agent. "
        "Decide whether to CONTEST or ACCEPT each chargeback, citing the relevant evidence "
        "from transaction records, delivery logs, and merchant notes."
    ),
    "onboarding_kyc": (
        "You are Razorpay's KYC onboarding agent. "
        "Verify submitted identity documents against regulatory requirements (RBI KYC master directions). "
        "Approve or reject each application with a precise reason citing the specific document checked."
    ),
    "fraud_alert": (
        "You are Razorpay's real-time fraud signal classifier. "
        "For each flagged transaction, determine if it is FRAUDULENT or LEGITIMATE, "
        "citing the specific signals (velocity, device fingerprint, BIN mismatch, etc.) "
        "that support your classification."
    ),
    "settlement_query": (
        "You are Razorpay's settlement query resolution agent. "
        "Answer merchant questions about pending settlements, hold reasons, and payout schedules. "
        "Base every answer on the merchant's actual settlement record and policy documents."
    ),
    "compliance_check": (
        "You are Razorpay's regulatory compliance review agent. "
        "Evaluate each merchant activity against RBI, SEBI, FSSAI, and sector-specific regulations. "
        "Flag non-compliant activities with the exact regulatory citation."
    ),
}

# Each agent's baseline failure rate — deliberately distinct to show different failure modes
_BASE_FAULT_RATES: dict[str, dict[str, float]] = {
    "risk_review": {
        "inconsistency": 0.06,          # Low — spikes to 0.38 after day 5 (CUSUM demo)
        "ungrounded_confidence": 0.04,
        "miscalibration": 0.05,
    },
    "incident_rca": {
        "ungrounded_confidence": 0.13,  # Higher — Viveka-style hallucination pressure
        "inconsistency": 0.03,
        "miscalibration": 0.06,
    },
    "merchant_support": {
        "miscalibration": 0.18,         # Overconfident Ray — worst calibration
        "ungrounded_confidence": 0.07,
        "inconsistency": 0.05,
    },
    "dispute_response": {
        "inconsistency": 0.11,          # High variance chargeback decisions
        "ungrounded_confidence": 0.06,
        "miscalibration": 0.08,
    },
    "onboarding_kyc": {
        "ungrounded_confidence": 0.10,  # Cites wrong doc category often
        "inconsistency": 0.04,
        "miscalibration": 0.04,
    },
    "fraud_alert": {
        "miscalibration": 0.14,         # Calibration degrades → becomes our second drift target
        "ungrounded_confidence": 0.08,
        "inconsistency": 0.06,
    },
    "settlement_query": {
        "inconsistency": 0.03,          # Mostly good — shows a healthy agent baseline
        "ungrounded_confidence": 0.03,
        "miscalibration": 0.04,
    },
    "compliance_check": {
        "ungrounded_confidence": 0.05,  # Rare spikes, mostly NOMINAL
        "inconsistency": 0.02,
        "miscalibration": 0.03,
    },
}


def build_fleet(seed: int = 42, day: int = 0) -> list[Agent]:
    """Build the full 8-agent mock fleet.

    Drift scenarios (simulated after day 5):
      - risk_review:   inconsistency spikes to 0.38 (CUSUM crosses h=4.0 ~day 7)
      - fraud_alert:   miscalibration spikes to 0.35 (CUSUM crosses h=4.0 ~day 8)
    """
    agents = []
    phase_seed = seed if day < 5 else seed + 1000

    for agent_id, persona in _PERSONAS.items():
        rates = dict(_BASE_FAULT_RATES[agent_id])

        # Drift scenario 1: risk_review inconsistency spike after day 5
        if agent_id == "risk_review" and day >= 5:
            rates["inconsistency"] = 0.38

        # Drift scenario 2: fraud_alert miscalibration creep after day 5
        if agent_id == "fraud_alert" and day >= 5:
            rates["miscalibration"] = 0.35
            rates["ungrounded_confidence"] = 0.14

        backend = SimulatedBackend(fault_rates=rates, seed=phase_seed)
        agents.append(Agent(agent_id=agent_id, persona_prompt=persona, backend=backend))

    return agents
