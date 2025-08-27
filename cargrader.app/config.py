import os

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret")
    ENV = os.environ.get("FLASK_ENV", "production")
    DEBUG = ENV == "development"

    # SQLite URI like: file:path?mode=ro&cache=shared (we’ll centralize connection in app/db/connection.py)
    DB_PATH = os.environ.get("DB_PATH", "C:/Users/woogl/OneDrive/Documents/The CarGrader/Databases/GraderRater.db")
