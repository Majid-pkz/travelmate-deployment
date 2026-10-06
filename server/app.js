const express = require('express');
const http = require('node:http');
const path = require('node:path');
const mongoose = require('mongoose');
const { GraphQLError } = require('graphql');
const { ApolloServer } = require('@apollo/server');
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer');
const { expressMiddleware } = require('@as-integrations/express4');
const { rateLimit } = require('express-rate-limit');
const { authMiddleware } = require('./utils/auth');
const { typeDefs, resolvers } = require('./schemas');
const imageRoutes = require('./schemas/image-routes');

function limitFields(context) {
  let fields = 0;
  return {
    Field() {
      fields += 1;
      if (fields === 101) context.reportError(new GraphQLError('Request fewer fields at a time.'));
    },
  };
}

async function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });
  const httpServer = http.createServer(app);
  const server = new ApolloServer({
    typeDefs, resolvers,
    csrfPrevention: true,
    introspection: process.env.NODE_ENV !== 'production',
    includeStacktraceInErrorResponses: false,
    parseOptions: { maxTokens: 2000 },
    validationRules: [limitFields],
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    formatError(error) {
      if (error.extensions?.code === 'INTERNAL_SERVER_ERROR') {
        return { message: 'The request could not be completed. Please try again.', extensions: { code: 'INTERNAL_SERVER_ERROR' } };
      }
      return error;
    },
  });
  await server.start();
  app.use('/graphql',
    rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }),
    express.json({ limit: '32kb' }),
    expressMiddleware(server, { context: async ({ req }) => authMiddleware({ req }) }),
  );
  app.use('/api/images',
    rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }),
    imageRoutes,
  );
  app.get('/api/health', (req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'unavailable' });
  });
  // Keep the original checked-in image URLs usable; new photos live in MongoDB.
  app.use('/images', express.static(path.join(__dirname, 'images')));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/build')));
    app.get(/^\/(?!graphql(?:\/|$)|images(?:\/|$)|assets(?:\/|$)).*/, (req, res) => {
      res.sendFile(path.join(__dirname, '../client/build/index.html'));
    });
  }
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
    res.status(status).json({ error: status === 500 ? 'The request could not be completed.' : 'Check the request and try again.' });
  });
  return { app, server, httpServer };
}

module.exports = { createApp };
