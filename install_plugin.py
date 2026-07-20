import httpx, json

base = 'http://localhost:5001'
cookies = {
    'access_token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZTBhMjU3ZmEtZTQzZi00MzU0LWE2OGUtMmNjNmE5YzZmMDdiIiwiZXhwIjoxNzgzNjUxNzYzLCJpc3MiOiJTRUxGX0hPU1RFRCIsInN1YiI6IkNvbnNvbGUgQVBJIFBhc3Nwb3J0In0.G-lD5dMykHciH2tO5rMJ4t-EGUl8ob9DwPempjAkEVU',
    'csrf_token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODM2NTE3NjMsInN1YiI6ImUwYTI1N2ZhLWU0M2YtNDM1NC1hNjhlLTJjYzZhOWM2ZjA3YiJ9.8dG1PUVUIjcce5MFwBOlNuRs2U_Ut0bJUh_WmTATUAA',
}
csrf = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODM2NTE3NjMsInN1YiI6ImUwYTI1N2ZhLWU0M2YtNDM1NC1hNjhlLTJjYzZhOWM2ZjA3YiJ9.8dG1PUVUIjcce5MFwBOlNuRs2U_Ut0bJUh_WmTATUAA'
headers = {'X-CSRF-TOKEN': csrf, 'Content-Type': 'application/json'}

# Step 1: First try fetching marketplace pkg manifest
r = httpx.get(
    base + '/console/api/workspaces/current/plugin/marketplace/pkg',
    params={'plugin_unique_identifier': 'langgenius/openai_api_compatible:0.0.55@d64be9924f2edf13fd5329fc03fdfc0d0e0e36e0aef5321c4942f0845de8c030'},
    headers=headers,
    cookies=cookies
)
print('Fetch manifest:', r.status_code)
print('Body:', r.text[:500])

if r.status_code == 200:
    # Step 2: Install the plugin
    install_data = {
        'plugin_unique_identifiers': ['langgenius/openai_api_compatible:0.0.55@d64be9924f2edf13fd5329fc03fdfc0d0e0e36e0aef5321c4942f0845de8c030']
    }
    r2 = httpx.post(
        base + '/console/api/workspaces/current/plugin/install/marketplace',
        json=install_data,
        headers=headers,
        cookies=cookies
    )
    print('\nInstall:', r2.status_code)
    print('Body:', r2.text[:1000])
