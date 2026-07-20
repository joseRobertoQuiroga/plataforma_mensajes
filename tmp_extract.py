import json, urllib.request, sys

req = urllib.request.Request(
    'https://marketplace.dify.ai/api/v1/dist/plugins/manifest.json',
    headers={'X-Dify-Version': '1.15.0'}
)
resp = urllib.request.urlopen(req)
data = json.loads(resp.read())
plugins = data.get('plugins', [])
targets = ['openai', 'openai_api_compatible', 'x', 'groq', 'xai', 'anthropic']
for p in plugins:
    name = p.get('name', '')
    org = p.get('org', '')
    if org == 'langgenius' and name in targets:
        print(f"Plugin: {org}/{name}")
        print(f"  latest_version: {p.get('latest_version')}")
        print(f"  latest_package_identifier: {p.get('latest_package_identifier')}")
        url = p.get('latest_package_url', '')
        if url:
            print(f"  latest_package_url: {url[:120]}")
        print()
