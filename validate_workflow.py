import json

with open('wibsite/n8n/workflows/01-inbound-message.json', encoding='utf-8') as f:
    wf = json.load(f)

# Get all node names
node_names = {n['name'] for n in wf['nodes']}
print(f'Nodes ({len(wf["nodes"])}):')
for n in wf['nodes']:
    print(f'  - {n["name"]} (type: {n.get("type", "?")})')

# Validate connections
print(f'\nConnections:')
for source_node, conns in wf.get('connections', {}).items():
    if source_node not in node_names:
        print(f'  SOURCE NODE NOT FOUND: {source_node}')
        continue
    for output_idx, conn_list in enumerate(conns):
        for conn in conn_list:
            target = conn.get('node', '?')
            if target not in node_names:
                print(f'  TARGET NODE NOT FOUND: {target} (from {source_node})')

print('\nValidation complete.')
