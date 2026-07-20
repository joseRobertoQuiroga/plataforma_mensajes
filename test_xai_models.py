import httpx, json

base = 'http://localhost:5001'
cookies = {
    'access_token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZTBhMjU3ZmEtZTQzZi00MzU0LWE2OGUtMmNjNmE5YzZmMDdiIiwiZXhwIjoxNzgzNjUxNzYzLCJpc3MiOiJTRUxGX0hPU1RFRCIsInN1YiI6IkNvbnNvbGUgQVBJIFBhc3Nwb3J0In0.G-lD5dMykHciH2tO5rMJ4t-EGUl8ob9DwPempjAkEVU',
    'csrf_token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODM2NTE3NjMsInN1YiI6ImUwYTI1N2ZhLWU0M2YtNDM1NC1hNjhlLTJjYzZhOWM2ZjA3YiJ9.8dG1PUVUIjcce5MFwBOlNuRs2U_Ut0bJUh_WmTATUAA',
}
headers = {'X-CSRF-TOKEN': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODM2NTE3NjMsInN1YiI6ImUwYTI1N2ZhLWU0M2YtNDM1NC1hNjhlLTJjYzZhOWM2ZjA3YiJ9.8dG1PUVUIjcce5MFwBOlNuRs2U_Ut0bJUh_WmTATUAA'}

provider = 'langgenius/openai_api_compatible/openai_api_compatible'
api_key = 'xai-YOUR_XAI_API_KEY_HERE'

# Test different model names against xAI API
test_models = [
    'grok-4.5', 'grok-4-1-fast-non-reasoning', 'grok-4-1-fast-reasoning', 
    'grok-3', 'grok-3-mini', 'grok-beta', 'grok-2', 'grok-2-2024-08-13',
    'grok-2-vision'
]

for model_name in test_models:
    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": "hi"}]
    }
    r = httpx.post(
        'https://api.x.ai/v1/chat/completions', 
        json=payload, 
        headers={'Authorization': f'Bearer {api_key}'},
        timeout=10
    )
    err = r.json().get('error', '')
    print(f'{model_name}: {r.status_code} - {err[:80]}')
    if r.status_code == 200:
        print('  *** WORKS! ***')
        break
