from flask import Blueprint, render_template, send_from_directory, current_app
from pathlib import Path

public_bp = Blueprint("public", __name__)

@public_bp.route("/")
def home():
    """Render the homepage."""
    return render_template("index.html")

@public_bp.get("/favicon.ico", endpoint="favicon")
def favicon():
    """
    Serve favicon for browsers.
    Looks in static/img/ for favicon.png or favicon.ico.
    """
    static_img = Path(current_app.static_folder) / "img"
    # Prefer .png, fallback to .ico
    for name, mime in [("favicon.png", "image/png"), ("favicon.ico", "image/x-icon")]:
        fpath = static_img / name
        if fpath.exists():
            return send_from_directory(static_img, name, mimetype=mime)
    # No favicon found → return 404
    return ("", 404)
