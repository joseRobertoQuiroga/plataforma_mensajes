#!/bin/sh
# Create OTEL Collector API key with proper permissions
curl -s -X POST \
  -u elastic:wibsite_elastic_pass_2026 \
  http://localhost:9200/_security/api_key \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "otel-collector-key",
    "role_descriptors": {
      "otel-writer": {
        "cluster": ["monitor", "manage_index_templates", "manage_ilm", "manage_ingest_pipelines"],
        "index": [
          {
            "names": ["traces-*", "logs-*", "metrics-*", ".kibana*"],
            "privileges": ["auto_configure", "create_doc", "write", "create_index", "manage"]
          }
        ]
      }
    }
  }'
