import urllib.request, json

def test(method, path, data=None):
    headers = {'Content-Type': 'application/json'}
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(f'http://localhost:3100{path}', data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:500]

# Test health
s, d = test('GET', '/health')
print(f'Health: {s}')
print(f'  DB: {d.get("db")}')

# Test create campaign
s, d = test('POST', '/api/campaigns', {
    'name': 'WhatsApp Campaign Test',
    'channel': 'whatsapp',
    'message_template': 'Hola {{name}}, tenemos una oferta especial para ti',
    'audience_filter': {'segment': 'all'}
})
print(f'\nCreate campaign: {s}')
if s == 201:
    print(f'  ID: {d["id"]}')
    print(f'  Status: {d["status"]}')
    campaign_id = d['id']
    
    # Test add lead
    s2, d2 = test('POST', f'/api/campaigns/{campaign_id}/leads', [{
        'name': 'Juan Pérez',
        'phone': '521234567890',
        'email': 'juan@test.com'
    }])
    print(f'\nAdd lead: {s2}')
    if s2 == 201:
        print(f'  Lead ID: {d2[0]["id"]}')
    
    # Test list campaigns
    s3, d3 = test('GET', '/api/campaigns')
    print(f'\nList campaigns: {s3}')
    print(f'  Total: {d3["total"]}')
    
    # Test channels
    s4, d4 = test('GET', '/api/channels')
    print(f'\nChannels: {s4}')
    print(f'  Count: {len(d4)}')
    for ch in d4:
        print(f'  - {ch["channel"]}: {ch["status"]}')
    
    # Test dashboard
    s5, d5 = test('GET', '/api/dashboard/summary')
    print(f'\nDashboard: {s5}')
    print(f'  Campaigns: {d5.get("campaigns")}')
else:
    print(f'  Error: {d}')
