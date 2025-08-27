import sqlite3
from flask import current_app
from contextlib import contextmanager

def _row_factory(cursor, row):
    return {col[0]: row[idx] for idx, col in enumerate(cursor.description)}

@contextmanager
def get_conn(readonly=False):
    db_path = current_app.config["DB_PATH"]
    con = sqlite3.connect(db_path, check_same_thread=False)
    con.row_factory = _row_factory
    if readonly:
        try:
            con.execute("PRAGMA query_only = ON;")
        except Exception:
            pass
    try:
        yield con
    finally:
        con.close()
