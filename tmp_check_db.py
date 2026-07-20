import psycopg2, os
conn = psycopg2.connect(
    host='postgres', port=5432,
    user=os.environ.get('DB_USERNAME', 'wibsite'),
    password=os.environ.get('DB_PASSWORD', 'wibsite_pass'),
    dbname=os.environ.get('DB_DATABASE', 'dify')
)
cur = conn.cursor()
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
all_tables = [t[0] for t in cur.fetchall()]
for t in all_tables:
    if 'provider' in t.lower() or 'model' in t.lower():
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=%s", (t,))
        cols = [c[0] for c in cur.fetchall()]
        print(f'{t}: {cols}')
cur.close()
conn.close()
