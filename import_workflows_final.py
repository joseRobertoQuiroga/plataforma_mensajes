import urllib.request, json, os

base = 'http://localhost:5679'
auth_cookie = None

def login():
    global auth_cookie
    body = json.dumps({'emailOrLdapLoginId': 'admin@wibsite.com', 'password': 'Admin@123'}).encode()
    req = urllib.request.Request(f'{base}/rest/login', data=body, headers={'Content-Type': 'application/json'})
    resp = urllib.request.urlopen(req)
    set_cookie = resp.getheader('Set-Cookie')
    if set_cookie:
        auth_cookie = set_cookie.split(';')[0]
        print(f'Login OK. Cookie: {auth_cookie[:40]}...')
        return True
    print('Login FAILED - no cookie')
    return False

def make_request(method, path, data=None):
    headers = {'Content-Type': 'application/json', 'Cookie': auth_cookie}
    body = json.dumps(data, ensure_ascii=False).encode('utf-8') if data else None
    req = urllib.request.Request(f'{base}{path}', data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

def import_workflow(filepath):
    with open(filepath, encoding='utf-8') as f:
        wf = json.load(f)
    payload = {k: v for k, v in wf.items() if k != 'active'}
    status, data = make_request('POST', '/rest/workflows', payload)
    wf_id = data.get('data', {}).get('id', '?') if isinstance(data, dict) and 'data' in data else data.get('id', '?')
    wf_name = data.get('data', {}).get('name', '?') if isinstance(data, dict) and 'data' in data else '?'
    print(f'  [{status}] {wf_name} (ID: {wf_id})')
    if status >= 400:
        print(f'  ERROR: {json.dumps(data, ensure_ascii=False)[:300]}')
    return status == 200

if not login():
    exit(1)

base_dir = 'wibsite/n8n/workflows'
for fname in sorted(os.listdir(base_dir)):
    if fname.endswith('.json'):
        print(f'\nImporting {fname}...')
        import_workflow(os.path.join(base_dir, fname))

print('\n--- Current workflows ---')
status, data = make_request('GET', '/rest/workflows')
if status == 200:
    for wf in data.get('data', []):
        print(f'  [{wf["id"]}] {wf["name"]} (active: {wf.get("active", False)})')
else:
    print(f'Error listing: {data}')
