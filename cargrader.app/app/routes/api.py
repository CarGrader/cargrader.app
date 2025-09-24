import os
from flask import Blueprint, jsonify, request, current_app
from app.db.connection import get_conn
from app.db import queries
from app.utils.access import requires_pass

api_bp = Blueprint("api", __name__)

@api_bp.get("/health")
def health():
    info = {"ok": False}
    try:
        # DB paths for quick sanity
        env_db = os.environ.get("DB_PATH")
        cfg_db = current_app.config.get("DB_PATH")
        info["env_DB_PATH"] = env_db
        info["config_DB_PATH"] = cfg_db

        # Probe a few common disk locations (Render, repo, subfolder)
        candidates = [
            "/opt/render/project/src/data/GraderRater.db",
            "/opt/render/project/src/cargrader.app/data/GraderRater.db",
            "/var/data/GraderRater.db",
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

        if not cfg_db:
            info["error"] = "DB_PATH not set in config"
            return jsonify(info), 500

        info["db_exists"] = os.path.exists(cfg_db)
        info["db_size_bytes"] = os.path.getsize(cfg_db) if info["db_exists"] else 0

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

# ----------------------------
# Year/Make/Model primitives
# ----------------------------

@api_bp.get("/years")
def years():
    try:
        with get_conn(readonly=True) as con:
            rows = con.execute(queries.YEARS_SQL).fetchall()
        years = [r["ModelYear"] for r in rows]
        if not years:
            return jsonify(error="No years found in AllCars"), 404
        return jsonify(years=years)
    except Exception as e:
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

# ----------------------------
# Score + Details
# ----------------------------

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

        rel = row.get("RelRatio")
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

# ----------------------------
# Pass-gated data boxes
# ----------------------------

@api_bp.get("/top-complaints")
@requires_pass
def top_complaints():
    try:
        year = request.args.get("year")
        make = request.args.get("make")
        model = request.args.get("model")
        if not (year and make and model):
            return jsonify(ok=False, error="Missing year/make/model"), 400

        # Resolve GroupID
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

        # Read top3 from R2
        from ..services.r2 import get_bytes, get_text, R2Error
        import csv, io, re as _re

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
            try:
                pct = float(r.get("Percentage"))
            except Exception:
                pct = None

            summary = None
            if comp:
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
        return jsonify(ok=False, error=f"/api/top-complaints failed: {repr(e)}"), 500

@api_bp.get("/trims")
@requires_pass
def trims():
    """Return trim/series complaint counts & percentages for a given Y/M/M."""
    try:
        year = request.args.get("year")
        make = request.args.get("make")
        model = request.args.get("model")
        if not (year and make and model):
            return jsonify(ok=False, error="Missing year/make/model"), 400

        # GroupID
        group_id = None
        with get_conn(readonly=True) as con:
            cur = con.execute(
                """
                SELECT GroupID
                FROM AllCars
                WHERE ModelYear = ? AND Make = ? AND Model = ?
                LIMIT 1
                """,
                (year, make, model)
            )
            row = cur.fetchone()
            if row:
                group_id = row['GroupID']

        if group_id is None:
            return jsonify(ok=True, items=[], note="No GroupID for selection")

        # Read CSV from R2
        from ..services.r2 import get_bytes, R2Error
        import csv, io, botocore

        key = f"ResourceFiles/{group_id}/{group_id}_ymmtscount.csv"
        try:
            raw = get_bytes(key)
        except (R2Error, botocore.exceptions.ClientError):
            return jsonify(ok=True, group_id=group_id, items=[], note=f"Missing R2 object: {key}")

        try:
            f = io.StringIO(raw.decode("utf-8", errors="replace"))
            reader = csv.DictReader(f)
            items = []
            for row in reader:
                name = (row.get("Name") or "").strip()
                vcount = row.get("Count", 0)
                vpct = row.get("Percentage", 0)
                try:
                    count = int(float(vcount))
                except Exception:
                    count = 0
                try:
                    pct = float(vpct)
                except Exception:
                    pct = 0.0
                items.append({"name": name, "count": count, "percentage": pct})

            items.sort(key=lambda x: x["count"], reverse=True)
            return jsonify(ok=True, group_id=group_id, key=key, items=items)
        except Exception as parse_err:
            return jsonify(ok=True, group_id=group_id, key=key, items=[], note=f"CSV parse error: {parse_err}"), 200

    except Exception as e:
        return jsonify(ok=False, error=f"/api/trims failed: {repr(e)}"), 500

@api_bp.get("/history")
@requires_pass
def history():
    """Return complaint history as {year, actual, expected} for a given Y/M/M."""
    try:
        year = request.args.get("year")
        make = request.args.get("make")
        model = request.args.get("model")
        if not (year and make and model):
            return jsonify(ok=False, error="Missing year/make/model"), 400

        # GroupID
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
                group_id = row["GroupID"]

        if not group_id:
            return jsonify(ok=True, group_id=None, items=[])

        # Read CSV from R2
        from ..services.r2 import get_bytes, R2Error
        import csv, io, botocore
        key = f"ResourceFiles/{group_id}/{group_id}_cby.csv"

        try:
            raw = get_bytes(key)
        except (R2Error, botocore.exceptions.ClientError):
            return jsonify(ok=True, group_id=group_id, items=[], note=f"Missing R2 object: {key}")

        try:
            f = io.StringIO(raw.decode("utf-8", errors="replace"))
            reader = csv.DictReader(f)
            items = []
            for r in reader:
                try:
                    y  = int((r.get("Year") or "").strip())
                except Exception:
                    continue
                def _to_num(val):
                    try:
                        return float(str(val).replace(",", "").strip())
                    except Exception:
                        return None
                actual   = _to_num(r.get("Actual Count"))
                expected = _to_num(r.get("Expected Count"))
                items.append({"year": y, "actual": actual, "expected": expected})
            items.sort(key=lambda x: x["year"])
            return jsonify(ok=True, group_id=group_id, items=items)
        except Exception as parse_err:
            return jsonify(ok=True, group_id=group_id, items=[], note=f"CSV parse error: {parse_err}")
    except Exception as e:
        return jsonify(ok=False, error=f"/api/history failed: {repr(e)}"), 500

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

# ----------------------------
# Filtered Lookup helpers
# ----------------------------

def _build_in_clause(prefix: str, values: list[str]):
    """
    Returns (clause_sql, params_dict).
    Example: values=['Ford','Toyota'] ->
      ('IN (:m0,:m1)', {'m0':'Ford','m1':'Toyota'})
    """
    if not values:
        return "", {}
    keys = [f"{prefix}{i}" for i in range(len(values))]
    clause = "IN (" + ",".join(f":{k}" for k in keys) + ")"
    params = {k: v for k, v in zip(keys, values)}
    return clause, params

# ----------------------------
# Filtered Lookup endpoints
# ----------------------------

@api_bp.get("/filter/makes")
def filter_makes():
    """Distinct makes across a year range."""
    min_year = request.args.get("min_year", type=int)
    max_year = request.args.get("max_year", type=int)
    if min_year is None or max_year is None:
        return jsonify(error="Missing min_year/max_year"), 400
    if min_year > max_year:
        min_year, max_year = max_year, min_year

    try:
        with get_conn(readonly=True) as con:
            rows = con.execute(
                queries.FILTER_MAKES_RANGE_SQL,
                {"min_year": min_year, "max_year": max_year}
            ).fetchall()
        return jsonify(ok=True, makes=[r["Make"] for r in rows])
    except Exception as e:
        return jsonify(ok=False, error=f"/filter/makes failed: {e}"), 500

@api_bp.get("/filter/models")
def filter_models():
    """
    Distinct models across a year range, optionally restricted to a list of makes.
    Query params:
      min_year, max_year
      makes=comma,separated,list
    """
    min_year = request.args.get("min_year", type=int)
    max_year = request.args.get("max_year", type=int)
    makes_raw = request.args.get("makes", "", type=str).strip()
    if min_year is None or max_year is None:
        return jsonify(error="Missing min_year/max_year"), 400
    if min_year > max_year:
        min_year, max_year = max_year, min_year

    makes = [m for m in (s.strip() for s in makes_raw.split(",")) if m] if makes_raw else []
    makes_clause, make_params = _build_in_clause("m", makes)
    makes_sql = f"AND Make {makes_clause}" if makes_clause else ""

    sql = queries.FILTER_MODELS_RANGE_SQL_BASE.format(makes_clause=makes_sql)

    try:
        params = {"min_year": min_year, "max_year": max_year, **make_params}
        with get_conn(readonly=True) as con:
            rows = con.execute(sql, params).fetchall()
        return jsonify(ok=True, models=[r["Model"] for r in rows])
    except Exception as e:
        return jsonify(ok=False, error=f"/filter/models failed: {e}"), 500

@api_bp.get("/filter/search")
@requires_pass
def filter_search():
    """
    Return rows (Year, Make, Model, Score) across a year range with optional
    multi-make, multi-model, and min/max score filters. Max 100 rows.
    Query params:
      min_year, max_year (required)
      makes=comma,separated,list (optional)
      models=comma,separated,list (optional)
      min_score, max_score (optional; leave blank for no bound)
      limit (optional; default 100; capped at 100)
    """
    min_year = request.args.get("min_year", type=int)
    max_year = request.args.get("max_year", type=int)
    limit    = request.args.get("limit", default=100, type=int)
    limit = max(1, min(limit, 100))

    if min_year is None or max_year is None:
        return jsonify(ok=False, error="Missing min_year/max_year"), 400
    if min_year > max_year:
        min_year, max_year = max_year, min_year

    makes_raw  = request.args.get("makes", "", type=str).strip()
    models_raw = request.args.get("models", "", type=str).strip()
    min_score  = request.args.get("min_score", type=float)
    max_score  = request.args.get("max_score", type=float)

    makes  = [m for m in (s.strip() for s in makes_raw.split(",")) if m] if makes_raw else []
    models = [m for m in (s.strip() for s in models_raw.split(",")) if m] if models_raw else []

    makes_clause, make_params   = _build_in_clause("m", makes)
    models_clause, model_params = _build_in_clause("d", models)

    makes_sql  = f"AND Make {makes_clause}" if makes_clause else ""
    models_sql = f"AND Model {models_clause}" if models_clause else ""

    if min_score is not None and max_score is not None:
        score_sql = "AND Score BETWEEN :min_score AND :max_score"
    elif min_score is not None:
        score_sql = "AND Score >= :min_score"
    elif max_score is not None:
        score_sql = "AND Score <= :max_score"
    else:
        score_sql = ""

    sql = queries.FILTER_SEARCH_SQL_BASE.format(
        makes_clause=makes_sql,
        models_clause=models_sql,
        score_clause=score_sql
    )

    try:
        params = {
            "min_year": min_year,
            "max_year": max_year,
            "limit":    limit,
            **make_params,
            **model_params,
        }
        if min_score is not None: params["min_score"] = min_score
        if max_score is not None: params["max_score"] = max_score

        with get_conn(readonly=True) as con:
            rows = con.execute(sql, params).fetchall()
        data = [
            {"year": r["Year"], "make": r["Make"], "model": r["Model"], "score": r["Score"]}
            for r in rows
        ]
        return jsonify(ok=True, rows=data, capped=(len(data) >= limit))
    except Exception as e:
        return jsonify(ok=False, error=f"/filter/search failed: {e}"), 500
