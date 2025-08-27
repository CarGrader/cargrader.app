from flask import Flask
from .routes.public import public_bp
from .routes.api import api_bp
from .routes.admin import admin_bp

def create_app(config_object="config.Config"):
    app = Flask(__name__, template_folder="../templates", static_folder="../static")
    app.config.from_object(config_object)

    # Blueprints
    app.register_blueprint(public_bp)
    app.register_blueprint(api_bp, url_prefix="/api")
    app.register_blueprint(admin_bp, url_prefix="/admin")

    return app
