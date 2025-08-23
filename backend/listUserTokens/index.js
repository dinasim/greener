const { CosmosClient } = require('@azure/cosmos');

module.exports = async function (context, req) {
  try {
    const userId = req.params.userId || (req.query && req.query.userId);
    const conn = process.env.COSMOSDB_MARKETPLACE_CONNECTION_STRING || process.env.COSMOS_CONN;
    const dbName = process.env.COSMOSDB_MARKETPLACE_DATABASE_NAME;
    const containerName = 'notifications';
    if (!conn || !dbName) {
      context.res = { status: 500, body: { error: 'cosmos config missing' } };
      return;
    }
    const cosmos = new CosmosClient(conn);
    const container = cosmos.database(dbName).container(containerName);

    let query;
    if (userId) {
      query = {
        query: 'SELECT c.id, c.userId, c.provider, c.platform, c.valid, c.createdAt, c.lastSeenAt FROM c WHERE c.userId = @u',
        parameters: [{ name: '@u', value: userId }]
      };
    } else {
      query = {
        query: 'SELECT TOP 50 c.id, c.userId, c.provider, c.platform, c.valid, c.createdAt FROM c'
      };
    }
    const { resources } = await container.items.query(query).fetchAll();
    context.res = { status: 200, body: { count: resources.length, items: resources } };
  } catch (e) {
    context.log.error('listUserTokens error', e);
    context.res = { status: 500, body: { error: 'internal' } };
  }
};
