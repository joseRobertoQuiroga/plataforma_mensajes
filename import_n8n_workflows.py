import urllib.request, json, os

base = 'http://localhost:5679'
auth_cookie = None

def login():
    global auth_cookie
    body = json.dumps({'emailOrLdapLoginId': 'admin@wibsite.com', 'password': 'Admin@123'}).encode()
    req = urllib.request.Request(f'{base}/rest/login', data=body, headers={'Content-Type': 'application/json'})
    resp = urllib.request.urlopen(req)
    set_cookie = resp.getheader('Set-Cookie')
    print(f'Login: {resp.status}')
    print(f'Set-Cookie: {set_cookie}')
    if set_cookie:
        auth_cookie = set_cookie.split(';')[0]
        print(f'Auth cookie: {auth_cookie}')
        return True
    print('ERROR: No Set-Cookie header received')
    return False

def make_request(method, path, data=None):
    headers = {'Content-Type': 'application/json'}
    if auth_cookie:
        headers['Cookie'] = auth_cookie
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(f'{base}{path}', data=body, headers=headers, method=method)
    return urllib.request.urlopen(req)

def import_workflow(filepath):
    with open(filepath, encoding='utf-8') as f:
        wf = json.load(f)
    payload = {
        'name': wf['name'],
        'nodes': wf['nodes'],
        'connections': wf['connections'],
        'settings': wf.get('settings', {}),
        'tags': wf.get('tags', []),
        'pinData': wf.get('pinData', {}),
        'active': False
    }
    resp = make_request('POST', '/rest/workflows', payload)
    data = json.loads(resp.read())
    wf_id = data.get('data', {}).get('id', 'unknown')
    wf_name = data.get('data', {}).get('name', 'unknown')
    print(f'Imported: {resp.status} - {wf_name} (ID: {wf_id})')
    return wf_id

def list_workflows():
    resp = make_request('GET', '/rest/workflows')
    data = json.loads(resp.read())
    print(f'\nAll workflows ({len(data.get("data", []))}):')
    for wf in data.get('data', []):
        print(f'  [{wf["id"]}] {wf["name"]} (active: {wf.get("active", False)})')

if not login():
    exit(1)

base_dir = 'wibsite/n8n/workflows'
for fname in sorted(os.listdir(base_dir)):
    if fname.endswith('.json'):
        print(f'\nImporting {fname}...')
        import_workflow(os.path.join(base_dir, fname))

list_workflows()
