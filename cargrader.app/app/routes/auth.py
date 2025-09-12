# cargrader.app/app/routes/auth.py
from flask import Blueprint, redirect, session, url_for, current_app, request
from authlib.integrations.flask_client import OAuth
import os

auth_bp = Blueprint("auth", __name__)
oauth = OAuth()

def _init_oauth(app):
    oauth.register(
        "auth0",
        client_id=os.getenv("AUTH0_CLIENT_ID"),
        client_secret=os.getenv("AUTH0_CLIENT_SECRET"),
        client_kwargs={"scope": "openid profile email"},
        server_metadata_url=f"https://{os.getenv('AUTH0_DOMAIN')}/.well-known/openid-configuration",
    )

@auth_bp.before_app_first_request
def bind_oauth():
    _init_oauth(current_app)

@auth_bp.get("/login")
def login():
    base = current_app.config["BASE_URL"].rstrip("/")
    return oauth.auth0.authorize_redirect(redirect_uri=f"{base}/callback")

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
    # TODO: upsert user in DB (sub, email, stripe_customer_id) in Phase 2
    next_url = request.args.get("next")
    return redirect(next_url or url_for("public.index"))

@auth_bp.get("/logout")
def logout():
    domain = os.getenv("AUTH0_DOMAIN")
    session.clear()
    base = current_app.config["BASE_URL"].rstrip("/")
    return redirect(
        f"https://{domain}/v2/logout?client_id={os.getenv('AUTH0_CLIENT_ID')}"
        f"&returnTo={base}/"
    )
