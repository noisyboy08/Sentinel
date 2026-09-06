"""FastAPI application — Sentinel backend.

Endpoints per spec §1.9:
  GET  /api/fleet
  GET  /api/agents/{agent_id}
  POST /api/simulate?days=10
  GET  /api/incidents
  POST /api/agents/{agent_id}/pause
  POST /api/agents/{agent_id}/resume
  POST /api/agents/{agent_id}/judge
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv

env_file = Path(__file__).parent.parent / ".env"
if env_file.exists():
    load_dotenv(env_file)
else:
    load_dotenv()

# Make backend the importable root
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.schema import AgentOutput, EvalCase
from app.tower import evaluate_agent, load_eval_cases, IncidentFlag
from app.checks import groundedness_score, is_ungrounded_high_confidence, detect_drift
from app import circuit_breaker as cb
from app.alerts import fire_alert
from app.simulate import run_simulation
from app.backends import get_best_available_backend

DATA_DIR = Path(__file__).parent.parent / "data"
HISTORY_FILE = DATA_DIR / "history.json"

app = FastAPI(title="Sentinel", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Razorpay webhook
# ---------------------------------------------------------------------------

RAZORPAY_WEBHOOK_SECRET: str = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")


def verify_razorpay_signature(payload_body: bytes, signature: str) -> bool:
    """Return True iff the HMAC-SHA256 of payload_body under RAZORPAY_WEBHOOK_SECRET
    matches *signature* (hex-encoded). Uses hmac.compare_digest to prevent
    timing-based side-channel attacks.
    """
    if not RAZORPAY_WEBHOOK_SECRET:
        return False
    expected = hmac.new(
        RAZORPAY_WEBHOOK_SECRET.encode(),
        payload_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def _record_ground_truth_correction(
    case_id: str, corrected_truth: str, flag_type: str
) -> None:
    """Append a ground-truth correction derived from a real Razorpay event
    (dispute or fraud refund) to history.json, so the calibration check can
    use real outcomes instead of only the static eval-set labels.

    Uses _load_history / _save_history — the same helpers used by every other
    route in this file — so all reads and writes go through one consistent path.
    """
    history = _load_history()
    history.setdefault("ground_truth_corrections", []).append(
        {
            "case_id": case_id,
            "corrected_truth": corrected_truth,
            "flag_type": flag_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )
    _save_history(history)


class RegisterAgentRequest(BaseModel):
    agent_id: str
    persona: str
    model_name: str = "claude-3-5-sonnet"
    fault_rate_inconsistency: float = 0.05
    fault_rate_ungrounded: float = 0.05
    fault_rate_miscalibration: float = 0.05


def _get_fleet(seed: int = 42, day: int = 0):
    from agents.mock_fleet import build_fleet
    from agents.base import Agent
    from app.backends import SimulatedBackend

    fleet = build_fleet(seed=seed, day=day)
    history = _load_history()
    registered = history.get("registered_agents", {})

    for aid, meta in registered.items():
        if not any(a.agent_id == aid for a in fleet):
            backend = SimulatedBackend(
                fault_rates={
                    "inconsistency": meta.get("fault_rate_inconsistency", 0.05),
                    "ungrounded_confidence": meta.get("fault_rate_ungrounded", 0.05),
                    "miscalibration": meta.get("fault_rate_miscalibration", 0.05),
                },
                seed=seed,
            )
            fleet.append(Agent(agent_id=aid, persona_prompt=meta.get("persona", ""), backend=backend))

    return fleet


def _load_history() -> dict:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if HISTORY_FILE.exists():
        try:
            return json.loads(HISTORY_FILE.read_text())
        except json.JSONDecodeError:
            return {}
    return {}


def _save_history(data: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    HISTORY_FILE.write_text(json.dumps(data, indent=2, default=str))


def _status_label(composite: float) -> str:
    if composite >= 0.7:
        return "NOMINAL"
    elif composite >= 0.4:
        return "CAUTION"
    return "CRITICAL"


# ---------------------------------------------------------------------------
# GET /api/fleet
# ---------------------------------------------------------------------------

@app.get("/api/fleet")
def get_fleet() -> dict:
    """Run today's full evaluation across all 4 agents."""
    fleet = _get_fleet()
    history = _load_history()
    incidents_store: list[dict] = history.get("incidents", [])

    agents_out: dict[str, Any] = {}
    now = datetime.now(timezone.utc).isoformat()

    for agent in fleet:
        result = evaluate_agent(agent)
        status = cb.get_status(agent.agent_id)

        # Auto-pause check (uses current composite only, not drift — drift comes from simulate)
        was_paused = cb.maybe_auto_pause(agent.agent_id, result.composite_score, drift_detected=False)
        if was_paused:
            status = "PAUSED"
            fire_alert(agent.agent_id, "auto_paused",
                       f"Composite score {result.composite_score:.3f} below threshold", now)

        # Fire alerts for new flags
        for flag in result.incidents:
            fire_alert(flag.agent_id, flag.flag_type, flag.detail, flag.timestamp)
            incidents_store.append({
                "agent_id": flag.agent_id,
                "flag_type": flag.flag_type,
                "detail": flag.detail,
                "case_id": flag.case_id,
                "timestamp": flag.timestamp,
            })

        agents_out[agent.agent_id] = {
            "composite_score": result.composite_score,
            "avg_groundedness": result.avg_groundedness,
            "avg_consistency": result.avg_consistency,
            "ungrounded_flags": len(result.ungrounded_flags),
            "consistency_pairs": [
                {
                    "case_id_a": p.case_id_a,
                    "case_id_b": p.case_id_b,
                    "score": p.score,
                    "flagged": p.flagged,
                }
                for p in result.consistency_pairs
            ],
            "calibration": {
                "n_labeled": result.calibration.n_labeled,
                "brier_score": result.calibration.brier_score,
                "expected_calibration_error": result.calibration.expected_calibration_error,
                "bins": [
                    {
                        "lower": b.lower,
                        "upper": b.upper,
                        "count": b.count,
                        "avg_confidence": b.avg_confidence,
                        "accuracy": b.accuracy,
                    }
                    for b in result.calibration.bins
                ],
            },
            "status": cb.get_status(agent.agent_id),
            "health_label": _status_label(result.composite_score),
            "total_cost_usd": result.total_cost_usd,
            "avg_latency_ms": result.avg_latency_ms,
            "case_count": len(result.outputs),
            "incidents": [
                {
                    "flag_type": i.flag_type,
                    "detail": i.detail,
                    "case_id": i.case_id,
                    "timestamp": i.timestamp,
                }
                for i in result.incidents
            ],
            "has_live_corrections": result.has_live_corrections,
        }

    # Deduplicate incidents before saving
    seen = set()
    deduped = []
    for inc in incidents_store:
        key = (inc["agent_id"], inc["flag_type"], inc.get("case_id"), inc["timestamp"])
        if key not in seen:
            seen.add(key)
            deduped.append(inc)

    history["incidents"] = deduped[-500:]  # Keep last 500
    history["last_fleet_run"] = now
    _save_history(history)

    return {
        "generated_at": now,
        "agents": agents_out,
    }


