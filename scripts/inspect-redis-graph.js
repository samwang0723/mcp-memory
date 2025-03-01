const { createClient, Graph } = require('redis');

async function inspectRedisGraph() {
  console.log('🔍 Inspecting Redis Graph');

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

    // Get list of graphs using GRAPH.LIST
    console.log('\n📊 Redis Graphs:');
    try {
      const graphList = await client.sendCommand(['GRAPH.LIST']);
      if (graphList && graphList.length > 0) {
        console.log(graphList);
      } else {
        console.log('No graphs found');
      }
    } catch (error) {
      console.error('Error listing graphs:', error.message);
    }

    // Use the 'memory' graph
    const graphName = 'memory';

    try {
      // Get graph schema information
      console.log(`\n📋 Schema for graph '${graphName}':`);

      // Get node labels using direct query
      console.log(`\n📑 Node labels in graph '${graphName}':`);
      try {
        const labelsResult = await client.sendCommand([
          'GRAPH.QUERY',
          graphName,
          'MATCH (n) RETURN DISTINCT labels(n) as label',
        ]);

        // Extract labels from result
        const labels = labelsResult[1].map((row) => row[0]).filter(Boolean);

        if (labels.length > 0) {
          console.log('Labels:', labels.join(', '));
        } else {
          console.log('No labels found');
        }
      } catch (labelError) {
        console.error('Error getting node labels:', labelError.message);
      }

      // Get relationship types using direct query
      console.log(`\n📑 Relationship types in graph '${graphName}':`);
      try {
        const relTypesResult = await client.sendCommand([
          'GRAPH.QUERY',
          graphName,
          'MATCH ()-[r]->() RETURN DISTINCT type(r) as relType',
        ]);

        // Extract relationship types from result
        const relTypes = relTypesResult[1].map((row) => row[0]).filter(Boolean);

        if (relTypes.length > 0) {
          console.log('Relationship types:', relTypes.join(', '));
        } else {
          console.log('No relationship types found');
        }
      } catch (relTypeError) {
        console.error(
          'Error getting relationship types:',
          relTypeError.message,
        );
      }

      // Get property keys using direct query
      console.log(`\n📑 Property keys in graph '${graphName}':`);
      try {
        const propsResult = await client.sendCommand([
          'GRAPH.QUERY',
          graphName,
          'MATCH (n) UNWIND keys(n) as key RETURN DISTINCT key',
        ]);

        // Extract property keys from result
        const propKeys = propsResult[1].map((row) => row[0]).filter(Boolean);

        if (propKeys.length > 0) {
          console.log('Property keys:', propKeys.join(', '));
        } else {
          console.log('No property keys found');
        }
      } catch (propsError) {
        console.error('Error getting property keys:', propsError.message);
      }

      // Count nodes
      console.log(`\n🔢 Node count in graph '${graphName}':`);
      try {
        const nodeCountResult = await client.sendCommand([
          'GRAPH.QUERY',
          graphName,
          'MATCH (n) RETURN count(n)',
        ]);

        console.log(`Total nodes: ${nodeCountResult[1][0][0]}`);
      } catch (countError) {
        console.error('Error counting nodes:', countError.message);
      }

      // Count nodes by type
      console.log(`\n📊 Node count by type in graph '${graphName}':`);
      try {
        const nodeTypeCountResult = await client.sendCommand([
          'GRAPH.QUERY',
          graphName,
          'MATCH (n) RETURN labels(n) as Type, count(n) as Count',
        ]);

        // Extract headers and data
        const headers = nodeTypeCountResult[0];
        const data = nodeTypeCountResult[1];

        if (data.length > 0) {
          data.forEach((row) => {
            console.log(`${row[0]}: ${row[1]}`);
          });
        } else {
          console.log('No node types found');
        }
      } catch (typeCountError) {
        console.error('Error counting node types:', typeCountError.message);
      }

      // Sample nodes of each type
      console.log(`\n📄 Sample nodes from graph '${graphName}':`);

      // Get all node types first
      let nodeTypes = [];
      try {
        const typesResult = await client.sendCommand([
          'GRAPH.QUERY',
          graphName,
          'MATCH (n) RETURN DISTINCT labels(n)',
        ]);

        nodeTypes = typesResult[1].map((row) => row[0]).filter(Boolean);
      } catch (typesError) {
        console.error('Error getting node types:', typesError.message);
      }

      // For each node type, get sample nodes
      for (const nodeType of nodeTypes) {
        console.log(`\n${nodeType} nodes:`);
        try {
          // Remove square brackets from the nodeType if they exist
          const cleanNodeType = nodeType.replace(/[\[\]]/g, '');

          const nodesResult = await client.sendCommand([
            'GRAPH.QUERY',
            graphName,
            `MATCH (n:${cleanNodeType}) RETURN n.id, n.title, n.content LIMIT 3`,
          ]);

          // Extract headers and data
          const headers = nodesResult[0];
          const data = nodesResult[1];

          if (data.length > 0) {
            data.forEach((row, index) => {
              console.log(`\nNode ${index + 1}:`);
              headers.forEach((header, i) => {
                console.log(`${header}: ${row[i]}`);
              });
            });
          } else {
            console.log(`No ${nodeType} nodes found`);
          }
        } catch (nodesError) {
          console.error(`Error getting ${nodeType} nodes:`, nodesError.message);
        }
      }

      // Count relationships
      console.log(`\n🔗 Relationship count in graph '${graphName}':`);
      try {
        const relCountResult = await client.sendCommand([
          'GRAPH.QUERY',
          graphName,
          'MATCH ()-[r]->() RETURN count(r)',
        ]);

        console.log(`Total relationships: ${relCountResult[1][0][0]}`);
      } catch (relCountError) {
        console.error('Error counting relationships:', relCountError.message);
      }

      // Get relationship types and sample relationships
      console.log(
        `\n📝 Relationship types and samples in graph '${graphName}':`,
      );
      try {
        const relTypesResult = await client.sendCommand([
          'GRAPH.QUERY',
          graphName,
          'MATCH ()-[r]->() RETURN DISTINCT type(r)',
        ]);

        const relTypes = relTypesResult[1].map((row) => row[0]).filter(Boolean);

        if (relTypes.length > 0) {
          console.log('Relationship types:', relTypes.join(', '));

          // Sample relationships of each type
          for (const relType of relTypes) {
            console.log(`\n${relType} relationships:`);
            try {
              const relResult = await client.sendCommand([
                'GRAPH.QUERY',
                graphName,
                `MATCH (a)-[r:${relType}]->(b) RETURN a.id, type(r), b.id LIMIT 3`,
              ]);

              // Extract data
              const data = relResult[1];

              if (data.length > 0) {
                data.forEach((row, index) => {
                  console.log(
                    `Relationship ${index + 1}: ${row[0]} -[${row[1]}]-> ${row[2]}`,
                  );
                });
              } else {
                console.log(`No ${relType} relationships found`);
              }
            } catch (relError) {
              console.error(
                `Error getting ${relType} relationships:`,
                relError.message,
              );
            }
          }
        } else {
          console.log('No relationship types found');
        }
      } catch (relTypesError) {
        console.error(
          'Error getting relationship types:',
          relTypesError.message,
        );
      }

      // Get graph statistics
      console.log(`\n📊 Graph statistics for '${graphName}':`);
      try {
        const statsResult = await client.sendCommand([
          'GRAPH.QUERY',
          graphName,
          'CALL db.stats()',
        ]);

        if (statsResult[1] && statsResult[1].length > 0) {
          console.log(JSON.stringify(statsResult[1][0][0], null, 2));
        } else {
          console.log('No statistics available or db.stats() not supported');
        }
      } catch (statsError) {
        console.log('db.stats() not supported in this RedisGraph version');
      }
    } catch (graphError) {
      console.error('Error querying graph:', graphError);
    }

    // Disconnect
    await client.disconnect();
    console.log('\n✅ Inspection complete');
  } catch (error) {
    console.error('Error during inspection:', error);
    try {
      await client.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
  }
}

inspectRedisGraph().catch(console.error);
