"""Quick check of the movies.db database."""
import sqlite3

conn = sqlite3.connect("movies.db")
conn.row_factory = sqlite3.Row

print("=== Stats ===")
print(f"Movies: {conn.execute('SELECT COUNT(*) FROM movies').fetchone()[0]}")
print(f"Links:  {conn.execute('SELECT COUNT(*) FROM download_links').fetchone()[0]}")

print("\n=== Sample Movies ===")
rows = conn.execute("SELECT title, year FROM movies ORDER BY scraped_at DESC LIMIT 15").fetchall()
for r in rows:
    print(f"  {r['title']} ({r['year']})")

print("\n=== Sample Download Links ===")
rows = conn.execute("""
    SELECT m.title, dl.quality, dl.size, dl.url
    FROM download_links dl
    JOIN movies m ON m.id = dl.movie_id
    LIMIT 8
""").fetchall()
for r in rows:
    print(f"  {r['title']} | {r['quality']} | {r['size']} | {r['url'][:60]}...")

# Test FTS
print("\n=== FTS Search Test ===")
try:
    rows = conn.execute("""
        SELECT m.title, m.year 
        FROM movies_fts fts
        JOIN movies m ON m.id = fts.rowid
        WHERE movies_fts MATCH '"mortal"*'
        LIMIT 3
    """).fetchall()
    for r in rows:
        print(f"  FTS match: {r['title']} ({r['year']})")
    if not rows:
        print("  No FTS matches (index may be empty)")
except Exception as e:
    print(f"  FTS error: {e}")

conn.close()
