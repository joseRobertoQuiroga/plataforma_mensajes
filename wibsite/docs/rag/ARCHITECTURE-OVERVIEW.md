# Architecture Overview (RAG-optimized)

## Stack Components
- Chatwoot: Inbox omnicanal (WhatsApp, Messenger, TikTok), puerto 3002
- Dify 1.15.x: Orquestación IA (workflows, agents, RAG), puerto 5001 (API) / 3003 (Web)
- n8n: Orquestador de flujos visual, puerto 5679
- Twenty CRM: Gestión de leads y contactos, puerto 3001
- Helper Node: Lógica de campañas y tracking, puerto 3100
- Plugin Daemon: Gestión de plugins de modelos (marketplace), puerto 5002
- PostgreSQL: Base de datos compartida (chatwoot, dify, n8n, twenty, dify_plugin)
- Redis: Cache/queue compartido
- Weaviate: Vector store para RAG en Dify
- Nginx: Reverse proxy unificado, puerto 8080

## Service URLs (internal Docker network)
- dify-api: http://dify-api:5001
- dify-web: http://dify-web:3000
- n8n: http://n8n:5678
- chatwoot: http://chatwoot:3000
- twenty-server: http://twenty-server:3000
- helper: http://helper:3100
- plugin-daemon: http://plugin-daemon:5002
- postgres: postgres:5432
- redis: redis:6379
- weaviate: http://weaviate:8080

## External URLs (via Nginx)
- Dify Web: http://localhost:8080
- Dify Console API: http://localhost:8080/console/api/
- Dify Public API: http://localhost:8080/api/
- Chatwoot: http://localhost:8080/chatwoot/
- n8n: http://localhost:8080/n8n/
- Twenty CRM: http://localhost:8080/crm/
- Helper API: http://localhost:8080/api/helper/

## Data Flow: Inbound Message
WhatsApp → Meta Cloud API → Chatwoot WhatsApp Inbox → Chatwoot Webhook → n8n Webhook Trigger → HTTP Request to Dify Workflow → Dify Classify Lead → HTTP Request back to n8n → n8n sends reply via Chatwoot API → n8n creates/updates lead in Twenty CRM → n8n logs to helper-node

## Data Flow: Campaign Broadcast
n8n Schedule Trigger → n8n gets pending campaigns from helper-node (GET /campaigns/pending) → n8n queries Twenty CRM for audience → n8n sends to Dify for personalized content → n8n sends via Meta WhatsApp API → Meta sends status webhook to helper-node → helper-node tracks delivery (POST /campaigns/track)

## Key Credentials
- Dify admin: joserobertoquirogasalvador@gmail.com / Admin@123
- n8n admin: admin@wibsite.com / Admin@123
- Chatwoot admin: admin@wibsite.com / Admin@123
- xAI API Key: xai-YOUR_XAI_API_KEY_HERE (sin créditos)
- Dify API Key: app-IohwPPX3HDWA46TQLEcGBZq0
- Chatwoot API Key: SpMUEqpey6UiCxKq7wnoECD6
- Plugin Daemon Key: lYkiYYT6owG+71oLerGzA7GXCgOT++6ovaezWAjpCjf+Sjc3ZtU+qUEi
- Dify Inner API Key: QaHbTe77CtuXmsfyhR7+vRjI/+XbV1AaFy691iy+kGDv2Jvy0/eAh8Y1
