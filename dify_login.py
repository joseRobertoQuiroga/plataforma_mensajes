import httpx

# Try login with the actual admin email
url = 'http://localhost:5001/console/api/login'

# Try common passwords with the actual email
passwords = [
    'QWRtaW4xMjM=',      # Admin123
    'YWRtaW4xMjM=',      # admin123
    'QWRtaW5AMTIz',      # Admin@123
]

for pwd in passwords:
    payload = {'email': 'joserobertoquirogasalvador@gmail.com', 'password': pwd, 'language': 'en-US'}
    r = httpx.post(url, json=payload, follow_redirects=True)
    print(f'Password {pwd[:10]}...: status={r.status_code}, body={r.text[:100]}')
    if r.status_code == 200:
        print('SUCCESS!')
        print('Cookies:', dict(r.cookies))
        break
