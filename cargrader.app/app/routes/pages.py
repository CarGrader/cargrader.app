# cargrader.app/app/routes/pages.py
from flask import Blueprint, render_template, current_app
import os

pages_bp = Blueprint("pages", __name__)

@pages_bp.get("/disclaimer")
def disclaimer():
    # Read the repo-stored text file
    path = os.path.join(current_app.static_folder, "content", "disclaimer.txt")
    try:
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()
    except FileNotFoundError:
        text = "Disclaimer file not found. Please add cargrader.app/static/content/disclaimer.txt"
    return render_template("disclaimer.html", text=text)
