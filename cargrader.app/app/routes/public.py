from flask import Blueprint, render_template, send_from_directory, current_app
from pathlib import Path

public_bp = Blueprint("public", __name__)

@public_bp.route("/")
def home():
    """Render the homepage."""
    mission_text = ""
    try:
        mission_path = Path(current_app.static_folder) / "content" / "mission.txt"
        if mission_path.exists():
            mission_text = mission_path.read_text(encoding="utf-8").strip()
    except Exception as e:
        current_app.logger.warning(f"Could not load mission.txt: {e}")
    return render_template("index.html", mission_text=mission_text)

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

