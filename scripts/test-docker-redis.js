const { createClient } = require('redis');

async function testRedisConnection() {
  // Get Redis URL from environment variable or use default
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  console.log(`Attempting to connect to Redis at: ${redisUrl}`);

  // Create Redis client
  const client = createClient({
    url: redisUrl,
  });

  client.on('error', (err) => {
    console.error('Redis Client Error:', err);
    process.exit(1);
  });

  try {
    // Connect to Redis
    await client.connect();
    console.log('✅ Successfully connected to Redis');

    // Test a simple command
    const pong = await client.ping();
    console.log('Redis PING response:', pong);

    // Disconnect
    await client.disconnect();
    console.log('✅ Successfully disconnected from Redis');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the test
testRedisConnection();
