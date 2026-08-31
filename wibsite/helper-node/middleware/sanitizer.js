const INJECTION_PATTERNS = [
  /ignore\s+all\s+previous\s+instructions/i,
  /ignore\s+all\s+(prior|above|the\s+above)\s+(instructions|prompts|commands)/i,
  /forget\s+(everything|all|all\s+previous)/i,
  /you\s+are\s+(now|from\s+now\s+on)\s+/i,
  /act\s+as\s+/i,
  /do\s+not\s+(follow|obey|listen)/i,
  /system\s+prompt/i,
  /new\s+instructions/i,
  /override\s+(instructions|prompts|commands)/i,
  /reveal\s+(your|the)\s+(prompt|instructions|system)/i,
  /output\s+(your\s+)?(system\s+)?(prompt|instructions)/i,
  /show\s+your\s+(system\s+)?prompt/i,
  /print\s+your\s+(system\s+)?prompt/i,
  /tell\s+me\s+(the\s+)?(admin|administrator|root)\s+(password|pass|credentials)/i,
  /give\s+me\s+(the\s+)?(admin|administrator)\s+(access|role|privileges)/i,
  /you\s+have\s+been\s+(hacked|compromised|pwned)/i,
  /this\s+is\s+an\s+order/i,
  /I\s+am\s+(the\s+)?(owner|creator|admin|developer)/i,
  /<script\b/i,
  /javascript:/i,
  /on\w+\s*=\s*['"]/i,
];

const WHITELIST_ONLY = /^[a-zA-Z0-9\s.,!?;:áéíóúüñÁÉÍÓÚÜÑ¿¡()\-@#$%&*+=\[\]{}"'/:]+$/;

function sanitizeInput(text) {
  if (text === null || text === undefined || typeof text !== 'string') return { clean: '[Mensaje bloqueado por seguridad]', blocked: true, alerts: [] };
  if (text === '') return { clean: '', blocked: false, alerts: [] };
  const alerts = [];
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      alerts.push({ pattern: pattern.source, match: text.match(pattern)?.[0] || '' });
    }
  }
  if (alerts.length > 0) {
    return { clean: '[Mensaje bloqueado por seguridad]', blocked: true, alerts };
  }
  return { clean: text, blocked: false, alerts: [] };
}

function sanitizeMessages(messages) {
  if (!messages || !Array.isArray(messages)) return messages;
  const alerts = [];
  const sanitized = messages.map(msg => {
    if (msg.role === 'system') return msg;
    const result = sanitizeInput(msg.content);
    if (result.blocked) alerts.push(...result.alerts);
    return { ...msg, content: result.clean };
  });
  return { messages: sanitized, blocked: alerts.length > 0, alerts };
}

function sanitizerMiddleware(req, res, next) {
  const llmPaths = ['/api/llm/chat', '/api/scoring/evaluate-llm'];
  if (!llmPaths.includes(req.path)) return next();

  if (req.body?.messages) {
    const result = sanitizeMessages(req.body.messages);
    req.body.messages = result.messages;
    if (result.blocked) {
      console.warn('SECURITY: Prompt injection blocked', {
        path: req.path, alerts: result.alerts, ip: req.ip,
        timestamp: new Date().toISOString(),
      });
    }
  }
  next();
}



function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return phone;
  // Remove spaces, dashes, parentheses
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // If it starts with 00, replace with +
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }
  
  // Remove any character that is not a digit or a leading +
  cleaned = cleaned.replace(/(?!^\+)[^\d]/g, '');

  return cleaned;
}

function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return email;
  return email.trim().toLowerCase();
}

function normalizationMiddleware(req, res, next) {
  // Apply normalization for leads creation/update and bulk import endpoints
  if (req.path.startsWith('/api/leads') && (req.method === 'POST' || req.method === 'PATCH')) {
    if (req.body) {
      if (req.body.phone) {
        req.body.phone = normalizePhone(req.body.phone);
      }
      if (req.body.email) {
        req.body.email = normalizeEmail(req.body.email);
      }
    }
  }
  next();
}

module.exports = { 
  sanitizerMiddleware, 
  sanitizeInput, 
  sanitizeMessages, 
  INJECTION_PATTERNS,
  normalizePhone,
  normalizeEmail,
  normalizationMiddleware
};
