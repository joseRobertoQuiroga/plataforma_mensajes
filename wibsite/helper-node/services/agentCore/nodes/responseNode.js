function createResponseNode() {
  return async (context) => {
    const lastResult = context.history[context.history.length - 1]?.result || {};
    return {
      output: {
        text: lastResult.output || '',
        state: context.state,
        conversationId: context.conversationId,
        turnCount: context.history.length
      }
    };
  };
}

module.exports = { createResponseNode };