# ---------------------------------------------------------------------------
# GET /api/agents/{agent_id}
# ---------------------------------------------------------------------------

@app.get("/api/agents/{agent_id}")
def get_agent_detail(agent_id: str) -> dict:
    """Full case-by-case breakdown for a single agent."""
    fleet = _get_fleet()
    agent = next((a for a in fleet if a.agent_id == agent_id), None)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")

    result = evaluate_agent(agent)
    cases = load_eval_cases(agent_id)
    case_map = {c.case_id: c for c in cases}

    case_details = []
    for i, output in enumerate(result.outputs):
        case = case_map.get(output.case_id)
        g_score = result.groundedness_scores[i]
        ungrounded = g_score < 0.25 and output.confidence >= 0.6
        outcome = None
        if case and case.ground_truth:
            from app.checks import is_correct
            outcome = is_correct(output, case)

        case_details.append({
            "case_id": output.case_id,
            "input_payload": case.input_payload if case else "",
            "claim": output.claim,
            "evidence_cited": output.evidence_cited,
            "confidence": output.confidence,
            "groundedness_score": g_score,
            "is_ungrounded": ungrounded,
            "is_correct": outcome,
            "cost_usd": output.cost_usd,
            "latency_ms": output.latency_ms,
            "model": output.model,
            "timestamp": output.timestamp.isoformat() if hasattr(output.timestamp, 'isoformat') else str(output.timestamp),
            "duplicate_of": case.duplicate_of if case else None,
            "ground_truth": case.ground_truth if case else None,
        })

    return {
        "agent_id": agent_id,
        "status": cb.get_status(agent_id),
        "health_label": _status_label(result.composite_score),
        "composite_score": result.composite_score,
        "avg_groundedness": result.avg_groundedness,
        "avg_consistency": result.avg_consistency,
        "calibration": {
            "n_labeled": result.calibration.n_labeled,
            "brier_score": result.calibration.brier_score,
            "expected_calibration_error": result.calibration.expected_calibration_error,
        },
        "consistency_pairs": [
            {
                "case_id_a": p.case_id_a,
                "case_id_b": p.case_id_b,
                "claim_a": p.claim_a,
                "claim_b": p.claim_b,
                "score": p.score,
                "flagged": p.flagged,
            }
            for p in result.consistency_pairs
        ],
        "cases": case_details,
        "incidents": [
            {
                "flag_type": i.flag_type,
                "detail": i.detail,
                "case_id": i.case_id,
                "timestamp": i.timestamp,
            }
            for i in result.incidents
        ],
    }


