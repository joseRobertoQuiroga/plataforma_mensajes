import json
with open('/tmp/manifest.json') as f:
    data = json.load(f)
plugins = data.get('plugins', [])
targets = ['openai', 'openai_api_compatible', 'x', 'groq', 'xai', 'anthropic']
for p in plugins:
    name = p.get('name', '')
    org = p.get('org', '')
    if org == 'langgenius' and name in targets:
        print(f"Plugin: {org}/{name}")
        print(f"  latest_version: {p.get('latest_version')}")
        print(f"  latest_package_identifier: {p.get('latest_package_identifier')}")
        url = p.get('latest_package_url', 'N/A')
        print(f"  latest_package_url: {url[:120] if len(url) > 120 else url}")
        print()
