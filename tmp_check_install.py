import sys, os, json
sys.path.insert(0, '/app/api')

# Check PluginService.install_from_marketplace_pkg
from core.plugin.plugin_service import PluginService
import inspect
src = inspect.getsource(PluginService.install_from_marketplace_pkg)
print(src)
