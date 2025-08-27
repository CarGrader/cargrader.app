from flask import Blueprint, render_template

public_bp = Blueprint("public", __name__)

@public_bp.get("/")
def home():
    # Your existing landing page (if you had index.html in project root, move it into templates/)
    return render_template("index.html")

from flask import Blueprint, render_template, current_app, send_from_directory
import os

public_bp = Blueprint("public", __name__)

@public_bp.get("/")
def home():
    return render_template("index.html")

@public_bp.get("/favicon.ico")
def favicon():
    static_dir = os.path.join(os.path.dirname(current_app.root_path), "static")
    return send_from_directory(static_dir, "favicon.ico", mimetype="image/vnd.microsoft.icon")

