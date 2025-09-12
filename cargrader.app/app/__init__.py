# app/__init__.py
from flask import Flask
from .routes.public import public_bp
from .routes.api import api_bp
from .routes.pages import pages_bp
from .routes.admin import admin_bp
from pathlib import Path
from dotenv import load_dotenv
from .routes.auth 
import auth_bp
import json
import os

load_dotenv()

def create_app(config_object="config.Config"):
    # These relative folders already point one level up:
    # ../templates  -> cargrader.app/templates
    # ../static     -> cargrader.app/static
    app = Flask(__name__, template_folder="../templates", static_folder="../static")
    app.config.from_object(config_object)

    app.secret_key = os.getenv("APP_SESSION_SECRET", "dev-not-secret")
    app.config["BASE_URL"] = os.getenv("BASE_URL", "http://localhost:5000")

    # ---------- blurbs wiring (BEGIN) ----------
    def _load_blurbs_for(app):
        path = Path(app.static_folder) / "blurbs.json"   # cargrader.app/static/blurbs.json
        app.logger.info(f"[blurbs] loading from {path}")
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                raise ValueError("blurbs.json must be a JSON object (key -> string).")
            app.config["BLURBS"] = data
            app.logger.info(f"[blurbs] loaded keys={list(data.keys())}")
        except Exception as e:
            app.logger.warning(f"[blurbs] load failed from {path}: {e}")
            app.config["BLURBS"] = {}

    _load_blurbs_for(app)

    @app.context_processor
    def inject_blurbs():
        # makes `blurbs` available in all Jinja templates
        return {"blurbs": app.config.get("BLURBS", {})}

    # Optional: quick debug endpoint (remove later if you want)
    @app.get("/_debug/blurbs")
    def bl_debug():
        payload = app.config.get("BLURBS", {})
        return {
            "count": len(payload) if isinstance(payload, dict) else 0,
            "keys": list(payload.keys()) if isinstance(payload, dict) else [],
            "static_folder": app.static_folder,
        }
    # ---------- blurbs wiring (END) ----------

    # Blueprints
    app.register_blueprint(public_bp)
    app.register_blueprint(api_bp, url_prefix="/api")
    app.register_blueprint(admin_bp, url_prefix="/admin")
    app.register_blueprint(pages_bp)
    app.register_blueprint(auth_bp)

    return app





