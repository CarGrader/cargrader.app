# cargrader.app/app/routes/auth.py
from flask import Blueprint, redirect, session, url_for, current_app, request
from authlib.integrations.flask_client import OAuth
import os
from authlib.integrations.base_client.errors import OAuthError

auth_bp = Blueprint("auth", __name__)
oauth = OAuth()  # initialized in create_app via init_auth below


def init_auth(app):
    """Call this from create_app(app) to register the Auth0 client."""
    oauth.init_app(app)
    oauth.register(
        "auth0",
        client_id=os.getenv("AUTH0_CLIENT_ID"),
        client_secret=os.getenv("AUTH0_CLIENT_SECRET"),
        client_kwargs={"scope": "openid profile email"},
        server_metadata_url=f"https://{os.getenv('AUTH0_DOMAIN')}/.well-known/openid-configuration",
    )


@auth_bp.get("/login")
def login():
    try:
        base = current_app.config.get("BASE_URL", "").rstrip("/")
        redirect_uri = f"{base}/callback" if base else url_for("auth.callback", _external=True)

        # Optional sanity checks (keep if you found them helpful)
        domain = os.getenv("AUTH0_DOMAIN")
        cid    = os.getenv("AUTH0_CLIENT_ID")
        csec   = os.getenv("AUTH0_CLIENT_SECRET")
        if not all([domain, cid, csec]):
            return (
                "Login configuration error:<br>"
                f"- AUTH0_DOMAIN: {'OK' if domain else 'MISSING'}<br>"
                f"- AUTH0_CLIENT_ID: {'OK' if cid else 'MISSING'}<br>"
                f"- AUTH0_CLIENT_SECRET: {'OK' if csec else 'MISSING'}<br>",
                500,
            )
        if domain.startswith("http"):
            return "AUTH0_DOMAIN must be a bare hostname (e.g., your-tenant.us.auth0.com), not a URL.", 500
        if base and not base.startswith("http"):
            return "BASE_URL must start with http(s), e.g., https://car-grader.com", 500

        # ✅ Look up the client; if missing, initialize and try again
        client = oauth.create_client("auth0")
        if client is None:
            from .auth import init_auth as _init_auth
            _init_auth(current_app)
            client = oauth.create_client("auth0")
            if client is None:
                return "Login configuration error: could not create 'auth0' client.", 500

        return client.authorize_redirect(redirect_uri=redirect_uri)

    except Exception as e:
        current_app.logger.exception("Login failed")
        return f"Login failed: {e}", 500

@auth_bp.get("/callback")
def callback():
    try:
        # This exchanges ?code=... for tokens and validates state
        token = oauth.create_client("auth0").authorize_access_token()
        userinfo = token.get("userinfo") or {}
    except OAuthError as oe:
        # Most likely: redirect_uri mismatch or missing/invalid state/cookie
        current_app.logger.exception("OAuthError during callback")
        return (
            "Callback failed (OAuthError):<br>"
            f"- error: {getattr(oe, 'error', None)}<br>"
            f"- description: {getattr(oe, 'description', None)}<br>"
            f"- uri: {getattr(oe, 'uri', None)}<br>",
            500,
        )
    except Exception as e:
        current_app.logger.exception("Unexpected callback error")
        return f"Callback failed (Exception): {e}", 500

    # Success → set session
    session["user"] = {
        "sub": userinfo.get("sub"),
        "email": userinfo.get("email"),
        "name": userinfo.get("name") or userinfo.get("nickname"),
        "picture": userinfo.get("picture"),
    }
    next_url = request.args.get("next")
    return redirect(next_url or url_for("public.index"))

@auth_bp.get("/logout")
def logout():
    domain = os.getenv("AUTH0_DOMAIN")
    session.clear()
    base = current_app.config.get("BASE_URL", "").rstrip("/")
    return redirect(
        f"https://{domain}/v2/logout?client_id={os.getenv('AUTH0_CLIENT_ID')}"
        f"&returnTo={(base or url_for('public.index', _external=True))}"
    )
