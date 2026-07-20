import psycopg2
conn = psycopg2.connect('host=postgres dbname=n8n user=wibsite password=wibsite_pass')
cur = conn.cursor()

cur.execute('SELECT id, email, "roleSlug" FROM "user" ORDER BY "createdAt"')
users = cur.fetchall()
print('Users:', users)

cur.execute('SELECT id, "userId", "providerType", "providerId" FROM "auth_identity"')
auths = cur.fetchall()
print('Auth:', auths)

cur.close()
conn.close()
