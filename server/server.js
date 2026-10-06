const { once } = require('node:events');
const { createApp } = require('./app');

async function start() {
  const { server, httpServer } = await createApp();
  const db = require('./config/connection');
  await db.ready;
  const port = Number(process.env.PORT) || 3001;
  httpServer.listen(port, '0.0.0.0');
  await once(httpServer, 'listening');
  console.log('API server running on port ' + port + '!');
  console.log('Use GraphQL at http://localhost:' + port + '/graphql');
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await server.stop();
    await db.close();
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}

start().catch(error => {
  console.error('API startup failed (' + (error.code || error.name) + '). Check database connectivity and runtime configuration.');
  process.exitCode = 1;
});
 
