import urllib.request, json, sys
sys.stdout.reconfigure(encoding='utf-8')

base = 'http://localhost:5679'
auth_cookie = None

body = json.dumps({'emailOrLdapLoginId': 'admin@wibsite.com', 'password': 'Admin@123'}).encode()
req = urllib.request.Request(f'{base}/rest/login', data=body, headers={'Content-Type': 'application/json'})
resp = urllib.request.urlopen(req)
set_cookie = resp.getheader('Set-Cookie')
auth_cookie = set_cookie.split(';')[0] if set_cookie else None

headers = {'Content-Type': 'application/json', 'Cookie': auth_cookie}

# First archive both, then delete
for wid in ['hfmpleUgLaOZUcQ6', 'ktheIzGfXPHbZ9Rg']:
    # Archive
    url = f'{base}/rest/workflows/{wid}'
    get_req = urllib.request.Request(url, headers=headers)
    try:
        get_resp = urllib.request.urlopen(get_req)
        wf_data = json.loads(get_resp.read().decode('utf-8'))
    except urllib.error.HTTPError:
        continue
    wf_ver = wf_data.get('data', {}).get('versionId', None)
    if not wf_ver:
        # Try different path
        get_req2 = urllib.request.Request(f'{base}/rest/workflows/{wid}?includeVersionId=true', headers=headers)
        try:
            get_resp2 = urllib.request.urlopen(get_req2)
            wf_data2 = json.loads(get_resp2.read().decode('utf-8'))
            wf_ver = wf_data2.get('data', {}).get('versionId', None) or wf_data2.get('versionId')
        except:
            pass
    
    # Try DELETE anyway
    import time
    for w in ['ktheIzGfXPHbZ9Rg', 'hfmpleUgLaOZUcQ6']:
        # Try PATCH to deactivate + archive first
        patch_req = urllib.request.Request(
            f'{base}/rest/workflows/{w}',
            data=json.dumps({'active': False}).encode(),
            headers=headers,
            method='PATCH'
        )
        try:
            urllib.request.urlopen(patch_req)
        except:
            pass
        time.sleep(0.5)
        
        del_req = urllib.request.Request(f'{base}/rest/workflows/{w}', headers=headers, method='DELETE')
        try:
            resp = urllib.request.urlopen(del_req)
            print(f'DELETE {w}: {resp.status}')
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8")[:200]
            print(f'DELETE {w}: {e.code} - {body}')

# List remaining
req = urllib.request.Request(f'{base}/rest/workflows', headers=headers)
resp = urllib.request.urlopen(req)
data = json.loads(resp.read().decode('utf-8'))
print(f'\nRemaining ({len(data.get("data", []))}):')
for wf in data.get('data', []):
    print(f'  [{wf["id"]}] {wf["name"]}')
