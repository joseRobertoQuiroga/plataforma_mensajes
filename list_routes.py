import re
with open('/app/api/controllers/console/workspace/model_providers.py') as f:
    content = f.read()
classes = re.findall(r'@console_ns\.route\("(.+?)"\).*?\nclass (\w+)', content, re.DOTALL)
for route, cls in classes:
    print(f'{route} -> {cls}')
