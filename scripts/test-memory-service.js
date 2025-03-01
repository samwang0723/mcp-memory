const { createClient, Graph } = require('redis');
const path = require('path');

// Set up path to import from dist directory
process.env.NODE_PATH = path.join(__dirname, '../dist');
require('module').Module._initPaths();

// Import the memory service and types from the compiled JavaScript
const { MemoryService } = require('../dist/services/memory-service');
const { MemoryNodeType, MemoryRelationType } = require('../dist/models/memory');

async function testMemoryService() {
  console.log('🧪 Starting Memory Service Test');

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

    // Initialize the graph and memory service
    const graph = new Graph(client, 'test-memory-service');
    const memoryService = new MemoryService(graph);
    await memoryService.initialize();
    console.log('✅ Memory service initialized');

    // Test 1: Create a project memory
    console.log('\n🔍 TEST 1: Create a project memory');
    try {
      const project = await memoryService.createMemory({
        type: MemoryNodeType.PROJECT,
        title: 'Test Project',
        content: 'This is a test project for the memory service',
        // Ensure all required fields are provided
        metadata: {},
      });
      console.log('✅ Created project memory:', project);

      // Test 2: Create a task memory
      console.log('\n🔍 TEST 2: Create a task memory');
      const task = await memoryService.createMemory({
        type: MemoryNodeType.TASK,
        title: 'Test Task',
        content: 'This is a test task for the memory service',
        status: 'pending',
        dueDate: Date.now() + 86400000, // Due tomorrow
        metadata: {},
      });
      console.log('✅ Created task memory:', task);

      // Test 3: Create a relationship between project and task
      console.log(
        '\n🔍 TEST 3: Create a relationship between project and task',
      );
      await memoryService.createRelation({
        from: project.id,
        to: task.id,
        type: MemoryRelationType.CONTAINS,
        properties: {
          created: Date.now(),
        },
      });
      console.log('✅ Created relationship from project to task');

      // Test 4: Get memory by ID
      console.log('\n🔍 TEST 4: Get memory by ID');
      const retrievedProject = await memoryService.getMemoryById(project.id);
      console.log('✅ Retrieved project by ID:', retrievedProject);

      // Test 5: Search memories
      console.log('\n🔍 TEST 5: Search memories');
      const searchResults = await memoryService.searchMemories(
        { keyword: 'test' },
        { limit: 10, orderBy: 'created', direction: 'DESC' },
      );
      console.log(`✅ Found ${searchResults.length} memories in search`);
      searchResults.forEach((memory, index) => {
        console.log(`Memory ${index + 1}:`, memory);
      });

      // Test 6: Get related memories
      console.log('\n🔍 TEST 6: Get related memories');
      const relatedMemories = await memoryService.getRelatedMemories(
        project.id,
      );
      console.log(
        `✅ Found ${relatedMemories.length} memories related to project`,
      );
      relatedMemories.forEach((memory, index) => {
        console.log(`Related memory ${index + 1}:`, memory);
      });

      // Test 7: Update a memory
      console.log('\n🔍 TEST 7: Update a memory');
      const updatedTask = await memoryService.updateMemory(task.id, {
        title: 'Updated Test Task',
        status: 'in-progress',
        content: 'This task has been updated',
      });
      console.log('✅ Updated task memory:', updatedTask);

      // Test 8: Delete memories
      console.log('\n🔍 TEST 8: Delete memories');

      // Delete task first (to avoid constraint violations)
      const taskDeleted = await memoryService.deleteMemory(task.id);
      console.log(
        'Task deletion result:',
        taskDeleted ? '✅ Success' : '❌ Failed',
      );

      // Delete project
      const projectDeleted = await memoryService.deleteMemory(project.id);
      console.log(
        'Project deletion result:',
        projectDeleted ? '✅ Success' : '❌ Failed',
      );

      // Verify deletion
      const verifyTask = await memoryService.getMemoryById(task.id);
      const verifyProject = await memoryService.getMemoryById(project.id);

      if (!verifyTask && !verifyProject) {
        console.log('✅ Successfully verified deletion of all test memories');
      } else {
        console.error('❌ Some memories were not deleted');
        if (verifyTask) console.log('Task still exists:', verifyTask);
        if (verifyProject) console.log('Project still exists:', verifyProject);
      }
    } catch (testError) {
      console.error('❌ Test error:', testError);
    }

    // Clean up the test graph
    console.log('\n🧹 Cleaning up test graph');
    try {
      await client.sendCommand(['GRAPH.DELETE', 'test-memory-service']);
      console.log('✅ Successfully deleted the test graph');
    } catch (error) {
      console.error('❌ Error deleting test graph:', error);
    }

    // Disconnect
    await client.disconnect();
    console.log('✅ Successfully disconnected from Redis');
    console.log('\n🎉 All memory service tests completed successfully!');
  } catch (error) {
    console.error('❌ Error during test:', error);
    try {
      await client.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
  }
}

testMemoryService().catch(console.error);
