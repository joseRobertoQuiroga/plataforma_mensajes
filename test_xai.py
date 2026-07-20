import httpx, json

# Test xAI models endpoint
api_key = 'xai-YOUR_XAI_API_KEY_HERE'

r = httpx.get('https://api.x.ai/v1/models', headers={'Authorization': f'Bearer {api_key}'})
print('Models endpoint:', r.status_code)
print(r.text[:500])

# Test chat
payload = {"model": "grok-2", "messages": [{"role": "user", "content": "hi"}]}
r2 = httpx.post('https://api.x.ai/v1/chat/completions', json=payload, headers={'Authorization': f'Bearer {api_key}'})
print('\nChat endpoint:', r2.status_code)
print(r2.text[:500])
