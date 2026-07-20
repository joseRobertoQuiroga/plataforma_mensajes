import httpx, json

base = 'http://localhost:5001'
cookies = {
    'access_token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZTBhMjU3ZmEtZTQzZi00MzU0LWE2OGUtMmNjNmE5YzZmMDdiIiwiZXhwIjoxNzgzNjUxNzYzLCJpc3MiOiJTRUxGX0hPU1RFRCIsInN1YiI6IkNvbnNvbGUgQVBJIFBhc3Nwb3J0In0.G-lD5dMykHciH2tO5rMJ4t-EGUl8ob9DwPempjAkEVU',
    'csrf_token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODM2NTE3NjMsInN1YiI6ImUwYTI1N2ZhLWU0M2YtNDM1NC1hNjhlLTJjYzZhOWM2ZjA3YiJ9.8dG1PUVUIjcce5MFwBOlNuRs2U_Ut0bJUh_WmTATUAA',
}
headers = {'X-CSRF-TOKEN': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODM2NTE3NjMsInN1YiI6ImUwYTI1N2ZhLWU0M2YtNDM1NC1hNjhlLTJjYzZhOWM2ZjA3YiJ9.8dG1PUVUIjcce5MFwBOlNuRs2U_Ut0bJUh_WmTATUAA'}

# Get full provider details
r = httpx.get(base + '/console/api/workspaces/current/model-providers', headers=headers, cookies=cookies)
data = r.json()
for prov in data.get('data', []):
    if 'openai_api_compatible' in prov.get('provider', ''):
        print(json.dumps(prov, indent=2))
        break
