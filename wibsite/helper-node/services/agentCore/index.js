'use strict';
const { Graph } = require('./graph');
const { createEntryNode } = require('./nodes/entryNode');
const { createAnalyzeNode } = require('./nodes/analyzeNode');
const { createCalificacionNode } = require('./nodes/calificacionNode');
const { createPropuestaNode } = require('./nodes/propuestaNode');
const { createProfundizacionNode } = require('./nodes/profundizacionNode');
const { createObjecionesNode, matchObjection } = require('./nodes/objecionesNode');
const { createCierreNode } = require('./nodes/cierreNode');
const { createHandoffNode } = require('./nodes/handoffNode');
const { createFollowupNode } = require('./nodes/followupNode');
const { createKbNode } = require('./nodes/kbNode');
const { createCotizacionNode } = require('./nodes/cotizacionNode');
const quoteEngine = require('./quoteEngine');
const conversationStore = require('../conversationStore');
const checkpointer = require('./checkpointer');
const commercialState = require('./commercialState');
const { fitComplete, missingFields } = require('./slotFilling');
const { conversationStateFor } = require('./stageMap');
const { sanitizeOutput } = require('./guards/confidentiality');
const autonomy = require('./guards/autonomy');
const { logEvent } = require('../auditLogger');
const { startSpan, endSpan } = require('../otelBridge');
const { projectCommercial } = commercialState;

const OBJECTION_READY_STAGES = ['propuesta', 'profundizacion', 'objeciones', 'cierre'];

let commercialHookRegistered = false;

function ensureCommercialHook() {
  if (commercialHookRegistered) return;
  commercialHookRegistered = true;
  commercialState.registerHook();
}

async function walkMachine(tenantId, conversationId, target) {
  const conv = await conversationStore.getConversationState(tenantId, conversationId);
  if (!conv) return null;
  if (conv.state === target) return conv;

  const { VALID_TRANSITIONS } = conversationStore;
  const queue = [[conv.state]];
  const visited = new Set([conv.state]);
  let path = null;
  while (queue.length && !path) {
    const candidate = queue.shift();
    const last = candidate[candidate.length - 1];
    if (last === target) { path = candidate; break; }
    for (const next of (VALID_TRANSITIONS[last] || [])) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...candidate, next]);
      }
    }
  }
  if (!path) {
    await logEvent('state_transition', {
      level: 'warn',
      message: `Sin ruta valida de maquina: ${conv.state} → ${target}`,
      tenantId,
      conversationId,
      module: 'agentCore',
      flow: 'grafo.comercial',
      action: 'machine.walk',
      data: { from: conv.state, to: target, reason: 'no_path' },
    });
    return conv;
  }
  let current = conv;
  for (const step of path.slice(1)) {
    current = await conversationStore.transitionState(tenantId, conversationId, step, 'grafo:walk');
  }
  return current;
}

function createCommercialGraph(template, clientConfig) {
  const graph = new Graph();
  graph.setTemplate(template || {});

  graph.addNode('apertura', createEntryNode());
  graph.addNode('analyze', createAnalyzeNode());
  graph.addNode('calificacion', createCalificacionNode());
  graph.addNode('propuesta', createPropuestaNode());
  graph.addNode('profundizacion', createProfundizacionNode());
  graph.addNode('objeciones', createObjecionesNode());
  graph.addNode('cierre', createCierreNode());
  graph.addNode('handoff', createHandoffNode());
  graph.addNode('seguimiento', createFollowupNode());
  graph.addNode('kb', createKbNode());
  graph.addNode('cotizacion', createCotizacionNode());

  graph.addEdge('apertura', 'analyze');

  graph.addEdge('analyze', 'kb', (result, ctx) => !!ctx.state._kbMatch);

  graph.addEdge('analyze', 'objeciones', (result, ctx) =>
    OBJECTION_READY_STAGES.includes(ctx.state._stage) && !!matchObjection(ctx.message, ctx.template));

  graph.addEdge('analyze', 'cierre', (result, ctx) => autonomy.wantsCommitment(ctx.message));

  graph.addEdge('analyze', 'propuesta', (result, ctx) => {
    if (!(ctx.state._stage === 'calificacion' && fitComplete(ctx.state))) return false;
    // El cuestionario por servicio se completa en el nodo calificacion:
    // no saltar directo a propuesta si quedan preguntas pendientes
    const product = quoteEngine.matchProduct(ctx.state, ctx.template);
    return !(product && quoteEngine.pendingQuestion(product, ctx.state.qAnswers || {}));
  });

  // Mini-cotización (C4): el lead pidió precios y la zona lo permite
  graph.addEdge('propuesta', 'cotizacion', (result, ctx) =>
    autonomy.wantsPricing(ctx.message)
    && ctx.state._autonomyZone === 'yellow'
    && !!ctx.state._matchedProduct);

  graph.addEdge('analyze', 'calificacion', (result, ctx) =>
    ['greeting', 'calificacion', 'apertura'].includes(ctx.state._stage));

  // Mini-cotización desde una propuesta ya enviada (máquina en proposal):
  // el lead pide precios y el cuestionario está completo (se evalúa ANTES que profundizacion)
  graph.addEdge('analyze', 'cotizacion', (result, ctx) => {
    if (!autonomy.wantsPricing(ctx.message)) return false;
    if (!['propuesta', 'proposal'].includes(ctx.state._stage)) return false;
    const product = quoteEngine.matchProduct(ctx.state, ctx.template);
    return !!(product && !quoteEngine.pendingQuestion(product, ctx.state.qAnswers || {}));
  });

  graph.addEdge('analyze', 'profundizacion', (result, ctx) =>
    ['propuesta'].includes(ctx.state._stage)
    || (ctx.state._stage === 'profundizacion' && missingFields(ctx.state, ctx.template).length > 0));

  graph.addEdge('analyze', 'cierre', (result, ctx) =>
    (ctx.state._stage === 'profundizacion' && missingFields(ctx.state, ctx.template).length === 0)
    || (ctx.state._stage === 'objeciones' && !matchObjection(ctx.message, ctx.template)));

  graph.addEdge('analyze', 'handoff', (result, ctx) =>
    ctx.state._stage === 'cierre');

  graph.addEdge('analyze', 'seguimiento', (result, ctx) =>
    ['handoff', 'seguimiento', 'escalated', 'post_sale'].includes(ctx.state._stage));

  graph.addEdge('analyze', 'calificacion', () => true);

  return graph;
}

