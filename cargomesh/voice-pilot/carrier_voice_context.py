"""Fail-closed interpretation of server-signed Carrier time snapshots; no business tools."""
from datetime import datetime, timezone, timedelta
import math

PET = timezone(timedelta(hours=-5))

def instant(raw):
    if not isinstance(raw, str) or len(raw) > 40:
        return None
    try:
        value = datetime.fromisoformat(raw.replace('Z', '+00:00'))
        return value.timestamp() if value.tzinfo else None
    except (ValueError, OverflowError):
        return None

def carrier_context(opportunity, now=None):
    current = datetime.now(timezone.utc).timestamp() if now is None else now
    context = opportunity.get('temporal')
    fallback = ("Current commercial status is unverified. Do not say the deadline is open, "
                "ask for a proposed price, or suggest preparing, accepting or sending an offer. "
                "Offer to review recorded details or refresh the opportunity on the Web.")
    if not isinstance(current, (int,float)) or not math.isfinite(current) or not isinstance(context, dict):
        return fallback, 0
    issued, until, deadline = (instant(context.get(key)) for key in ('asOf', 'validUntil', 'responseDeadline'))
    if (context.get('schemaVersion') != '1.0' or context.get('timeZone') != 'America/Lima'
            or issued is None or until is None or not issued <= current < until <= issued + 240):
        return fallback, 0
    expired = deadline is not None and deadline <= current
    open_now = (deadline is not None and deadline > current and context.get('deadlineState') == 'OPEN')
    allowed = (open_now and context.get('mayPrepareOffer') is True
               and context.get('requestReviewable') is True
               and context.get('opportunityStatus') in ('SENT', 'ACCEPTED', 'OFFERED'))
    clock = datetime.fromtimestamp(current, timezone.utc).isoformat()
    peru = datetime.fromtimestamp(current, PET).isoformat()
    facts = (f"Authoritative session time: {clock} UTC; {peru} Peru (America/Lima). "
             f"Recorded opportunity status: {context.get('opportunityStatus', 'unknown')}. "
             "These facts describe a snapshot, not command authorization. ")
    if expired:
        facts += ("The response deadline has already passed. Say clearly that it is expired. "
                  "Do not invite preparing, accepting, adjusting a price, or issuing a new offer for it. "
                  "Offer to review its history or open a different current opportunity. "
                  "An expired opportunity does not cancel an existing booking or execution. ")
    elif allowed:
        facts += ("The response deadline is open as of this snapshot. You may explain how to review "
                  "Prepare offer on the Web, subject to its current checks. Do not claim current capacity, "
                  "an issued offer or consent. The Web must revalidate status and time before any action. ")
    else:
        facts += fallback
    return facts, max(0, min(240, until-current, deadline-current if open_now else 240))

def carrier_opening():
    return "Summarize the recorded opportunity and its verified deadline state. Suggest only an allowed next step."
