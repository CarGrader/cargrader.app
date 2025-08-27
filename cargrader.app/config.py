import os

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret")
    DB_PATH = os.environ.get("DB_PATH") or "/var/data/GraderRater.db"


