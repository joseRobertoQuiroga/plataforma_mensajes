import urllib.request, json, os, sys

base = 'http://localhost:5679'
auth_cookie = None

# Login
body = json.dumps({'emailOrLdapLoginId': 'admin@wibsite.com', 'password': 'Admin@123'}).encode()
req = urllib.request.Request(f'{base}/rest/login', data=body, headers={'Content-Type': 'application/json'})
resp = urllib.request.urlopen(req)
set_cookie = resp.getheader('Set-Cookie')
if set_cookie:
    auth_cookie = set_cookie.split(';')[0]

# Try import with error details
filepath = 'wibsite/n8n/workflows/01-inbound-message.json'
with open(filepath, encoding='utf-8') as f:
    wf = json.load(f)

# Try the exact format n8n expects
payload = wf.copy()
payload.pop('active', None)

body2 = json.dumps(payload).encode('utf-8')
req2 = urllib.request.Request(
    f'{base}/rest/workflows',
    data=body2,
    headers={
        'Content-Type': 'application/json',
        'Cookie': auth_cookie
    },
    method='POST'
)

try:
    resp2 = urllib.request.urlopen(req2)
    print(f'Success: {resp2.status}')
    print(resp2.read().decode('utf-8')[:1000])
except urllib.error.HTTPError as e:
    print(f'Error: {e.code}')
    print(f'Response body: {e.read().decode("utf-8")}')
except Exception as e:
    print(f'Unexpected error: {e}')
