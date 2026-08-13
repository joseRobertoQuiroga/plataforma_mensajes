'use strict';
class Graph {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.entryNode = null;
    this.template = null;
  }

  setTemplate(template) { this.template = template; }

  addNode(name, handler) {
    this.nodes.set(name, handler);
    this.edges.set(name, []);
    if (!this.entryNode) this.entryNode = name;
  }

  addEdge(from, to, when = null) {
    if (!this.nodes.has(from) || !this.nodes.has(to)) {
      throw new Error(`Invalid edge: ${from} -> ${to}`);
    }
    this.edges.get(from).push({ to, when });
  }

  setEntry(name) {
    if (!this.nodes.has(name)) throw new Error(`Node not found: ${name}`);
    this.entryNode = name;
  }

  async execute(input) {
    const context = {
      ...input,
      state: { ...(input.state || {}) },
      history: [],
      currentNode: this.entryNode,
      template: input.template || this.template || {},
      machineStage: input.machineStage || 'greeting',
      checkpoint: input.checkpoint || null,
      lastOutput: null,
    };
    await this._executeNode(this.entryNode, context);
    return {
      context: this._summarize(context),
      final: context.lastOutput || { text: '', stage: 'apertura' },
      path: context.history.map(h => h.node),
    };
  }

  async _executeNode(nodeName, context) {
    const handler = this.nodes.get(nodeName);
    if (!handler) throw new Error(`Node not found: ${nodeName}`);
    const result = await handler(context);
    context.history.push({ node: nodeName, result });
    context.lastOutput = result.output;
    if (result.state) Object.assign(context.state, result.state);

    const candidates = this.edges.get(nodeName) || [];
    if (candidates.length === 0) return;
    const next = candidates.find(e => !e.when || e.when(result, context));
    if (!next) return;
    await this._executeNode(next.to, context);
  }

  _summarize(context) {
    return {
      conversationId: context.conversationId,
      turnCount: context.history.length,
      path: context.history.map(h => h.node),
      stages: context.history.map(h => h.result.output?.stage || h.node),
      state: context.state,
      history: context.history,
    };
  }
}

module.exports = { Graph };