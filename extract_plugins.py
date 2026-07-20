import json

with open('/tmp/manifest3.json') as f:
    data = json.load(f)

plugins = data.get('plugins', [])
targets = ['openai', 'openai_api_compatible', 'x', 'groq', 'xai', 'anthropic']

for p in plugins:
    name = p.get('name', '')
    org = p.get('org', '')
    if org == 'langgenius' and name in targets:
        print('Plugin: {}/{}'.format(org, name))
        print('  latest_version: {}'.format(p.get('latest_version')))
        print('  latest_package_identifier: {}'.format(p.get('latest_package_identifier')))
        url = p.get('latest_package_url', '')
        if url:
            print('  latest_package_url: {}'.format(url[:120]))
        print()
