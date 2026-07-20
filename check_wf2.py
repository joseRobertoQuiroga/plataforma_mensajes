import json

with open('wibsite/n8n/workflows/02-campaign-broadcast.json', encoding='utf-8') as f:
    wf = json.load(f)
node_names = {n['name'] for n in wf['nodes']}
print('Nodes:')
for n in wf['nodes']:
    print(f'  - {n["name"]}')
missing = []
for src, conns in wf.get('connections', {}).items():
    if src not in node_names:
        missing.append(f'SOURCE: {src}')
    for output_key, outputs in conns.items():
        for conn_list in outputs:
            for conn in conn_list:
                target = conn.get('node') if isinstance(conn, dict) else conn
                if target not in node_names:
                    missing.append(f'TARGET: {target} from {src}')
if missing:
    print(f'\nIssues ({len(missing)}):')
    for m in missing:
        print(f'  - {m}')
else:
    print('\nAll connections valid!')
