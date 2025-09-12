# cargrader.app/app/routes/auth.py
from flask import Blueprint, redirect, session, url_for, current_app, request
from authlib.integrations.flask_client import OAuth
import os

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

        # Collect env we depend on
        domain = os.getenv("AUTH0_DOMAIN")
        cid    = os.getenv("AUTH0_CLIENT_ID")
        csec   = os.getenv("AUTH0_CLIENT_SECRET")

        problems = []
        if not domain: problems.append("Missing AUTH0_DOMAIN")
        if not cid:    problems.append("Missing AUTH0_CLIENT_ID")
        if not csec:   problems.append("Missing AUTH0_CLIENT_SECRET")
        if not redirect_uri: problems.append("Could not construct redirect_uri")
        if domain and domain.startswith("http"):
            problems.append("AUTH0_DOMAIN must be a bare hostname (e.g. your-tenant.us.auth0.com), not a URL")
        if base and not base.startswith("http"):
            problems.append("BASE_URL must start with http(s) (e.g. https://car-grader.com)")

        # Log what we're using (masked)
        current_app.logger.info("Auth0 /login debug", extra={
            "redirect_uri": redirect_uri,
            "domain": domain,
            "client_id_prefix": (cid[:6] + "…") if cid else None,
        })

        if problems:
            # Return a readable page so you can fix env values quickly
            return (
                "Login configuration error:<br>" + "<br>".join(f"- {p}" for p in problems),
                500,
            )

        # Proceed to Auth0
        return oauth.auth0.authorize_redirect(redirect_uri=redirect_uri)

    except Exception as e:
        # Surface reason in log and response
        current_app.logger.exception("Login failed")
        return f"Login failed: {e}", 500


@auth_bp.get("/callback")
def callback():
    token = oauth.auth0.authorize_access_token()
    userinfo = token.get("userinfo") or {}
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
