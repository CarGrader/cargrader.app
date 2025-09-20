# cargrader.app/app/utils/access.py
from functools import wraps
from flask import session, redirect, url_for, request, current_app, jsonify
from app.db.connection import get_conn
import datetime as dt

def ensure_pass_tables():
    """Create the Passes table if it doesn't exist."""
    with get_conn() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS Passes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_sub TEXT NOT NULL,
                days INTEGER NOT NULL,
                starts_at TEXT NOT NULL,   -- UTC ISO8601
                expires_at TEXT NOT NULL,  -- UTC ISO8601
                status TEXT NOT NULL DEFAULT 'active',
                stripe_session_id TEXT UNIQUE,
                stripe_customer_id TEXT
            )
        """)
        con.execute("CREATE INDEX IF NOT EXISTS idx_passes_user ON Passes(user_sub)")
        con.commit()

def _utcnow_iso():
    return dt.datetime.utcnow().replace(microsecond=0).isoformat()

def has_active_pass(user_sub: str) -> bool:
    now = _utcnow_iso()
    with get_conn(readonly=True) as con:
        row = con.execute("""
            SELECT 1
            FROM Passes
            WHERE user_sub = :u
              AND status = 'active'
              AND expires_at >= :now
            ORDER BY expires_at DESC
            LIMIT 1
        """, {"u": user_sub, "now": now}).fetchone()
    return bool(row)

def has_active_pass_for_session() -> bool:
    u = session.get("user")
    if not u: 
        return False
    return has_active_pass(u.get("sub"))

def grant_or_extend_pass(user_sub: str, days: int, stripe_session_id: str | None, stripe_customer_id: str | None):
    now = dt.datetime.utcnow()
    now_iso = now.replace(microsecond=0).isoformat()

    # If user already has an active pass, extend from current expiry; otherwise start now.
    with get_conn() as con:
        r = con.execute("""
            SELECT expires_at
            FROM Passes
            WHERE user_sub = :u AND status='active'
            ORDER BY expires_at DESC
            LIMIT 1
        """, {"u": user_sub}).fetchone()

        if r and r["expires_at"]:
            start = dt.datetime.fromisoformat(r["expires_at"])
            if start < now:  # already expired
                start = now
        else:
            start = now

        new_expires = (start + dt.timedelta(days=days)).replace(microsecond=0).isoformat()

        con.execute("""
            INSERT INTO Passes (user_sub, days, starts_at, expires_at, status, stripe_session_id, stripe_customer_id)
            VALUES (:u, :days, :starts, :expires, 'active', :cs, :cust)
        """, {
            "u": user_sub,
            "days": int(days),
            "starts": start.replace(microsecond=0).isoformat(),
            "expires": new_expires,
            "cs": stripe_session_id,
            "cust": stripe_customer_id
        })
        con.commit()

def requires_pass(view):
    """For routes (esp. API) that require an active pass."""
    @wraps(view)
    def wrapper(*args, **kwargs):
        if "user" not in session:
            return redirect(url_for("auth.login", next=request.path))
        if not has_active_pass(session["user"]["sub"]):
            # JSON for API routes; redirect to /store for pages.
            if request.path.startswith("/api/"):
                return jsonify(ok=False, error="PASS_REQUIRED"), 402
            return redirect(url_for("billing.store"))
        return view(*args, **kwargs)
    return wrapper
