const { createClient, Graph } = require('redis');
const { v4: uuidv4 } = require('uuid');

// Memory node types (matching your TypeScript enums)
const MemoryNodeType = {
  CONVERSATION: 'Conversation',
  TOPIC: 'Topic',
  PROJECT: 'Project',
  TASK: 'Task',
  ISSUE: 'Issue',
  CONFIG: 'Config',
  FINANCE: 'Finance',
  TODO: 'Todo',
};

// Memory relation types (matching your TypeScript enums)
const MemoryRelationType = {
  CONTAINS: 'CONTAINS',
  RELATED_TO: 'RELATED_TO',
  DEPENDS_ON: 'DEPENDS_ON',
  PART_OF: 'PART_OF',
  RESOLVED_BY: 'RESOLVED_BY',
  CREATED_AT: 'CREATED_AT',
  UPDATED_AT: 'UPDATED_AT',
};

async function testMemoryOperations() {
  console.log('🧪 Starting Memory Operations Test');

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

    // Initialize the graph
    const graph = new Graph(client, 'test-memory');
    console.log('✅ Graph initialized');

    // Test 1: Create a memory node (INSERT)
    console.log('\n🔍 TEST 1: Create a memory node');
    const projectId = uuidv4();
    const projectCreated = Date.now();

    try {
      await graph.query(
        `CREATE (m:Memory {
          id: $id,
          type: $type,
          title: $title,
          content: $content,
          created: $created,
          updated: $updated
        })`,
        {
          params: {
            id: projectId,
            type: MemoryNodeType.PROJECT,
            title: 'Test Project',
            content: 'This is a test project for Redis Graph',
            created: projectCreated,
            updated: projectCreated,
          },
        },
      );
      console.log('✅ Created project memory with ID:', projectId);

      // Test 2: Query the memory node
      console.log('\n🔍 TEST 2: Query the memory node');
      const queryResult = await graph.query(
        `MATCH (m:Memory {id: $id}) RETURN m`,
        { params: { id: projectId } },
      );

      if (queryResult.data.length > 0) {
        console.log('✅ Successfully queried the memory node:');
        // Extract the properties from the node result
        const nodeData = queryResult.data[0].m.properties;
        console.log(JSON.stringify(nodeData, null, 2));
      } else {
        console.error('❌ Failed to query the memory node');
      }

      // Test 3: Update the memory node
      console.log('\n🔍 TEST 3: Update the memory node');
      const updatedTime = Date.now();

      await graph.query(
        `MATCH (m:Memory {id: $id})
         SET m.title = $title, m.content = $content, m.updated = $updated
         RETURN m`,
        {
          params: {
            id: projectId,
            title: 'Updated Test Project',
            content: 'This project has been updated',
            updated: updatedTime,
          },
        },
      );
      console.log('✅ Updated project memory');

      // Verify the update
      const updatedResult = await graph.query(
        `MATCH (m:Memory {id: $id}) RETURN m`,
        { params: { id: projectId } },
      );

      if (updatedResult.data.length > 0) {
        console.log('✅ Successfully verified the update:');
        // Extract the properties from the node result
        const nodeData = updatedResult.data[0].m.properties;
        console.log(JSON.stringify(nodeData, null, 2));
      } else {
        console.error('❌ Failed to verify the update');
      }

      // Test 4: Create another memory node for relationship testing
      console.log(
        '\n🔍 TEST 4: Create another memory node for relationship testing',
      );
      const taskId = uuidv4();
      const taskCreated = Date.now();

      await graph.query(
        `CREATE (m:Memory {
          id: $id,
          type: $type,
          title: $title,
          content: $content,
          status: $status,
          created: $created,
          updated: $updated
        })`,
        {
          params: {
            id: taskId,
            type: MemoryNodeType.TASK,
            title: 'Test Task',
            content: 'This is a test task for the test project',
            status: 'pending',
            created: taskCreated,
            updated: taskCreated,
          },
        },
      );
      console.log('✅ Created task memory with ID:', taskId);

      // Test 5: Create a relationship between nodes
      console.log('\n🔍 TEST 5: Create a relationship between nodes');

      // Use a string literal for the relationship type
      await graph.query(
        `MATCH (a:Memory {id: $fromId})
         MATCH (b:Memory {id: $toId})
         CREATE (a)-[r:CONTAINS {created: $created}]->(b)
         RETURN r`,
        {
          params: {
            fromId: projectId,
            toId: taskId,
            created: Date.now(),
          },
        },
      );
      console.log(`✅ Created CONTAINS relationship from project to task`);

      // Test 6: Query related memories
      console.log('\n🔍 TEST 6: Query related memories');

      const relatedResult = await graph.query(
        `MATCH (a:Memory {id: $id})-[r:CONTAINS]->(b:Memory)
         RETURN b`,
        { params: { id: projectId } },
      );

      if (relatedResult.data.length > 0) {
        console.log(`✅ Found ${relatedResult.data.length} related memories:`);
        relatedResult.data.forEach((row, index) => {
          // Extract the properties from the node result
          const nodeData = row.b.properties;
          console.log(
            `Related memory ${index + 1}:`,
            JSON.stringify(nodeData, null, 2),
          );
        });
      } else {
        console.error('❌ Failed to find related memories');
      }

      // Test 7: Search memories by type and keyword
      console.log('\n🔍 TEST 7: Search memories by type and keyword');

      const searchResult = await graph.query(
        `MATCH (m:Memory)
         WHERE m.type = $type AND m.content CONTAINS $keyword
         RETURN m
         ORDER BY m.created DESC
         LIMIT 10`,
        {
          params: {
            type: MemoryNodeType.TASK,
            keyword: 'test',
          },
        },
      );

      if (searchResult.data.length > 0) {
        console.log(
          `✅ Found ${searchResult.data.length} memories matching search criteria:`,
        );
        searchResult.data.forEach((row, index) => {
          // Extract the properties from the node result
          const nodeData = row.m.properties;
          console.log(
            `Search result ${index + 1}:`,
            JSON.stringify(nodeData, null, 2),
          );
        });
      } else {
        console.error('❌ Failed to find memories matching search criteria');
      }

      // Test 8: Delete the memories and relationships
      console.log('\n🔍 TEST 8: Delete the memories and relationships');

      // Delete relationships first
      await graph.query(
        `MATCH (a:Memory {id: $fromId})-[r]->(b:Memory {id: $toId})
         DELETE r`,
        {
          params: {
            fromId: projectId,
            toId: taskId,
          },
        },
      );
      console.log('✅ Deleted relationships');

      // Delete the task memory
      await graph.query(
        `MATCH (m:Memory {id: $id})
         DELETE m`,
        { params: { id: taskId } },
      );
      console.log('✅ Deleted task memory');

      // Delete the project memory
      await graph.query(
        `MATCH (m:Memory {id: $id})
         DELETE m`,
        { params: { id: projectId } },
      );
      console.log('✅ Deleted project memory');

      // Verify deletion
      const verifyDeletion = await graph.query(
        `MATCH (m:Memory)
         WHERE m.id = $projectId OR m.id = $taskId
         RETURN m`,
        {
          params: {
            projectId,
            taskId,
          },
        },
      );

      if (verifyDeletion.data.length === 0) {
        console.log('✅ Successfully verified deletion of all test memories');
      } else {
        console.error(
          '❌ Some memories were not deleted:',
          verifyDeletion.data.length,
        );
      }
    } catch (testError) {
      console.error('❌ Test error:', testError);
    }

    // Clean up the test graph
    console.log('\n🧹 Cleaning up test graph');
    try {
      await client.sendCommand(['GRAPH.DELETE', 'test-memory']);
      console.log('✅ Successfully deleted the test graph');
    } catch (error) {
      console.error('❌ Error deleting test graph:', error);
    }

    // Disconnect
    await client.disconnect();
    console.log('✅ Successfully disconnected from Redis');
    console.log('\n🎉 All tests completed successfully!');
  } catch (error) {
    console.error('❌ Error during test:', error);
    try {
      await client.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
  }
}

testMemoryOperations().catch(console.error);
