import sqlite3

conn = sqlite3.connect("movies.db")
try:
    conn.execute("ALTER TABLE download_links ADD COLUMN provider TEXT DEFAULT 'vegamovies'")
    conn.commit()
    print("Added provider column.")
except Exception as e:
    print("Error:", e)
finally:
    conn.close()
