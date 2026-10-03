import sqlite3
import os

# Read the SQL file
sql_file_path = os.path.join(os.environ['TEMP'], 'fb_test.sql')
db_file_path = os.path.join(os.environ['TEMP'], 'fb_test.db')

with open(sql_file_path, 'r') as f:
    sql_content = f.read()

print("SQL Content:")
print(sql_content[:500])

# Create database and run SQL
conn = sqlite3.connect(db_file_path)
conn.executescript(sql_content)
tables = conn.execute("select name from sqlite_master where type='table' order by 1").fetchall()
print("Tables created:")
for table in tables:
    print(f"  - {table[0]}")

conn.close()