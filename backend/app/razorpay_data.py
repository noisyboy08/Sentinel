"""Razorpay Payments API client — fetches real payment details and converts
them into evidence strings that can enrich an EvalCase's evidence_pool.

Credential gating
-----------------
Requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to be set in the environment
(or backend/.env).  If either is absent the client returns an empty list for
every call, so the system degrades gracefully to the static eval-set evidence —
no crash, no warning spam.

Test-mode vs live
-----------------
The Razorpay API endpoint is identical for test and live keys; Razorpay
determines which mode to use from the key prefix (rzp_test_* vs rzp_live_*).
Set test-mode keys from: Dashboard → Settings → API Keys → Test Mode.
"""
from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from base64 import b64encode

logger = logging.getLogger("sentinel.razorpay_data")

RAZORPAY_API_BASE = "https://api.razorpay.com/v1"

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _credentials() -> tuple[str, str] | None:
    """Return (key_id, key_secret) if both env vars are set, else None."""
    key_id = os.getenv("RAZORPAY_KEY_ID", "").strip()
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "").strip()
    if key_id and key_secret:
        return key_id, key_secret
    return None


def _basic_auth_header(key_id: str, key_secret: str) -> str:
    token = b64encode(f"{key_id}:{key_secret}".encode()).decode()
    return f"Basic {token}"


def _api_get(path: str, key_id: str, key_secret: str) -> dict:
    """Make a GET request to the Razorpay API and return the parsed JSON."""
    url = f"{RAZORPAY_API_BASE}{path}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": _basic_auth_header(key_id, key_secret),
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=8) as resp:
        return json.loads(resp.read().decode())


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_payment_evidence(payment_id: str) -> list[str]:
    """Fetch real payment details from Razorpay and return them as a list of
    plain-English evidence strings suitable for an EvalCase evidence_pool.

    Returns an empty list if:
    - credentials are not configured (graceful degradation)
    - the payment_id is not a Razorpay ID (doesn't start with 'pay_')
    - the API call fails for any reason (network error, 404, rate limit, etc.)

    Never raises — all errors are caught and logged at WARNING level.
    """
    if not payment_id or not payment_id.startswith("pay_"):
        return []

    creds = _credentials()
    if creds is None:
        logger.debug(
            "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set — "
            "skipping live evidence fetch for %s",
            payment_id,
        )
        return []

    key_id, key_secret = creds
    try:
        data = _api_get(f"/payments/{payment_id}", key_id, key_secret)
    except urllib.error.HTTPError as exc:
        logger.warning(
            "Razorpay API HTTP %s for payment %s: %s",
            exc.code, payment_id, exc.reason,
        )
        return []
    except Exception as exc:
        logger.warning(
            "Razorpay API call failed for payment %s: %s",
            payment_id, exc,
        )
        return []

    return _payment_to_evidence(data)


def _payment_to_evidence(p: dict) -> list[str]:
    """Convert a Razorpay payment object into readable evidence strings."""
    evidence: list[str] = []

    pid = p.get("id", "unknown")
    amount_paise = p.get("amount", 0)
    amount_rupees = amount_paise / 100
    currency = p.get("currency", "INR")
    status = p.get("status", "unknown")
    method = p.get("method", "unknown")

    evidence.append(
        f"Payment {pid}: ₹{amount_rupees:,.2f} {currency}, "
        f"status={status}, method={method}."
    )

    # Method-specific details
    if method == "card":
        network = p.get("card", {}).get("network", "")
        issuer = p.get("card", {}).get("issuer", "")
        card_type = p.get("card", {}).get("type", "")
        if network or issuer:
            evidence.append(
                f"Card details: network={network or 'N/A'}, "
                f"issuer={issuer or 'N/A'}, type={card_type or 'N/A'}."
            )
    elif method == "upi":
        vpa = p.get("vpa", "")
        if vpa:
            evidence.append(f"UPI transaction via VPA: {vpa}.")
    elif method == "netbanking":
        bank = p.get("bank", "")
        if bank:
            evidence.append(f"Netbanking transaction via bank: {bank}.")
    elif method == "wallet":
        wallet = p.get("wallet", "")
        if wallet:
            evidence.append(f"Wallet payment via: {wallet}.")

    # Capture / refund status
    captured = p.get("captured", False)
    if captured:
        evidence.append(f"Payment {pid} successfully captured by merchant.")
    else:
        evidence.append(f"Payment {pid} not yet captured.")

    refund_status = p.get("refund_status")
    amount_refunded = p.get("amount_refunded", 0)
    if refund_status:
        evidence.append(
            f"Refund status: {refund_status} "
            f"(₹{amount_refunded / 100:,.2f} refunded)."
        )

    # Error info (failed payments)
    error_code = p.get("error_code")
    error_desc = p.get("error_description")
    if error_code:
        evidence.append(
            f"Payment error: [{error_code}] {error_desc or 'no description'}."
        )

    # International flag
    if p.get("international"):
        evidence.append("Payment originated from an international card/account.")

    # Fee & tax (available after capture)
    fee = p.get("fee")
    tax = p.get("tax")
    if fee is not None and tax is not None:
        evidence.append(
            f"Processing fee: ₹{fee / 100:,.2f} (tax ₹{tax / 100:,.2f})."
        )

    return evidence
