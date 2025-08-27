from flask import Blueprint, jsonify, request
from app.db.connection import get_conn
from app.db import queries

api_bp = Blueprint("api", __name__)

@api_bp.get("/health")
def health():
    info = {"ok": False, "db_path": None, "tables": [], "years_count": 0}
    try:
        with get_conn(readonly=True) as con:
            info["db_path"] = con.execute("PRAGMA database_list;").fetchone().get("file")
            info["tables"]  = [r["name"] for r in con.execute("""
                SELECT name FROM sqlite_master WHERE type='table'
            """).fetchall()]
            y = con.execute("""
                SELECT COUNT(DISTINCT ModelYear) AS c FROM AllCars WHERE ModelYear IS NOT NULL
            """).fetchone()
            info["years_count"] = y["c"] if y else 0
            info["ok"] = True
    except Exception as e:
        return jsonify(error=f"health failed: {e}", **info), 500
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
