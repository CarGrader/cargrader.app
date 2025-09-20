# cargrader.app/app/__init__.py
from flask import Flask
import os
from dotenv import load_dotenv

from .routes.public import public_bp
from .routes.api import api_bp
from .routes.pages import pages_bp
from .routes.admin import admin_bp
from .routes.auth import auth_bp, init_auth  # includes init_auth()

from .routes.billing import billing_bp
from .utils.access import ensure_pass_tables, has_active_pass_for_session

load_dotenv()  # load environment vars once when module imports


def create_app(config_object="config.Config"):
    # Templates/static are one level up from this package
    app = Flask(__name__, template_folder="../templates", static_folder="../static")
    app.config.from_object(config_object)

    # Sessions + base URL
    app.secret_key = os.getenv("APP_SESSION_SECRET") or os.urandom(32)
    app.config["BASE_URL"] = (os.getenv("BASE_URL") or "http://localhost:5000").rstrip("/")

    # Initialize Auth0 client on the shared OAuth instance
    init_auth(app)

    # Ensure DB has the Passes table
    with app.app_context():
        ensure_pass_tables()

    # Make has_active_pass available in Jinja templates
    @app.context_processor
    def inject_access_flags():
        return {"has_active_pass": has_active_pass_for_session()}
    
    # Blueprints
    app.register_blueprint(public_bp)
    app.register_blueprint(api_bp, url_prefix="/api")
    app.register_blueprint(admin_bp, url_prefix="/admin")
    app.register_blueprint(pages_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(billing_bp)

    # (Optional) quick debug route to verify session after login; remove if undesired.
    @app.get("/whoami")
    def whoami():
        from flask import session, jsonify
        return jsonify(session.get("user") or {})

    return app

