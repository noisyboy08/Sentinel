"""Alert dispatcher — fires on any new flag.

If ALERT_WEBHOOK_URL is set, POSTs a JSON payload.
Otherwise logs to console with 🚨 ALERT prefix.
Does NOT block or raise on failure.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger("sentinel.alerts")


def fire_alert(
    agent_id: str,
    flag_type: str,
    detail: str,
    timestamp: str | None = None,
) -> None:
    """Fire an alert for a new flag. Non-blocking, never raises."""
    ts = timestamp or datetime.now(timezone.utc).isoformat()
    payload = {
        "agent_id": agent_id,
        "flag_type": flag_type,
        "detail": detail,
        "timestamp": ts,
    }

    webhook_url = os.getenv("ALERT_WEBHOOK_URL", "").strip()

    if webhook_url:
        _send_webhook(webhook_url, payload)
    else:
        _log_alert(payload)


def _send_webhook(url: str, payload: dict) -> None:
    try:
        import urllib.request
        body = json.dumps(payload).encode()
        req = urllib.request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            logger.info("Alert webhook delivered: %s %s", resp.status, payload["flag_type"])
    except Exception as exc:
        logger.warning("Alert webhook failed (%s) — falling back to console log", exc)
        _log_alert(payload)


def _log_alert(payload: dict) -> None:
    print(
        f"🚨 ALERT  agent={payload['agent_id']}  "
        f"flag={payload['flag_type']}  "
        f"detail={payload['detail']!r}  "
        f"ts={payload['timestamp']}"
    )
