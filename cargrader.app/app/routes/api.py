import os
from flask import Blueprint, jsonify, request, current_app
from app.db.connection import get_conn
from app.db import queries

api_bp = Blueprint("api", __name__)

@api_bp.get("/health")
def health():
    info = {"ok": False}
    try:
        # 1) What the app sees for DB path
        env_db = os.environ.get("DB_PATH")
        cfg_db = current_app.config.get("DB_PATH")
        info["env_DB_PATH"] = env_db
        info["config_DB_PATH"] = cfg_db

        # 2) 🔎 DROP THE PROBE SNIPPET RIGHT HERE
        candidates = [
            "/opt/render/project/src/data/GraderRater.db",               # repo root
            "/opt/render/project/src/cargrader.app/data/GraderRater.db", # subfolder
            "/var/data/GraderRater.db",                                  # Render Disk (replace if your mount is different)
        ]
        probes = []
        for p in candidates:
            try:
                exists = os.path.exists(p)
                size = os.path.getsize(p) if exists else 0
                probes.append({"path": p, "exists": exists, "size": size})
            except Exception as _e:
                probes.append({"path": p, "error": str(_e)})
        info["probes"] = probes
        # 2) 🔎 END PROBE SNIPPET

        # 3) Fail fast if config path is missing
        if not cfg_db:
            info["error"] = "DB_PATH not set in config"
            return jsonify(info), 500

        # 4) Basic file checks for the configured path
        info["db_exists"] = os.path.exists(cfg_db)
        info["db_size_bytes"] = os.path.getsize(cfg_db) if info["db_exists"] else 0

        # 5) Try a real query only if the file exists
        with get_conn(readonly=True) as con:
            y = con.execute("""
                SELECT COUNT(DISTINCT ModelYear) AS c
                FROM AllCars WHERE ModelYear IS NOT NULL
            """).fetchone()
            info["years_count"] = y["c"] if y else 0
            info["ok"] = True

    except Exception as e:
        info["error"] = f"health failed: {e}"
        return jsonify(info), 500

    return jsonify(info)
@api_bp.get("/years")
def years():
    try:
        with get_conn(readonly=True) as con:
            rows = con.execute(queries.YEARS_SQL).fetchall()
        # row_factory returns dicts with keys matching SELECT names
        years = [r["ModelYear"] for r in rows]
        if not years:
            return jsonify(error="No years found in AllCars"), 404
        return jsonify(years=years)
    except Exception as e:
        # This will show in DevTools → Network if the UI still says "Failed to load Years"
        return jsonify(error=f"/api/years failed: {e}"), 500

@api_bp.get("/makes")
def makes():
    year = request.args.get("year", type=int)
    if year is None:
        return jsonify(error="Missing required param: year"), 400
    try:
        with get_conn(readonly=True) as con:
            rows = con.execute(queries.MAKES_SQL, {"year": year}).fetchall()
        return jsonify(makes=[r["Make"] for r in rows])
    except Exception as e:
        return jsonify(error=f"/api/makes failed: {e}"), 500

@api_bp.get("/models")
def models():
    year = request.args.get("year", type=int)
    make = request.args.get("make")
    if year is None or not make:
        return jsonify(error="Missing required params: year, make"), 400
    try:
        with get_conn(readonly=True) as con:
            rows = con.execute(queries.MODELS_SQL, {"year": year, "make": make}).fetchall()
        return jsonify(models=[r["Model"] for r in rows])
    except Exception as e:
        return jsonify(error=f"/api/models failed: {e}"), 500

@api_bp.get("/score")
def score():
    year = request.args.get("year", type=int)
    make = request.args.get("make")
    model = request.args.get("model")
    if year is None or not make or not model:
        return jsonify(error="Missing required params: year, make, model"), 400
    try:
        with get_conn(readonly=True) as con:
            row = con.execute(queries.SCORE_SQL, {
                "year": year, "make": make, "model": model
            }).fetchone()
        if not row:
            return jsonify(error="Not found"), 404
        return jsonify({
            "score": row.get("Score"),
            "certainty": row.get("Certainty"),
            "group_id": row.get("GroupID"),
        })
    except Exception as e:
        return jsonify(error=f"/api/score failed: {e}"), 500