# ---------------------------------------------------------------------------
# POST /api/simulate?days=10
# ---------------------------------------------------------------------------

@app.post("/api/simulate")
def post_simulate(days: int = 10) -> dict:
    """Run the multi-day drift simulation."""
    sim_results = run_simulation(days=days)
    history = _load_history()
    now = datetime.now(timezone.utc).isoformat()

    out: dict[str, Any] = {}
    for agent_id, sim in sim_results.items():
        out[agent_id] = {
            "daily_composite_scores": sim.daily_composite_scores,
            "drift": {
                "drift_detected": sim.drift.drift_detected,
                "drift_day": sim.drift.drift_day,
                "cusum_series": sim.drift.cusum_series,
            },
        }

        # Auto-pause + alert if drift detected
        if sim.drift.drift_detected:
            was_paused = cb.maybe_auto_pause(agent_id, min(sim.daily_composite_scores), True)
            if was_paused:
                fire_alert(agent_id, "drift_detected",
                           f"CUSUM drift detected at day {sim.drift.drift_day}", now)
                history.setdefault("incidents", []).append({
                    "agent_id": agent_id,
                    "flag_type": "drift_detected",
                    "detail": f"Drift detected at simulated day {sim.drift.drift_day} (CUSUM threshold crossed)",
                    "case_id": None,
                    "timestamp": now,
                })

    history["last_simulation"] = now
    history["simulation_results"] = out
    _save_history(history)

    return out


# ---------------------------------------------------------------------------
# GET /api/incidents
# ---------------------------------------------------------------------------

@app.get("/api/incidents")
def get_incidents(agent_id: Optional[str] = None, flag_type: Optional[str] = None) -> list[dict]:
    """Newest-first feed of all flags."""
    history = _load_history()
    incidents = history.get("incidents", [])

    if agent_id:
        incidents = [i for i in incidents if i.get("agent_id") == agent_id]
    if flag_type:
        incidents = [i for i in incidents if i.get("flag_type") == flag_type]

    return list(reversed(incidents))


# ---------------------------------------------------------------------------
# POST /api/agents/register — Register a New Agent Dynamically
# ---------------------------------------------------------------------------

@app.post("/api/agents/register")
def register_agent(req: RegisterAgentRequest) -> dict:
    """Dynamically register a new custom AI agent into the fleet."""
    history = _load_history()
    registered = history.setdefault("registered_agents", {})
    
    registered[req.agent_id] = {
        "persona": req.persona,
        "model_name": req.model_name,
        "fault_rate_inconsistency": req.fault_rate_inconsistency,
        "fault_rate_ungrounded": req.fault_rate_ungrounded,
        "fault_rate_miscalibration": req.fault_rate_miscalibration,
        "registered_at": datetime.now(timezone.utc).isoformat(),
    }
    _save_history(history)
    return {
        "status": "registered",
        "agent_id": req.agent_id,
        "total_agents": len(_get_fleet()),
    }


# ---------------------------------------------------------------------------
# POST /api/agents/{agent_id}/pause
# ---------------------------------------------------------------------------

