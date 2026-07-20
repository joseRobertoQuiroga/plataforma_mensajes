import httpx, json

# Test n8n login from dify-api container
base = 'http://n8n:5678'

# Try login
payload = {'emailOrLdapLoginId': 'admin@wibsite.com', 'password': 'Admin@123'}
r = httpx.post(f'{base}/rest/login', json=payload, follow_redirects=True)
print(f'Login /rest/login: {r.status_code}')
print(f'Body: {r.text[:300]}')
print(f'Headers: {dict(r.headers)}')
print()

# Try different endpoints
for ep in ['/rest/owner', '/healthz', '/rest/me']:
    r2 = httpx.get(f'{base}{ep}')
    print(f'GET {ep}: {r2.status_code} {r2.text[:100]}')
