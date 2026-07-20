import psycopg2, os
conn = psycopg2.connect(
    host='postgres', port=5432,
    user=os.environ.get('DB_USERNAME', 'wibsite'),
    password=os.environ.get('DB_PASSWORD', 'wibsite_pass'),
    dbname='dify'
)
cur = conn.cursor()
# Check providers table
cur.execute("SELECT * FROM providers")
rows = cur.fetchall()
cols = [desc[0] for desc in cur.description]
print("providers table:", cols)
for r in rows:
    print(r)

# Check provider_credentials
cur.execute("SELECT * FROM provider_credentials")
rows = cur.fetchall()
cols = [desc[0] for desc in cur.description]
print("\nprovider_credentials:", cols)
for r in rows:
    print(r)

# Check tenant_preferred_model_providers
cur.execute("SELECT * FROM tenant_preferred_model_providers")
rows = cur.fetchall()
cols = [desc[0] for desc in cur.description]
print("\ntenant_preferred_model_providers:", cols)
for r in rows:
    print(r)

cur.close()
conn.close()
