const realFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  try { return await realFetch(...args); }
  catch (error) {
    const url = new URL(typeof args[0] === 'object' && args[0].url ? args[0].url : String(args[0]));
    console.error('CLOUD_LOOPBACK_FETCH_FAILURE', JSON.stringify({ host: url.host, path: url.pathname, name: error.name, code: error.cause?.code, cause: error.cause?.name, message: error.cause?.message }));
    throw error;
  }
};
