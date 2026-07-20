import urllib.request, json, sys
sys.stdout.reconfigure(encoding='utf-8')

base = 'http://localhost:5679'
auth_cookie = None

body = json.dumps({'emailOrLdapLoginId': 'admin@wibsite.com', 'password': 'Admin@123'}).encode()
req = urllib.request.Request(f'{base}/rest/login', data=body, headers={'Content-Type': 'application/json'})
resp = urllib.request.urlopen(req)
set_cookie = resp.getheader('Set-Cookie')
auth_cookie = set_cookie.split(';')[0] if set_cookie else None

def make_request(method, path, data=None):
    headers = {'Content-Type': 'application/json', 'Cookie': auth_cookie}
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(f'{base}{path}', data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

# List all workflows
status, data = make_request('GET', '/rest/workflows')
print(f'Workflows ({len(data.get("data", []))}):')
seen = {}
for wf in data.get('data', []):
    name = wf['name']
    wid = wf['id']
    if name in seen:
        print(f'  DUPLICATE [{wid}] {name} - DELETING...')
        s, _ = make_request('DELETE', f'/rest/workflows/{wid}')
        print(f'    Deleted: {s}')
    else:
        print(f'  [{wid}] {name}')
        seen[name] = wid
