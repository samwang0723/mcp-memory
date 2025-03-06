import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient, Graph } from 'redis';
import { registerMemoryTools } from './tools/memory-tools';
import { MemoryService } from './services/memory-service';

// Get Redis URL from environment variable or use default
const redisUrl = process.env.REDIS_URL || 'redis://host.docker.internal:6379';
console.log(`Connecting to Redis at: ${redisUrl}`);

// Create Redis client with explicit connection settings
const client = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      console.log(`Redis reconnect attempt: ${retries}`);
      return Math.min(retries * 100, 3000);
    },
    connectTimeout: 10000 // 10 seconds
  }
});

client.on('error', (err) => console.log('Redis Client Error:', err));
client.on('connect', () => console.log('Redis Client Connected'));
client.on('ready', () => console.log('Redis Client Ready'));
client.on('reconnecting', () => console.log('Redis Client Reconnecting'));
client.on('end', () => console.log('Redis Client Connection Ended'));

// Declare graph as a global constant
let graph: Graph;

// Create an MCP server
const server = new McpServer({
  name: 'mcp-memory',
  version: '1.0.0',
});

// Initialize Redis and start the MCP server
async function initialize() {
  try {
    // Connect to Redis
    console.log('Attempting to connect to Redis...');
    await client.connect();
    console.log('Redis connected successfully');
    
    // Test Redis connection
    try {
      const pong = await client.ping();
      console.log('Redis PING response:', pong);
    } catch (pingError) {
      console.error('Redis PING failed:', pingError);
      throw pingError;
    }
    
    // Initialize the graph
    console.log('Initializing Redis Graph...');
    graph = new Graph(client, 'memory');
    
    // Initialize memory service and register tools
    const memoryService = new MemoryService(graph);
    await memoryService.initialize();
    
    // Register memory tools
    registerMemoryTools(server, graph);

    // Start the MCP server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log('MCP server started successfully');
  } catch (error) {
    console.error('Initialization error:', error);
    process.exit(1);
  }
}

// Start the server
initialize();

// Handle graceful shutdown
process.stdin.on('close', async () => {
  console.error('Memory MCP Server closed');
  server.close();
  await client.disconnect();
  console.log('Redis disconnected');
});

// Handle other termination signals
['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, async () => {
    console.log(`Received ${signal}, shutting down...`);
    server.close();
    await client.disconnect();
    process.exit(0);
  });
});