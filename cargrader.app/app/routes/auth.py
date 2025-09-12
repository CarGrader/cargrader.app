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
    # Use external URL via BASE_URL to avoid callback mismatch
    base = current_app.config.get("BASE_URL", "").rstrip("/")
    redirect_uri = f"{base}/callback" if base else url_for("auth.callback", _external=True)
    return oauth.auth0.authorize_redirect(redirect_uri=redirect_uri)


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
