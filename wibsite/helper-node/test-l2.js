const { runScheduledEvaluateAll } = require('./index.js');
// Wait for store to load
setTimeout(async () => {
  await runScheduledEvaluateAll();
  console.log('Evaluate all completed');
  process.exit(0);
}, 2000);
