import httpx, json

base = 'http://n8n:5678'

# Login
r = httpx.post(f'{base}/rest/login', json={'emailOrLdapLoginId': 'admin@wibsite.com', 'password': 'Admin@123'})
auth_cookie = r.cookies.get('n8n-auth')
headers = {'Cookie': f'n8n-auth={auth_cookie}', 'Content-Type': 'application/json'}

# Import workflow 1
with open('/opt/n8n-workflows/01-inbound-message.json') as f:
    wf1 = json.load(f)

r1 = httpx.post(f'{base}/rest/workflows', json={'name': wf1['name'], 'nodes': wf1['nodes'], 'connections': wf1['connections'], 'settings': wf1.get('settings', {}), 'tags': wf1.get('tags', []), 'pinData': wf1.get('pinData', {})}, headers=headers)
print(f'Import WF1: {r1.status_code}')
print(r1.text[:300])

# Import workflow 2
with open('/opt/n8n-workflows/02-campaign-broadcast.json') as f:
    wf2 = json.load(f)

r2 = httpx.post(f'{base}/rest/workflows', json={'name': wf2['name'], 'nodes': wf2['nodes'], 'connections': wf2['connections'], 'settings': wf2.get('settings', {}), 'tags': wf2.get('tags', []), 'pinData': wf2.get('pinData', {})}, headers=headers)
print(f'\nImport WF2: {r2.status_code}')
print(r2.text[:300])

# List workflows
r3 = httpx.get(f'{base}/rest/workflows', headers=headers)
print(f'\nList workflows: {r3.status_code}')
data = r3.json()
for wf in data.get('data', []):
    print(f'  - {wf["id"]}: {wf["name"]} (active: {wf.get("active", False)})')
