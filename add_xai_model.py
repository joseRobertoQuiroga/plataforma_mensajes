import httpx, json

base = 'http://localhost:5001'
cookies = {
    'access_token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZTBhMjU3ZmEtZTQzZi00MzU0LWE2OGUtMmNjNmE5YzZmMDdiIiwiZXhwIjoxNzgzNjUxNzYzLCJpc3MiOiJTRUxGX0hPU1RFRCIsInN1YiI6IkNvbnNvbGUgQVBJIFBhc3Nwb3J0In0.G-lD5dMykHciH2tO5rMJ4t-EGUl8ob9DwPempjAkEVU',
    'csrf_token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODM2NTE3NjMsInN1YiI6ImUwYTI1N2ZhLWU0M2YtNDM1NC1hNjhlLTJjYzZhOWM2ZjA3YiJ9.8dG1PUVUIjcce5MFwBOlNuRs2U_Ut0bJUh_WmTATUAA',
}
headers = {'X-CSRF-TOKEN': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODM2NTE3NjMsInN1YiI6ImUwYTI1N2ZhLWU0M2YtNDM1NC1hNjhlLTJjYzZhOWM2ZjA3YiJ9.8dG1PUVUIjcce5MFwBOlNuRs2U_Ut0bJUh_WmTATUAA'}

provider = 'langgenius/openai_api_compatible/openai_api_compatible'
api_key = 'xai-YOUR_XAI_API_KEY_HERE'

for model_name in ['grok-beta', 'grok-2-1212', 'grok-2-latest', 'grok-2']:
    payload = {
        "model": model_name,
        "model_type": "llm",
        "credentials": {
            "endpoint_url": "https://api.x.ai/v1",
            "api_key": api_key,
            "mode": "chat",
            "context_size": "131072",
            "max_tokens_to_sample": "4096",
            "vision_support": "support",
            "function_calling_type": "tool_call",
            "compatibility_mode": "strict",
            "stream_function_calling": "supported",
        }
    }
    r = httpx.post(
        base + f'/console/api/workspaces/current/model-providers/{provider}/models/credentials/validate',
        json=payload,
        headers=headers,
        cookies=cookies
    )
    result = r.json()
    # Also check if xai API says not found vs other errors
    print(f'{model_name}: status={r.status_code}, result={result.get("result")}, error={str(result.get("error",""))[:100]}')
    if result.get('result') == 'success':
        print(f'  *** SUCCESS with {model_name}! ***')
        # Create it
        r2 = httpx.post(
            base + f'/console/api/workspaces/current/model-providers/{provider}/models/credentials',
            json=payload,
            headers=headers,
            cookies=cookies
        )
        print(f'  Create: status={r2.status_code}, body={r2.text[:200]}')
        break
