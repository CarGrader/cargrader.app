import sqlite3

# Connect to the database
db_path = r'C:\Users\woogl\Documents\The CarGrader\Databases\GraderRater.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print("Tables in database:")
for table in tables:
    print(f"  {table[0]}")

print("\n" + "="*50)

# Examine AllCars table structure
print("AllCars table structure:")
cursor.execute("PRAGMA table_info(AllCars);")
columns = cursor.fetchall()
for col in columns:
    print(f"  {col[1]} ({col[2]})")

print("\n" + "="*50)

# Sample data from AllCars
print("Sample AllCars data:")
cursor.execute("SELECT * FROM AllCars LIMIT 3;")
rows = cursor.fetchall()
for i, row in enumerate(rows):
    print(f"Row {i+1}: {row}")

print("\n" + "="*50)

# Check if there's a complaints table
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%complaint%';")
complaint_tables = cursor.fetchall()
print("Tables with 'complaint' in name:")
for table in complaint_tables:
    print(f"  {table[0]}")

# Check for any table that might contain complaint data
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
all_tables = cursor.fetchall()
print("\nAll tables:")
for table in all_tables:
    print(f"  {table[0]}")

conn.close()
