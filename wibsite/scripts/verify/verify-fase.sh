#!/bin/bash
# Wibsite - Phase Verification Script
# Usage: ./verify-fase.sh [wave]
#   wave: A, B, C, D, E, F, G, H, I, J, all

WAVE=${1:-all}
PASS=0
FAIL=0

check() {
  local desc="$1"
  shift
  if "$@" > /dev/null 2>&1; then
    echo "  ✅ $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $desc"
    FAIL=$((FAIL + 1))
  fi
}

check_health() {
  local url="$1"
  local desc="$2"
  curl -sf "$url" > /dev/null 2>&1
}

echo "=== Wibsite Verification - Wave $WAVE ==="
echo ""

case "$WAVE" in
  all|A)
    echo "--- Wave A: Access & Real Channel ---"
    check "Helper health" check_health "http://localhost:3100/health"
    check "Hub accessible" check_health "http://localhost:8080/hub/"
    check "n8n accessible" check_health "http://localhost:8080/n8n/"
    check "Chatwoot accessible" check_health "http://localhost:8080/chatwoot/"
    check "Twenty CRM accessible" check_health "http://localhost:8080/crm/"
    echo ""
    ;;&
  all|B)
    echo "--- Wave B: Multi-tenant DB ---"
    check "Helper API health" check_health "http://localhost:3100/api/health"
    check "Seed data endpoint" curl -sf -X POST "http://localhost:3100/api/seed" > /dev/null
    echo ""
    ;;&
  all|C)
    echo "--- Wave C: Agent Engine ---"
    check "Agent test graph" curl -sf -X POST "http://localhost:3100/api/agent/test-graph" -H "Content-Type: application/json" -d '{"message":"test"}' > /dev/null
    check "Template validation" curl -sf "http://localhost:3100/api/agent/templates/validate" > /dev/null
    echo ""
    ;;&
  all|D)
    echo "--- Wave D: Commercial Behavior ---"
    check "Templates list" curl -sf "http://localhost:3100/api/agent/templates" > /dev/null
    echo ""
    ;;&
  all|E)
    echo "--- Wave E: CRM & ERP ---"
    check "Twenty sync health" curl -sf "http://localhost:3100/api/twenty/health" > /dev/null
    echo ""
    ;;&
  all|F)
    echo "--- Wave F: Security ---"
    check "Metrics endpoint" curl -sf "http://localhost:3100/metrics" > /dev/null
    echo ""
    ;;&
  all|G)
    echo "--- Wave G: Observability ---"
    echo ""
    ;;&
  all|H)
    echo "--- Wave H: Portal ---"
    check "Portal accessible" check_health "http://localhost:8080/portal/"
    echo ""
    ;;&
  all|I)
    echo "--- Wave I: Validation ---"
    echo ""
    ;;&
  all|J)
    echo "--- Wave J: SaaS & Deploy ---"
    echo ""
    ;;
esac

echo "==============================="
echo "Results: $PASS passed, $FAIL failed"
exit $FAIL
