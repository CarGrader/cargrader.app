import sqlite3
import os

db_path = r"C:\Users\woogl\OneDrive\Documents\The CarGrader\Databases\GraderRater.db"

if not os.path.exists(db_path):
    print("DB file not found:", db_path)
    exit()

con = sqlite3.connect(db_path)
cur = con.cursor()

print("Tables in DB:")
for row in cur.execute("SELECT name FROM sqlite_master WHERE type='table';"):
    print("-", row[0])

print("\nSample schema for first few tables:")
for row in cur.execute("SELECT name, sql FROM sqlite_master WHERE type='table' LIMIT 5;"):
    print(row[0], "=>", row[1])

con.close()
