# cargrader.app/app/routes/pages.py
from flask import Blueprint, render_template, current_app
import os
from flask import session
from app.utils.access import has_active_pass_for_session

pages_bp = Blueprint("pages", __name__)

@pages_bp.get("/disclaimer")
def disclaimer():
    path = os.path.join(current_app.static_folder, "content", "disclaimer.txt")
    try:
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()
    except FileNotFoundError:
        text = "Disclaimer file not found. Please add cargrader.app/static/content/disclaimer.txt"
    return render_template("disclaimer.html", text=text)

@pages_bp.get("/terms")
def terms():
    path = os.path.join(current_app.static_folder, "content", "terms.txt")
    try:
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()
    except FileNotFoundError:
        text = "Terms and Conditions file not found. Please add cargrader.app/static/content/terms.txt"
    return render_template("terms.html", text=text)

@pages_bp.get("/privacy")
def privacy():
    path = os.path.join(current_app.static_folder, "content", "privacy.txt")
    try:
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()
    except FileNotFoundError:
        text = "Privacy Policy file not found. Please add cargrader.app/static/content/privacy.txt"
    return render_template("privacy.html", text=text)

@pages_bp.get("/about")
def about():
    path = os.path.join(current_app.static_folder, "content", "about.txt")
    try:
        with open(path, "r", encoding="utf-8") as f:
            text = f.read().strip()
    except FileNotFoundError:
        text = "About file not found. Please add cargrader.app/static/content/about.txt"
    return render_template("about.html", text=text)
    
@pages_bp.get("/lookup")
def lookup():
    # mirror the flags used on the homepage
    is_logged_in = bool(session.get("user"))
    has_pass = has_active_pass_for_session()
    return render_template("lookup.html", is_logged_in=is_logged_in, has_pass=has_pass)

