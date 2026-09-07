"""Circuit breaker — maintains per-agent ACTIVE/PAUSED state.

Auto-transitions to PAUSED when:
  - composite score < 0.4, OR
  - drift is detected

State is persisted to history.json so it survives restarts.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Literal

# On serverless platforms (Vercel) the deploy directory is read-only; use /tmp.
_on_serverless = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
if _on_serverless:
    DATA_DIR = Path("/tmp/sentinel_data")
else:
    DATA_DIR = Path(__file__).parent.parent / "data"
HISTORY_FILE = DATA_DIR / "history.json"

AgentStatus = Literal["ACTIVE", "PAUSED"]

# In-memory state, loaded from history.json at startup
_state: dict[str, AgentStatus] = {}


def _load() -> None:
    global _state
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if HISTORY_FILE.exists():
        try:
            raw = json.loads(HISTORY_FILE.read_text())
            _state = raw.get("circuit_breaker", {})
        except (json.JSONDecodeError, KeyError):
            _state = {}


def _save() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    existing: dict = {}
    if HISTORY_FILE.exists():
        try:
            existing = json.loads(HISTORY_FILE.read_text())
        except json.JSONDecodeError:
            existing = {}
    existing["circuit_breaker"] = _state
    HISTORY_FILE.write_text(json.dumps(existing, indent=2))


# Load on module import
_load()


def get_status(agent_id: str) -> AgentStatus:
    return _state.get(agent_id, "ACTIVE")


def set_status(agent_id: str, status: AgentStatus) -> None:
    _state[agent_id] = status
    _save()


def maybe_auto_pause(
    agent_id: str,
    composite_score: float,
    drift_detected: bool,
) -> bool:
    """Auto-pause if composite < 0.4 OR drift detected. Returns True if paused."""
    if composite_score < 0.4 or drift_detected:
        if get_status(agent_id) == "ACTIVE":
            set_status(agent_id, "PAUSED")
            return True
    return False


def pause(agent_id: str) -> AgentStatus:
    set_status(agent_id, "PAUSED")
    return "PAUSED"


def resume(agent_id: str) -> AgentStatus:
    set_status(agent_id, "ACTIVE")
    return "ACTIVE"


def all_statuses() -> dict[str, AgentStatus]:
    return dict(_state)
