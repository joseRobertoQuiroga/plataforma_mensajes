'use strict';
/**
 * quoteEngine.js — matching de servicios, cuestionarios por servicio,
 * estimación por factores y generación de mini-cotizaciones (C1-C4).
 */

function matchProduct(state, template) {
  const products = template.products || [];
  const interest = String(state.interest || '').toLowerCase();
  const serviceType = String(state.service_type || '').toLowerCase();
  if (!interest && !serviceType) return null;
  const needle = (interest || serviceType).trim();
  if (!needle) return null;

  const direct = products.find(p => {
    const name = p.name.toLowerCase();
    return name === needle || needle.includes(name) || name.includes(needle);
  });
  if (direct) return direct;

  const terms = needle.split(/\s+/).filter(t => t.length > 3);
  const partial = products.find(p => {
    const haystack = `${p.name} ${p.description || ''}`.toLowerCase();
    return terms.some(t => haystack.includes(t));
  });
  return partial || null;
}

function pendingQuestion(product, answers = {}) {
  return (product?.questionnaire || []).find(q => answers[q.field] === undefined) || null;
}

function answerQuestion(question, message) {
  const lower = String(message || '').toLowerCase();
  const options = question.options || {};
  for (const [key, opt] of Object.entries(options)) {
    if (lower.includes(key)) return key;
    const label = String(opt.label || '').toLowerCase();
    if (label.length > 3 && lower.includes(label)) return key;
  }
  return lower.trim().slice(0, 80) || 'no_especificado';
}

function estimateQuote(product, answers = {}) {
  let factor = 1;
  for (const q of (product?.questionnaire || [])) {
    const answer = answers[q.field];
    const opt = answer ? (q.options || {})[answer] : null;
    if (opt && typeof opt.f === 'number') factor *= opt.f;
  }
  factor = Math.min(factor, 2.5);
  const min = Math.round((product.min_price || 0) * factor);
  const max = Math.round((product.max_price || min * 2) * factor);
  return { factor, min, max };
}

function summarizeScope(product, answers = {}) {
  const parts = (product?.questionnaire || []).map(q => {
    const answer = answers[q.field];
    if (!answer) return null;
    const opt = (q.options || {})[answer];
    return `${String(q.field).replace(/_/g, ' ')}: ${opt?.label || answer}`;
  }).filter(Boolean);
  return parts.join(' · ') || 'Alcance general';
}

function buildQuote({ product, answers, template }) {
  const { factor, min, max } = estimateQuote(product, answers);
  return {
    service: product.name,
    scope: answers,
    scope_summary: summarizeScope(product, answers),
    range_usd: [min, max],
    factor: Number(factor.toFixed(2)),
    typical_time: product.typical_time || 'a definir',
    guarantee: (template.guarantee || '6 meses'),
    valid_days: 15,
    generated_at: new Date().toISOString(),
  };
}

function quoteToText(quote) {
  return [
    `Te comparto una estimación inicial para *${quote.service.toLowerCase()}*:`,
    '',
    `• Alcance: ${quote.scope_summary}`,
    `• Rango estimado: $${quote.range_usd[0]}–$${quote.range_usd[1]} USD (referencial)`,
    `• Tiempo típico: ${quote.typical_time}`,
    `• Garantía: ${quote.guarantee} · Validez de la estimación: ${quote.valid_days} días`,
    '',
    'Precios referenciales, sujetos a propuesta formal.',
  ].join('\n');
}

module.exports = {
  matchProduct, pendingQuestion, answerQuestion, estimateQuote,
  summarizeScope, buildQuote, quoteToText,
};
