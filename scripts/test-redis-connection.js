const { createClient } = require('redis');

async function testRedisConnection() {
  // Create Redis client
  const client = createClient({
    url: 'redis://localhost:6379',
  });

  client.on('error', (err) => {
    console.error('Redis Client Error:', err);
    process.exit(1);
  });

  try {
    // Connect to Redis
    await client.connect();
    console.log('✅ Successfully connected to Redis');

    // Check if RedisGraph module is loaded
    const modules = await client.sendCommand(['MODULE', 'LIST']);

    // Parse the modules response
    const moduleNames = [];
    for (let i = 0; i < modules.length; i++) {
      const module = modules[i];
      if (Array.isArray(module) && module.length >= 2) {
        moduleNames.push(module[1].toString());
      }
    }

    if (moduleNames.some((name) => name.toLowerCase().includes('graph'))) {
      console.log('✅ RedisGraph module is loaded');
    } else {
      console.error('❌ RedisGraph module is not loaded');
      console.log('Available modules:', moduleNames.join(', '));
    }

    // Test creating a simple graph
    try {
      await client.sendCommand([
        'GRAPH.QUERY',
        'test-graph',
        'CREATE (:Person{name:"test"})',
      ]);
      console.log('✅ Successfully created a test node in RedisGraph');

      // Query the graph
      const result = await client.sendCommand([
        'GRAPH.QUERY',
        'test-graph',
        'MATCH (p:Person) RETURN p.name',
      ]);

      console.log('✅ Successfully queried the graph');
      console.log('Query result:', result);

      // Clean up
      await client.sendCommand(['GRAPH.DELETE', 'test-graph']);
      console.log('✅ Successfully deleted the test graph');
    } catch (graphError) {
      console.error('❌ Error testing RedisGraph:', graphError);
    }

    // Disconnect
    await client.disconnect();
    console.log('✅ Successfully disconnected from Redis');
  } catch (error) {
    console.error('Error:', error);
  }
}

testRedisConnection().catch(console.error);
