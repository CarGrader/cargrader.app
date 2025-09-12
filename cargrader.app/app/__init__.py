# cargrader.app/app/__init__.py
from flask import Flask
from pathlib import Path
import json
import os
from dotenv import load_dotenv

from .routes.public import public_bp
from .routes.api import api_bp
from .routes.pages import pages_bp
from .routes.admin import admin_bp
from .routes.auth import auth_bp, init_auth   # ✅ correct import

load_dotenv()  # load env once

def create_app(config_object="config.Config"):
    # These relative folders already point one level up:
    # ../templates  -> cargrader.app/templates
    # ../static     -> cargrader.app/static
    app = Flask(__name__, template_folder="../templates", static_folder="../static")
    app.config.from_object(config_object)

    # Sessions + base URL
    app.secret_key = os.getenv("APP_SESSION_SECRET", "dev-not-secret")
    app.config["BASE_URL"] = os.getenv("BASE_URL", "http://localhost:5000")

    # Blueprints
    app.register_blueprint(public_bp)
    app.register_blueprint(api_bp, url_prefix="/api")
    app.register_blueprint(admin_bp, url_prefix="/admin")
    app.register_blueprint(pages_bp)
    app.register_blueprint(auth_bp)

    return app

