'use strict';
const { logEvent } = require('../../auditLogger');

const ZONES = {
  GREEN: 'green',
  YELLOW: 'yellow',
  RED: 'red',
};

const YELLOW_DISCLAIMER = ' (Precios referenciales, sujetos a propuesta formal)';

function wantsPricing(message = '') {
  const lower = message.toLowerCase();
  return /cotizacion|cotiza|precio|cuanto cuesta|costo|cuanto sale|presupuesto|factura|cuanto me saldria|cuanto saldria|cuanto costaria/.test(lower);
}

function wantsCommitment(message = '') {
  const lower = message.toLowerCase();
  return /quiero cerrar|contratar ya|compromet|firmar|acepto la propuesta/.test(lower);
}

function evaluate(state = {}, template = {}) {
  const zones = template.autonomy_zones || {};
  const yellow = zones.yellow || {};
  const green = zones.green || {};
  const stateZone = state._autonomyZone;

  let zone = ZONES.GREEN;
  if (stateZone === ZONES.RED || state._needsHuman) zone = ZONES.RED;
  else if (wantsCommitment(state._lastMessage || '') && !yellow.can_commit) zone = ZONES.RED;
  else if (wantsPricing(state._lastMessage || '')) zone = yellow.can_share_pricing ? ZONES.YELLOW : ZONES.RED;
  else if (green.can_share_pricing) zone = ZONES.YELLOW;

  return { zone, canQuote: false, canSharePricing: zone === ZONES.YELLOW && !!yellow.can_share_pricing };
}

function addDisclaimer(text, zone) {
  if (zone === ZONES.YELLOW) return `${text}${YELLOW_DISCLAIMER}`;
  return text;
}

function assertZone({ zone, action, template, conversationId, tenantId }) {
  const config = template?.autonomy_zones?.[zone] || {};
  const actionKey = { quote: 'can_quote', commit: 'can_commit', share_pricing: 'can_share_pricing' }[action];
  const allowed = actionKey ? !!config[actionKey] : false;
  if (!allowed) {
    logEvent('security_alert', {
      level: 'security',
      message: `Accion '${action}' bloqueada por zona de autonomia '${zone}'`,
      tenantId,
      conversationId,
      module: 'agentCore',
      flow: 'guards.autonomy',
      action: `zone_${action}_blocked`,
      severity: 'medium',
      data: { zone, action, allowed: false },
    });
    return { allowed: false, zone, action, reason: `zona_${zone}` };
  }
  return { allowed: true, zone, action };
}

function deriveToHuman(state = {}, template = {}) {
  const { zone } = evaluate(state, template);
  return zone === ZONES.RED || !!state._needsHuman || !state._qualified;
}

module.exports = {
  ZONES, wantsPricing, wantsCommitment, evaluate, addDisclaimer, assertZone, deriveToHuman,
  YELLOW_DISCLAIMER,
};