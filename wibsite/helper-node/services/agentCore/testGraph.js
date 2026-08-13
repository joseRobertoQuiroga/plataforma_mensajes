const { Graph } = require('./graph');
const { createEntryNode } = require('./nodes/entryNode');
const { createResponseNode } = require('./nodes/responseNode');

function createTestGraph() {
  const graph = new Graph();
  graph.addNode('entry', createEntryNode());
  graph.addNode('response', createResponseNode());
  graph.addEdge('entry', 'response');
  return graph;
}

async function executeTestGraph(input) {
  const graph = createTestGraph();
  return graph.execute({ message: input.message || input, conversationId: input.conversationId || 'test' });
}

module.exports = { createTestGraph, executeTestGraph };
