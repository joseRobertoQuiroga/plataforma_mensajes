import json

with open('wibsite/n8n/workflows/01-inbound-message.json', encoding='utf-8') as f:
    wf = json.load(f)

node_names = {n['name'] for n in wf['nodes']}

# Print raw connection structure
print('RAW CONNECTIONS:')
for src, connections in wf.get('connections', {}).items():
    print(f'\n{src}:')
    print(json.dumps(connections, indent=2)[:500])
