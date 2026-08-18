"""Sentinel Production SDK — 1-file Python client to connect any real-world AI agent to Sentinel monitoring.

Usage example:
    from sentinel_sdk import SentinelClient

    sentinel = SentinelClient("http://localhost:8000")

    # In your agent code:
    sentinel.report_output(
        agent_id="payment_risk_agent",
        case_id="txn_88392",
        claim="Merchant flagged for high chargeback risk based on GST mismatch.",
        evidence_cited=["GSTIN 27AAACW1234F1Z1 does not match registered business name."],
        confidence=0.92,
        cost_usd=0.0015,
        latency_ms=240.0,
        model="claude-3-5-sonnet"
    )
"""
from __future__ import annotations

import json
import urllib.request
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any


class SentinelClient:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip("/")

    def report_output(
        self,
        agent_id: str,
        case_id: str,
        claim: str,
        evidence_cited: List[str],
        confidence: float,
        cost_usd: float = 0.0,
        latency_ms: float = 0.0,
        model: str = "production-agent",
        timestamp: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Report a real AI agent output to Sentinel for real-time reliability evaluation."""
        payload = {
            "agent_id": agent_id,
            "case_id": case_id,
            "claim": claim,
            "evidence_cited": evidence_cited,
            "confidence": confidence,
            "cost_usd": cost_usd,
            "latency_ms": latency_ms,
            "model": model,
            "timestamp": timestamp or datetime.now(timezone.utc).isoformat(),
        }

        url = f"{self.base_url}/api/ingest"
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                return result
        except Exception as exc:
            return {
                "status": "error",
                "message": f"Failed to report output to Sentinel: {exc}",
            }


# Convenience singleton
default_client = SentinelClient()


def report_output(*args, **kwargs):
    return default_client.report_output(*args, **kwargs)
