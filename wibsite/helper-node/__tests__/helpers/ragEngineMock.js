module.exports = {
  queryRAG: jest.fn().mockResolvedValue([{ text: 'Contexto de KB', certainty: 0.9 }]),
  checkWeaviateHealth: jest.fn().mockResolvedValue(true),
  queryKnowledgeBase: jest.fn().mockResolvedValue([]),
  addDocument: jest.fn().mockResolvedValue({}),
  deleteDocument: jest.fn().mockResolvedValue({}),
  listDocuments: jest.fn().mockResolvedValue([]),
  addInMemoryDocument: jest.fn().mockResolvedValue({}),
  queryInMemoryKB: jest.fn().mockResolvedValue([])
};