function isObjectionTurn(state, message, template) {
  return OBJECTION_READY_STAGES.includes(state._stage) && !!matchObjection(message, template);
}

async function executeCommercialGraph(input) {
  ensureCommercialHook();
  const tenantId = input.tenantId || 'default';
  const conversationId = input.conversationId || 'default';
  const template = input.template || {};
  const clientConfig = input.clientConfig || {};
  const span = startSpan({
    name: 'agent.graph.run',
    kind: 1,
    attributes: {
      'wibsite.tenant_id': tenantId,
      'wibsite.conversation_id': conversationId,
      'wibsite.template': template.meta?.name || null,
    },
  });

  const restored = await checkpointer.restoreGraphState({ tenantId, conversationId });
  const startState = {
    ...restored.state,
    _stage: restored.machineStage,
  };

  const graph = createCommercialGraph(template, clientConfig);
  const { context, final, path } = await graph.execute({
    message: input.message || '',
    conversationId,
    tenantId,
    template,
    clientConfig,
    state: startState,
    machineStage: restored.machineStage,
    checkpoint: restored,
  });

  const stage = final.stage || 'apertura';
  const machineState = conversationStateFor(stage);
  let conversation = await conversationStore.getConversationState(tenantId, conversationId);
  if (!conversation) {
    conversation = await conversationStore.createConversationState(tenantId, conversationId, {
      template_id: template.meta?.name || null,
    });
  }
  conversation = await walkMachine(tenantId, conversationId, machineState);

  const leaked = sanitizeOutput(final.text || '', template, { tenantId, conversationId });
  const responseText = leaked.leaked ? leaked.text : final.text;

  const intro = context.history.find(h => h.node === 'apertura')?.result?.output?.text || '';
  const response = `${intro}${intro && responseText ? ' ' : ''}${responseText}`;

  const stateSnapshot = { ...context.state, _stage: stage };
  const commercial = projectCommercial({
    machineState,
    lost: !!stateSnapshot._lost,
    followupAttempt: stateSnapshot._followupAttempt || 0,
    score: stateSnapshot._score != null ? stateSnapshot._score : null,
  });

  const leadExtract = {};
  for (const [k, v] of Object.entries(stateSnapshot)) {
    if (!k.startsWith('_')) leadExtract[k] = v;
  }

  await checkpointer.saveTurn({
    tenantId,
    conversationId,
    templateId: template.meta?.name || null,
    machineState: stateSnapshot._stage || machineState,
    commercialState: commercial.state,
    score: stateSnapshot._score != null ? stateSnapshot._score : null,
    autonomyZone: stateSnapshot._autonomyZone || 'green',
    leadExtract,
    objections: stateSnapshot._objections_log || [],
    topics: [stage, leadExtract.interest, leadExtract.service_type].filter(Boolean),
    path,
    userMessage: input.message || '',
    agentMessage: responseText,
  });

  let previousStage = restored.machineStage || null;
  for (const step of context.history) {
    await logEvent('state_transition', {
      level: 'info',
      message: `Etapa grafo: ${previousStage || 'inicio'} → ${step.node}`,
      tenantId,
      conversationId,
      module: 'agentCore',
      flow: 'grafo.comercial',
      action: 'graph.stage',
      data: { from: previousStage, to: step.node, path },
    });
    previousStage = step.node;
  }

  endSpan(span, {
    status: 'OK',
    attributes: {
      'wibsite.final_stage': stage,
      'wibsite.commercial_state': commercial.state,
      'wibsite.autonomy_zone': stateSnapshot._autonomyZone || 'green',
      'wibsite.score': stateSnapshot._score ?? null,
      'wibsite.next_action': final.next_action || null,
    },
  });

  return {
    response: responseText,
    stage,
    intent: stateSnapshot._intent || 'venta',
    score: stateSnapshot._score ?? null,
    autonomyZone: stateSnapshot._autonomyZone || 'green',
    commercialState: commercial.state,
    nextAction: final.next_action || null,
    path,
    completeness: final.completeness ?? null,
    briefing: final.briefing || null,
  };
}

const { executeTestGraph } = require('./testGraph');

module.exports = { createCommercialGraph, executeCommercialGraph, executeTestGraph, Graph, isObjectionTurn };