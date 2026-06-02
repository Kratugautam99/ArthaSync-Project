import psycopg
conn = psycopg.connect("postgres://arthasync_user:HKHV@localhost:5432/arthasync")
cur = conn.cursor()
cur.execute("SELECT * FROM arthasync.users;")
print(cur.fetchone())
