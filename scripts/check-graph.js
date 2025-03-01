const { createClient, Graph } = require('redis');

async function checkGraph() {
  console.log('🔍 Checking Redis Graph');

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

    // Use the 'memory' graph
    const graphName = 'memory';

    try {
      // Get all nodes using raw GRAPH.QUERY
      console.log(`\n📊 All nodes in graph '${graphName}':`);
      const allNodesResult = await client.sendCommand([
        'GRAPH.QUERY',
        graphName,
        'MATCH (n) RETURN n.id, n.type, n.title LIMIT 10',
      ]);

      // Extract header and data rows
      const headers = allNodesResult[0];
      const dataRows = allNodesResult[1];

      console.log(`Found ${dataRows.length} nodes`);

      if (dataRows.length > 0) {
        console.log('\nNode list:');
        dataRows.forEach((row, index) => {
          console.log(`\nNode ${index + 1}:`);
          headers.forEach((header, i) => {
            console.log(`${header}: ${row[i]}`);
          });
        });
      }

      // Get Finance memories
      console.log(`\n💰 Finance memories in graph '${graphName}':`);
      const financeResult = await client.sendCommand([
        'GRAPH.QUERY',
        graphName,
        'MATCH (n:Finance) RETURN n.id, n.type, n.title, n.content LIMIT 10',
      ]);

      // Extract header and data rows
      const financeHeaders = financeResult[0];
      const financeRows = financeResult[1];

      console.log(`Found ${financeRows.length} Finance memories`);

      if (financeRows.length > 0) {
        console.log('\nFinance memories:');
        financeRows.forEach((row, index) => {
          console.log(`\nFinance Memory ${index + 1}:`);
          financeHeaders.forEach((header, i) => {
            console.log(`${header}: ${row[i]}`);
          });
        });
      }

      // Get memory about debit card topup
      console.log(`\n🔍 Looking for debit card topup memory:`);
      const topupResult = await client.sendCommand([
        'GRAPH.QUERY',
        graphName,
        'MATCH (n) WHERE n.content CONTAINS "debit card topup" RETURN n.id, n.type, n.title, n.content LIMIT 5',
      ]);

      // Extract header and data rows
      const topupHeaders = topupResult[0];
      const topupRows = topupResult[1];

      console.log(`Found ${topupRows.length} memories about debit card topup`);

      if (topupRows.length > 0) {
        console.log('\nMatching memories:');
        topupRows.forEach((row, index) => {
          console.log(`\nMemory ${index + 1}:`);
          topupHeaders.forEach((header, i) => {
            console.log(`${header}: ${row[i]}`);
          });
        });
      }

      // Get all relationships
      console.log(`\n🔗 Relationships in graph '${graphName}':`);
      const relResult = await client.sendCommand([
        'GRAPH.QUERY',
        graphName,
        'MATCH (a)-[r]->(b) RETURN a.id, type(r), b.id LIMIT 10',
      ]);

      // Extract header and data rows
      const relHeaders = relResult[0];
      const relRows = relResult[1];

      console.log(`Found ${relRows.length} relationships`);

      if (relRows.length > 0) {
        console.log('\nRelationships:');
        relRows.forEach((row, index) => {
          console.log(
            `\nRelationship ${index + 1}: ${row[0]} -[${row[1]}]-> ${row[2]}`,
          );
        });
      } else {
        console.log('No relationships found');
      }
    } catch (graphError) {
      console.error('Error querying graph:', graphError);
    }

    // Disconnect
    await client.disconnect();
    console.log('\n✅ Check complete');
  } catch (error) {
    console.error('Error during check:', error);
    try {
      await client.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
  }
}

checkGraph().catch(console.error);