@app.post("/api/agents/{agent_id}/pause")
def pause_agent(agent_id: str) -> dict:
    status = cb.pause(agent_id)
    now = datetime.now(timezone.utc).isoformat()
    fire_alert(agent_id, "manual_pause", f"Agent manually paused", now)
    history = _load_history()
    history.setdefault("incidents", []).append({
        "agent_id": agent_id,
        "flag_type": "manual_pause",
        "detail": "Agent manually paused via API",
        "case_id": None,
        "timestamp": now,
    })
    _save_history(history)
    return {"agent_id": agent_id, "status": status}


# ---------------------------------------------------------------------------
# POST /api/agents/{agent_id}/resume
# ---------------------------------------------------------------------------

@app.post("/api/agents/{agent_id}/resume")
def resume_agent(agent_id: str) -> dict:
    status = cb.resume(agent_id)
    return {"agent_id": agent_id, "status": status}


# ---------------------------------------------------------------------------
# POST /api/agents/{agent_id}/judge
# ---------------------------------------------------------------------------

@app.post("/api/agents/{agent_id}/judge")
def judge_agent(agent_id: str) -> dict:
    """Run LLM-as-judge on the most recent flagged case for this agent.
    Falls back to heuristic if no API key is configured.
    """
    fleet = _get_fleet()
    agent = next((a for a in fleet if a.agent_id == agent_id), None)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")

    result = evaluate_agent(agent)

    # Find the first flagged case
    flagged_output = None
    for flag in result.ungrounded_flags:
        output = next((o for o in result.outputs if o.case_id == flag.case_id), None)
        if output:
            flagged_output = output
            break

    if flagged_output is None and result.outputs:
        flagged_output = result.outputs[0]

    if flagged_output is None:
        return {
            "verdict": "NO_CASES",
            "reasoning": "No cases available to judge.",
            "fallback": True,
        }

    claim = flagged_output.claim
    evidence = " ".join(flagged_output.evidence_cited) if flagged_output.evidence_cited else "(none cited)"

    # Try real LLM judge
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()

    if anthropic_key:
        return _judge_anthropic(claim, evidence, anthropic_key, flagged_output.case_id)
    if gemini_key:
        return _judge_gemini(claim, evidence, gemini_key, flagged_output.case_id)

    # Heuristic fallback
    return _judge_heuristic(claim, evidence, flagged_output.case_id)


def _judge_anthropic(claim: str, evidence: str, api_key: str, case_id: str) -> dict:
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=256,
            messages=[{
                "role": "user",
                "content": (
                    f"Does this evidence actually support this claim? "
                    f"Answer YES or NO and explain in one sentence.\n\n"
                    f"Claim: {claim}\n\nEvidence: {evidence}"
                )
            }]
        )
        text = resp.content[0].text.strip()
        verdict = "YES" if text.upper().startswith("YES") else "NO"
        return {"verdict": verdict, "reasoning": text, "fallback": False, "case_id": case_id}
    except Exception as exc:
        return _judge_heuristic(claim, evidence, case_id, note=f"Anthropic failed: {exc}")


def _judge_gemini(claim: str, evidence: str, api_key: str, case_id: str) -> dict:
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        resp = model.generate_content(
            f"Does this evidence actually support this claim? "
            f"Answer YES or NO and explain in one sentence.\n\n"
            f"Claim: {claim}\n\nEvidence: {evidence}"
        )
        text = resp.text.strip()
        verdict = "YES" if text.upper().startswith("YES") else "NO"
        return {"verdict": verdict, "reasoning": text, "fallback": False, "case_id": case_id}
    except Exception as exc:
        return _judge_heuristic(claim, evidence, case_id, note=f"Gemini failed: {exc}")


def _judge_heuristic(claim: str, evidence: str, case_id: str, note: str = "") -> dict:
    """TF-IDF groundedness heuristic as judge fallback."""
    from app.schema import AgentOutput
    from datetime import datetime, timezone
    dummy = AgentOutput(
        agent_id="judge",
        case_id=case_id,
        claim=claim,
        evidence_cited=[evidence] if evidence and evidence != "(none cited)" else [],
        confidence=0.5,
        cost_usd=0.0,
        latency_ms=0.0,
        model="heuristic",
        timestamp=datetime.now(timezone.utc),
    )
    score = groundedness_score(dummy)
    verdict = "YES" if score >= 0.20 else "NO"
    reasoning = (
        f"Heuristic fallback (no API key configured{': ' + note if note else ''}). "
        f"TF-IDF groundedness score: {score:.3f}. "
        f"Threshold 0.20 → verdict: {verdict}."
    )
    return {"verdict": verdict, "reasoning": reasoning, "fallback": True, "case_id": case_id}


