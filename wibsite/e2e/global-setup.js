async function globalSetup() {
  // Wait 2s before starting to ensure rate limiter window is clear
  await new Promise(r => setTimeout(r, 2000));
}

export default globalSetup;
