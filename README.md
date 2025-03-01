# MCP Memory with Redis Graph

This project implements a memory system for LLM conversations using Redis Graph for long-term memory storage.

## Setup

### Prerequisites

- Docker and Docker Compose
- Node.js (v16 or higher)

### Running Redis with RedisGraph

1. Start the Redis container with RedisGraph module:

```bash
docker-compose up -d
```

2. Verify that Redis is running with the RedisGraph module:

```bash
docker exec -it mcp-memory-redis-1 redis-cli
```

Once in the Redis CLI, you can check if the RedisGraph module is loaded:

```
127.0.0.1:6379> MODULE LIST
```

You should see RedisGraph in the list of loaded modules.

### Connecting to Redis from the application

The application connects to Redis using the configuration in `src/index.ts`. By default, it connects to:

- Host: localhost
- Port: 6379

If you need to change these settings, update the Redis client configuration in `src/index.ts`.

## Usage

1. Install dependencies:

```bash
npm install
```

2. Start the application:

```bash
npm start
```

## Memory Tools

The application provides several tools for managing memories:

- `create_memory`: Create a new memory
- `retrieve_memory`: Retrieve a memory by ID
- `search_memories`: Search for memories by type or keyword
- `update_memory`: Update an existing memory
- `delete_memory`: Delete a memory
- `create_relation`: Create a relationship between memories
- `get_related_memories`: Get memories related to a specific memory

## Example Usage

```typescript
// Create a memory
const memory = await memoryService.createMemory({
  type: MemoryNodeType.CONVERSATION,
  content: 'This is a conversation about Redis Graph',
  title: 'Redis Graph Discussion',
});

// Search for memories
const memories = await memoryService.searchMemories(
  { keyword: 'Redis' },
  { limit: 10, orderBy: 'created', direction: 'DESC' },
);
```

## Overview

MCP Memory is a server that provides tools for storing and retrieving memories from conversations with LLMs. It uses Redis Graph as a backend to create a knowledge graph of memories, allowing for complex relationships between different pieces of information.

## Features

- Store different types of memories (conversations, projects, tasks, issues, configs, finance, todos)
- Create relationships between memories
- Search and retrieve memories based on various criteria
- Update and delete memories

## Memory Types

The system supports various memory types to handle different scenarios:

- **Conversation**: General conversation memories
- **Topic**: Specific topics discussed
- **Project**: Project details (e.g., fiat vendor disable script)
- **Task**: Specific tasks to be done
- **Issue**: Bugs or incidents
- **Config**: Configuration details (e.g., product settings on fees)
- **Finance**: Financial advice or information
- **Todo**: Todo items

## Usage Examples

### 1. Project Details

Store information about projects, configurations, and systems:

```
create_memory(
  type: "Project",
  name: "Fiat Vendor Disable Script",
  description: "Script to disable fiat vendors in the system",
  content: "The script is located at /scripts/disable-vendor.js and takes vendor ID as parameter"
)
```

### 2. Issue Handling

Record bugs and incidents:

```
create_memory(
  type: "Issue",
  title: "Payment Processing Timeout",
  severity: "high",
  status: "open",
  content: "Payments are timing out when processing large transactions over $10,000"
)
```

### 3. Personal Finance Advice

Store financial advice:

```
create_memory(
  type: "Finance",
  category: "Investment",
  content: "Recommendation to allocate 60% to index funds, 30% to bonds, and 10% to speculative investments",
  metadata: {
    riskProfile: "moderate",
    timeHorizon: "long-term"
  }
)
```

### 4. Work-related Todo Items

Save tasks to be done:

```
create_memory(
  type: "Todo",
  title: "Update payment network documentation",
  priority: "medium",
  completed: false,
  content: "Update the documentation to include the new payment networks: Visa Direct and MasterCard Send"
)
```

## Relationships Between Memories

You can create relationships between memories to build a knowledge graph:

```
create_relation(
  fromId: "issue-123",
  toId: "project-456",
  type: "PART_OF"
)
```

## Searching Memories

Search for memories based on various criteria:

```
search_memories(
  type: "Project",
  keyword: "payment",
  limit: 10
)
```

## Architecture

The system uses Redis Graph to store memories as nodes in a graph database. Each memory is a node with properties, and relationships between memories are edges in the graph.

The MCP server provides tools for interacting with the memory graph, allowing LLMs to store and retrieve information as needed.

## License

ISC

## Working with Redis Graph

### Using the Redis CLI Helper

We provide a helper script that connects to Redis and shows common RedisGraph commands:

```bash
npm run redis:cli
```

This will open a Redis CLI session with a list of useful commands for working with the memory graph.

### Checking the Graph

To check the current state of the memory graph, run:

```bash
npm run check:graph
```

This will show all nodes, Finance memories, and relationships in the graph.

### Inspecting the Graph

For a more detailed inspection of the graph schema and contents:

```bash
npm run inspect:graph
```

### Common RedisGraph Commands

Here are some useful commands to run in redis-cli:

1. List all graphs:

   ```
   GRAPH.LIST
   ```

2. Count all nodes:

   ```
   GRAPH.QUERY memory "MATCH (n) RETURN count(n)"
   ```

3. View Finance memories:

   ```
   GRAPH.QUERY memory "MATCH (n:Finance) RETURN n.id, n.title, n.content"
   ```

4. Search for specific content:

   ```
   GRAPH.QUERY memory "MATCH (n) WHERE n.content CONTAINS 'debit card' RETURN n.id, n.type, n.content"
   ```

5. View relationships:
   ```
   GRAPH.QUERY memory "MATCH (a)-[r]->(b) RETURN a.id, type(r), b.id"
   ```

## Running in Docker

To run the MCP Memory server in Docker:

```bash
# Build the Docker image
docker build -t mcp/memory .

# Run the container on the same network as Redis
docker run --rm -i --network=mcp-memory_default -e REDIS_URL=redis://redis:6379 mcp/memory
```

## Testing

We provide several test scripts:

```bash
# Test Redis connection
npm run test:redis

# Test memory operations
npm run test:memory

# Test memory service
npm run test:service
```
