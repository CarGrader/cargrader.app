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

@api_bp.get("/details")
def details():
    try:
        year  = request.args.get("year", type=int)
        make  = request.args.get("make", type=str)
        model = request.args.get("model", type=str)

        if not (year and make and model):
            return jsonify(error="Missing year/make/model"), 400

        with get_conn(readonly=True) as con:
            row = con.execute(queries.DETAILS_SQL, {
                "year": year, "make": make, "model": model
            }).fetchone()

        if not row:
            return jsonify(error="Not found"), 404

        # Compute the Y value and direction wording here to keep the front-end simple
        rel = row.get("RelRatio")
        # Guard against null or zero
        if rel is None or rel <= 0:
            y_value = None
            direction = None
        else:
            if rel >= 1:
                y_value = rel
                direction = "less"
            else:
                y_value = 1.0 / rel
                direction = "more"

        return jsonify({
            "year": row.get("ModelYear"),
            "make": row.get("Make"),
            "model": row.get("Model"),
            "group_id": row.get("GroupID"),
            "complaint_count": row.get("ComplaintCount"),
            "rel_ratio": rel,
            "y_value": y_value,
            "direction": direction
        })
    except Exception as e:
        return jsonify(error=f"/api/details failed: {e}"), 500



@api_bp.get("/top-complaints")
def top_complaints():
    # Return top 3 complaint components and summaries for a given Y/M/M.
    try:
        year = request.args.get("year")
        make = request.args.get("make")
        model = request.args.get("model")
        if not (year and make and model):
            return jsonify(ok=False, error="Missing year/make/model"), 400

        # Resolve GroupID
        from app.db.connection import get_conn
        group_id = None
        with get_conn(readonly=True) as con:
            cur = con.execute(
                """
                SELECT ac.GroupID
                FROM AllCars ac
                WHERE ac.ModelYear = :year
                  AND ac.Make      = :make
                  AND ac.Model     = :model
                ORDER BY (ac.Score IS NULL), ac.Score DESC
                LIMIT 1
                """,
                { "year": year, "make": make, "model": model }
            )
            row = cur.fetchone()
            if row:
                group_id = row.get("GroupID")

        if not group_id:
            return jsonify(ok=False, error="GroupID not found for selection"), 404

        # Pull top3 CSV from R2
        from ..services.r2 import get_bytes, get_text, R2Error
        import csv, io

        key_top3 = f"ResourceFiles/{group_id}/{group_id}_top3.csv"
        try:
            raw = get_bytes(key_top3)
        except R2Error:
            return jsonify(ok=True, group_id=group_id, items=[])

        buf = io.StringIO(raw.decode("utf-8", errors="replace"))
        reader = csv.DictReader(buf)
        items = []
        for r in reader:
            comp = (r.get("Component") or "").strip()
            pct  = r.get("Percentage")
            try:
                pct = float(pct)
            except Exception:
                pct = None

            summary = None
            if comp:
                import re as _re
                comp_key = _re.sub(r'[\\/]+', '_', comp.upper()).strip()
                key_sum = f"ResourceFiles/{group_id}/{comp_key}_llamasum.txt"
                try:
                    summary = get_text(key_sum).strip()
                    prefix = "Here is a two-sentence summary of the data:"
                    if summary[:len(prefix)].lower() == prefix.lower():
                        summary = summary[len(prefix):].lstrip()
                except R2Error:
                    summary = None

            items.append({ "component": comp, "percent": pct, "summary": summary })

        return jsonify(ok=True, group_id=group_id, items=items)
    except Exception as e:
        return jsonify(ok=False, error=f"/api/top-complaints failed: {e}"), 500


@api_bp.get("/trims")
def trims():
    """Return trim/series complaint counts & percentages for a given Y/M/M.

    Reads CSV from R2 at: ResourceFiles/{GroupID}/{GroupID}_ymmtscount.csv
    and returns an array of { name, count, percentage }.
    """
    try:
        year = request.args.get("year")
        make = request.args.get("make")
        model = request.args.get("model")
        if not (year and make and model):
            return jsonify(ok=False, error="Missing year/make/model"), 400

        # Resolve GroupID from DB (same approach as /top-complaints)
        from app.db.connection import get_conn
        group_id = None
        with get_conn(readonly=True) as con:
            cur = con.execute(
                """
                SELECT GroupID
                FROM AllCars
                WHERE ModelYear = ? AND Make = ? AND Model = ?
                LIMIT 1
                """,
                (year, make, model),
            )
            row = cur.fetchone()
            if row:
                group_id = row[0]
        if not group_id:
            return jsonify(ok=True, items=[])

        # Read CSV from R2
        from ..services.r2 import get_bytes, R2Error
        import csv, io

        key = f"ResourceFiles/{group_id}/{group_id}_ymmtscount.csv"
        try:
            raw = get_bytes(key)
        except R2Error as e:
            # Not found -> empty result is OK
            return jsonify(ok=True, group_id=group_id, items=[])

        f = io.StringIO(raw.decode("utf-8", errors="replace"))
        reader = csv.DictReader(f)
        items = []
        for row in reader:
            name = row.get("Name") or ""
            # normalize field names as expected by UI
            try:
                count = int(float(row.get("Count", 0)))
            except Exception:
                count = 0
            try:
                pct = float(row.get("Percentage", 0))
            except Exception:
                pct = 0.0
            items.append({
                "name": name.strip(),
                "count": count,
                "percentage": pct,
            })

        # Sort by count desc as a default
        items.sort(key=lambda x: x["count"], reverse=True)
        return jsonify(ok=True, group_id=group_id, items=items)
    except Exception as e:
        return jsonify(ok=False, error=f"/api/trims failed: {e}"), 500


@api_bp.get("/r2-check")
def r2_check():
    """Diagnostic: read a specific R2 key and return its size and first bytes."""
    try:
        key = request.args.get("key")
        if not key:
            return jsonify(ok=False, error="Missing key param"), 400
        from ..services.r2 import get_bytes, R2Error
        import binascii
        data = get_bytes(key)
        head = binascii.hexlify(data[:16]).decode("ascii")
        return jsonify(ok=True, key=key, size=len(data), head_hex=head)
    except Exception as e:
        return jsonify(ok=False, error=f"/api/r2-check failed: {e}")


