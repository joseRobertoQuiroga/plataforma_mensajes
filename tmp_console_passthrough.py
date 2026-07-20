import sys
sys.path.insert(0, '/app/api')
import os
os.environ['DB_USERNAME'] = 'wibsite'
os.environ['DB_PASSWORD'] = 'wibsite_pass'

from core.plugin.impl.plugin import PluginInstaller
import inspect
print(inspect.getsource(PluginInstaller))
