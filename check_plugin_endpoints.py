import httpx, json

base = 'http://localhost:5001'
cookies = {
    'access_token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZTBhMjU3ZmEtZTQzZi00MzU0LWE2OGUtMmNjNmE5YzZmMDdiIiwiZXhwIjoxNzgzNjUxNzYzLCJpc3MiOiJTRUxGX0hPU1RFRCIsInN1YiI6IkNvbnNvbGUgQVBJIFBhc3Nwb3J0In0.G-lD5dMykHciH2tO5rMJ4t-EGUl8ob9DwPempjAkEVU',
    'csrf_token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODM2NTE3NjMsInN1YiI6ImUwYTI1N2ZhLWU0M2YtNDM1NC1hNjhlLTJjYzZhOWM2ZjA3YiJ9.8dG1PUVUIjcce5MFwBOlNuRs2U_Ut0bJUh_WmTATUAA',
}
csrf = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODM2NTE3NjMsInN1YiI6ImUwYTI1N2ZhLWU0M2YtNDM1NC1hNjhlLTJjYzZhOWM2ZjA3YiJ9.8dG1PUVUIjcce5MFwBOlNuRs2U_Ut0bJUh_WmTATUAA'
headers = {'X-CSRF-TOKEN': csrf, 'Content-Type': 'application/json'}

# Check plugin-related console endpoints
endpoints = [
    '/console/api/workspaces/current/plugin',
    '/console/api/workspaces/current/model-providers',
    '/console/api/workspaces/current/tool-providers',
    '/console/api/plugin',
    '/console/api/plugins',
]
for ep in endpoints:
    r = httpx.get(base + ep, headers=headers, cookies=cookies)
    print(f'GET {ep}: {r.status_code} {r.text[:200]}')