# ---------------------------------------------------------------------------
# POST /api/ingest — Real-World Live Production Ingestion Endpoint
# ---------------------------------------------------------------------------

@app.post("/api/ingest")
def ingest_live_output(output: AgentOutput) -> dict:
    """Live production ingestion endpoint.
    Accepts real-time AgentOutput from external AI agents, evaluates reliability on the fly,
    logs incidents/alerts if ungrounded or low score, and updates history.
    """
    g_score = groundedness_score(output)
    is_ungrounded = is_ungrounded_high_confidence(output)

    now = datetime.now(timezone.utc).isoformat()
    history = _load_history()

    # Store ingested output
    history.setdefault("ingested_outputs", []).append(output.model_dump(mode="json"))

    # Log incident if ungrounded
    if is_ungrounded:
        detail = f"Confidence {output.confidence:.2f} but groundedness {g_score:.2f} on live case {output.case_id}"
        fire_alert(output.agent_id, "ungrounded", detail, now)
        history.setdefault("incidents", []).append({
            "agent_id": output.agent_id,
            "flag_type": "ungrounded",
            "detail": detail,
            "case_id": output.case_id,
            "timestamp": now,
        })

    _save_history(history)

    return {
        "status": "ingested",
        "agent_id": output.agent_id,
        "case_id": output.case_id,
        "eval": {
            "groundedness_score": round(g_score, 4),
            "is_ungrounded": is_ungrounded,
            "circuit_breaker_status": cb.get_status(output.agent_id),
        },
        "timestamp": now,
    }


# ---------------------------------------------------------------------------
# POST /api/razorpay/webhook — Razorpay Live Webhook Ingest
# ---------------------------------------------------------------------------

@app.post("/api/razorpay/webhook")
async def razorpay_webhook(request: Request) -> dict:
    """Receive a signed Razorpay webhook, verify the HMAC-SHA256 signature,
    and convert dispute/fraud-refund events into ground-truth corrections
    for the calibration check.
    """
    body: bytes = await request.body()
    signature: str = request.headers.get("X-Razorpay-Signature", "")

    if not verify_razorpay_signature(body, signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    try:
        event: dict = json.loads(body)
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type: str = event.get("event", "")

    if event_type == "payment.dispute.created":
        case_id = (
            event.get("payload", {})
            .get("dispute", {})
            .get("entity", {})
            .get("payment_id")
        )
        if case_id:
            corrected_truth = "High risk: disputed post-approval"
            _record_ground_truth_correction(
                case_id=case_id,
                corrected_truth=corrected_truth,
                flag_type="ground_truth_update",
            )
            fire_alert(
                agent_id="unknown",
                flag_type="ground_truth_update",
                detail=f"Ground truth corrected for case {case_id}: {corrected_truth}",
            )

    elif event_type == "refund.created":
        refund_entity: dict = (
            event.get("payload", {})
            .get("refund", {})
            .get("entity", {})
        )
        reason: str = refund_entity.get("notes", {}).get("reason", "")
        if reason == "fraud":
            case_id = refund_entity.get("payment_id")
            if case_id:
                corrected_truth = "High risk: fraud refund"
                _record_ground_truth_correction(
                    case_id=case_id,
                    corrected_truth=corrected_truth,
                    flag_type="ground_truth_update",
                )
                fire_alert(
                    agent_id="unknown",
                    flag_type="ground_truth_update",
                    detail=f"Ground truth corrected for case {case_id}: {corrected_truth}",
                )

    return {"status": "received"}


# ---------------------------------------------------------------------------
# Health check & Static Frontend SPA Serving
# ---------------------------------------------------------------------------

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "sentinel"}


FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"

if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        # Don't intercept API routes or health check
        if full_path.startswith("api/") or full_path == "health":
            raise HTTPException(status_code=404, detail="API route not found")
        
        file_path = FRONTEND_DIST / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        
        index_path = FRONTEND_DIST / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        
        raise HTTPException(status_code=404, detail="Frontend dist not found")

