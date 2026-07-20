const { Pool } = require('pg');
const pool = new Pool({ host: 'postgres', port: 5432, user: 'wibsite', password: 'wibsite_pass', database: 'n8n' });

async function fix() {
  const { rows: [ver] } = await pool.query('SELECT nodes FROM workflow_history WHERE "versionId" = $1', ['a87511a3-896d-4002-b452-966f20ff62a9']);
  const nodes = ver.nodes;
  const pr = nodes.find(n => n.id === 'parse-dify-response');
  
  var sourceCode = 
'const raw = $json.data.outputs.final_result || $json.data.outputs.llm || $json.data.outputs.response_text || "{}";\n' +
'const cleaned = String(raw).replace(/^```[\\w]*[\\n]?/, "").replace(/[\\n]?```$/, "").trim();\n' +
'let parsed; try { parsed = JSON.parse(cleaned); } catch(e) { parsed = {}; }\n' +
'var reply = (parsed.suggested_response || parsed.response_text || "").replace(/\\n|\\r/g, " ").substring(0, 1600);\n' +
'if (reply === "") { reply = "Gracias por contactarnos. Un agente te respondera pronto."; }\n' +
'var phone = parsed.captured_data && parsed.captured_data.phone || "";\n' +
'return {\n' +
'  response_text: reply,\n' +
'  intent_score: parsed.intent_score || 0,\n' +
'  intent_label: parsed.intent_label || "unknown",\n' +
'  needs_human: false,\n' +
'  should_auto_reply: true,\n' +
'  captured_data: { phone: phone, name: parsed.captured_data?.name || "" },\n' +
'  suggested_response: reply,\n' +
'  conversation_id: phone\n' +
'};';
  
  pr.parameters.jsCode = sourceCode;
  
  var sr = nodes.find(n => n.id === 'send-to-chatwoot');
  sr.parameters.bodyParameters.parameters.forEach(function(p) {
    if (p.name === 'to') p.value = '={{ $json.captured_data && $json.captured_data.phone || $json.conversation_id || "" }}';
    if (p.name === 'body') p.value = '={{ $json.suggested_response || $json.response_text || "" }}';
  });

  await pool.query('UPDATE workflow_history SET nodes = $1::json WHERE "versionId" = $2', [JSON.stringify(nodes), 'a87511a3-896d-4002-b452-966f20ff62a9']);
  await pool.query("UPDATE workflow_entity SET nodes = $1::json WHERE id = 'hfmpleUgLaOZUcQ6'", [JSON.stringify(nodes)]);
  console.log('OK');
  await pool.end();
}
fix().catch(function(e) { console.error(e.message); pool.end(); });
