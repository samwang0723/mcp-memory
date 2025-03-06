import { Graph } from 'redis';
import { v4 as uuidv4 } from 'uuid';
import {
  MemoryNode,
  MemoryNodeType,
  MemoryRelation,
  MemoryRelationType,
  MemoryQueryOptions,
  MemorySearchCriteria,
} from '../models/memory';

// Define a type for Redis Graph query results
interface RedisGraphQueryResult {
  data?: any[][];
  metadata?: Record<string, any>;
}

export class MemoryService {
  private graph: Graph;

  constructor(graph: Graph) {
    this.graph = graph;
  }

  /**
   * Initialize the memory graph with necessary indices
   */
  async initialize(): Promise<void> {
    try {
      // Create indices for faster lookups
      await this.graph.query('CREATE INDEX ON :Conversation(id)');
      await this.graph.query('CREATE INDEX ON :Topic(id)');
      await this.graph.query('CREATE INDEX ON :Project(id)');
      await this.graph.query('CREATE INDEX ON :Task(id)');
      await this.graph.query('CREATE INDEX ON :Issue(id)');
      await this.graph.query('CREATE INDEX ON :Config(id)');
      await this.graph.query('CREATE INDEX ON :Finance(id)');
      await this.graph.query('CREATE INDEX ON :Todo(id)');

      // console.log('Memory graph indices created successfully');
    } catch (error) {
      console.error('Failed to initialize memory graph:', error);
      throw error;
    }
  }

  /**
   * Create a new memory node
   */
  async createMemory(
    memory: Omit<MemoryNode, 'id' | 'created' | 'updated'>,
  ): Promise<MemoryNode> {
    const now = Date.now();
    const id = uuidv4();

    const newMemory: MemoryNode = {
      ...memory,
      id,
      created: now,
      updated: now,
    };

    // Ensure metadata is properly serialized
    let metadataStr = '{}';
    try {
      // Make sure metadata is a valid object before stringifying
      const metadataObj = newMemory.metadata || {};
      metadataStr = JSON.stringify(metadataObj);
    } catch (error: any) {
      console.error('Error serializing metadata:', error);
      metadataStr = '{}';
    }

    const params = {
      id: newMemory.id,
      type: newMemory.type, // Add type as a property for easier retrieval
      content: newMemory.content || '',
      created: newMemory.created,
      updated: newMemory.updated,
      metadata: metadataStr,
      // Include title directly if it exists
      ...(newMemory.title ? { title: newMemory.title } : {}),
      ...this.extractSpecificProperties(newMemory),
    };

    // Create the node with the correct label (type)
    const query = `
      CREATE (n:${newMemory.type} {
        id: $id,
        type: $type,
        content: $content,
        created: $created,
        updated: $updated,
        metadata: $metadata
        ${newMemory.title ? ', title: $title' : ''}
        ${this.buildAdditionalProperties(newMemory)}
      })
      RETURN n
    `;

    try {
      const result = (await this.graph.query(query, {
        params,
      })) as RedisGraphQueryResult;

      // Log the result for debugging
      // console.debug('Create memory result:', JSON.stringify(result, null, 2));

      // The Redis Graph result structure is different than expected
      // The data is an array of objects with named properties
      if (!result.data || result.data.length === 0) {
        console.error('Failed to create memory: No data returned');
        throw new Error('Failed to create memory node');
      }

      return newMemory;
    } catch (error) {
      console.error('Failed to create memory:', error);
      throw error;
    }
  }

  /**
   * Create a relationship between two memory nodes
   */
  async createRelation(relation: MemoryRelation): Promise<void> {
    const params = {
      fromId: relation.from,
      toId: relation.to,
      properties: relation.properties
        ? JSON.stringify(relation.properties)
        : '{}',
    };

    const query = `
      MATCH (a), (b)
      WHERE a.id = $fromId AND b.id = $toId
      CREATE (a)-[r:${relation.type} {properties: $properties}]->(b)
      RETURN r
    `;

    try {
      await this.graph.query(query, { params });
    } catch (error) {
      console.error('Failed to create relation:', error);
      throw error;
    }
  }

  /**
   * Get a memory node by ID
   */
  async getMemoryById(id: string): Promise<MemoryNode | null> {
    const query = `
      MATCH (n)
      WHERE n.id = $id
      RETURN n
    `;

    try {
      // console.log(`Retrieving memory with ID: ${id}`);
      const result = (await this.graph.query(query, {
        params: { id },
      })) as RedisGraphQueryResult;

      // Log the entire result structure for debugging
      // console.debug('Full Redis Graph query result structure:', JSON.stringify(result, null, 2));

      if (!result.data || result.data.length === 0) {
        // console.log(`No memory found with ID: ${id}`);
        return null;
      }

      // Log the first row structure
      // console.debug('First row structure:', JSON.stringify(result.data[0], null, 2));

      try {
        // The Redis Graph result structure has data as an array of objects
        const memory = this.parseNodeResult(result.data[0]);
        // console.debug('Parsed memory:', JSON.stringify(memory, null, 2));
        return memory;
      } catch (parseError: any) {
        console.error(`Error parsing node result for ID ${id}:`, parseError);
        console.error('Node data:', JSON.stringify(result.data[0], null, 2));
        throw new Error(`Failed to parse memory node: ${parseError.message}`);
      }
    } catch (error) {
      console.error('Failed to get memory by ID:', error);
      throw error;
    }
  }

  /**
   * Search for memory nodes based on criteria
   */
  async searchMemories(
    criteria: MemorySearchCriteria,
    options: MemoryQueryOptions = {},
  ): Promise<MemoryNode[]> {
    let whereClause = '';
    const params: Record<string, any> = {};

    if (criteria.type) {
      whereClause += 'n:' + criteria.type;
    }

    if (criteria.keyword) {
      whereClause += whereClause ? ' AND ' : '';

      // Check if fuzzy search is enabled (default to true if not specified)
      const useFuzzySearch = criteria.fuzzySearch !== false;

      if (useFuzzySearch) {
        // Implement fuzzy search by splitting the keyword into individual words
        const keywords = criteria.keyword
          .trim()
          .split(/\s+/)
          .filter((word) => word.length > 0);

        if (keywords.length > 0) {
          const keywordConditions: string[] = [];

          // Create a condition for each word
          keywords.forEach((word, index) => {
            const paramName = `keyword${index}`;
            // Convert to lowercase for case-insensitive matching
            params[paramName] = word.toLowerCase();

            // Use CONTAINS with toLower for case-insensitive matching
            keywordConditions.push(
              `toLower(n.content) CONTAINS $${paramName} OR toLower(n.title) CONTAINS $${paramName}`,
            );
          });

          // Also add a condition for the exact phrase for more precise matching
          if (keywords.length > 1) {
            params.exactPhrase = criteria.keyword.toLowerCase();
            keywordConditions.push(
              `toLower(n.content) CONTAINS $exactPhrase OR toLower(n.title) CONTAINS $exactPhrase`,
            );
          }

          // Combine all conditions with OR
          whereClause += `(${keywordConditions.join(' OR ')})`;
        } else {
          // Fallback to the original behavior if no valid keywords
          params.keyword = criteria.keyword.toLowerCase();
          whereClause += `(toLower(n.content) CONTAINS $keyword OR toLower(n.title) CONTAINS $keyword)`;
        }
      } else {
        // Use exact matching only (original behavior)
        params.keyword = criteria.keyword.toLowerCase();
        whereClause += `(toLower(n.content) CONTAINS $keyword OR toLower(n.title) CONTAINS $keyword)`;
      }
    }

    if (criteria.startDate) {
      params.startDate = criteria.startDate;
      whereClause += whereClause ? ' AND ' : '';
      whereClause += 'n.created >= $startDate';
    }

    if (criteria.endDate) {
      params.endDate = criteria.endDate;
      whereClause += whereClause ? ' AND ' : '';
      whereClause += 'n.created <= $endDate';
    }

    // Add metadata search capability
    if (criteria.metadata && Object.keys(criteria.metadata).length > 0) {
      whereClause += whereClause ? ' AND ' : '';

      const metadataConditions: string[] = [];
      Object.entries(criteria.metadata).forEach(([key, value], index) => {
        const metadataKeyParam = `metadataKey${index}`;
        const metadataValueParam = `metadataValue${index}`;

        params[metadataKeyParam] = key;
        params[metadataValueParam] =
          typeof value === 'string' ? value.toLowerCase() : value;

        if (typeof value === 'string') {
          metadataConditions.push(
            `(n.metadata_${key} IS NOT NULL AND toLower(n.metadata_${key}) CONTAINS $${metadataValueParam})`,
          );
        } else {
          metadataConditions.push(
            `(n.metadata_${key} IS NOT NULL AND n.metadata_${key} = $${metadataValueParam})`,
          );
        }
      });

      whereClause += `(${metadataConditions.join(' AND ')})`;
    }

    const whereStatement = whereClause ? `WHERE ${whereClause}` : '';

    // Handle ordering
    const orderBy = options.orderBy
      ? `ORDER BY n.${options.orderBy} ${options.direction || 'DESC'}`
      : 'ORDER BY n.created DESC';

    // Handle pagination
    const limit = options.limit ? `LIMIT ${options.limit}` : '';
    const offset = options.offset ? `SKIP ${options.offset}` : '';

    const query = `
      MATCH (n)
      ${whereStatement}
      RETURN n
      ${orderBy}
      ${offset}
      ${limit}
    `;

    // console.log('Executing search query:', query);
    // console.log('With parameters:', JSON.stringify(params, null, 2));

    try {
      const result = (await this.graph.query(query, {
        params,
      })) as RedisGraphQueryResult;

      // Log the search result for debugging
      // console.debug('Search memories result structure:', JSON.stringify(result, null, 2));

      if (!result.data) {
        // console.log('No data returned from search query');
        return [];
      }

      // console.log(`Found ${result.data.length} results in the search query`);

      const memories: MemoryNode[] = [];

      for (let i = 0; i < result.data.length; i++) {
        try {
          const row = result.data[i];
          // console.debug(`Processing result row ${i}:`, JSON.stringify(row, null, 2));

          const memory = this.parseNodeResult(row);

          // Verify the memory has an ID before adding it
          if (!memory.id) {
            // console.error(`Memory at index ${i} has no ID:`, JSON.stringify(memory, null, 2));
            continue;
          }

          memories.push(memory);
        } catch (parseError: any) {
          // console.warn(
          //   `Failed to parse memory node at index ${i} in search results: ${parseError.message}`,
          // );
          // Continue with other results
        }
      }

      // Apply relevance scoring and sorting if using keyword search
      if (criteria.keyword && criteria.keyword.trim() && memories.length > 0) {
        // Only apply relevance scoring if fuzzy search is enabled (default to true if not specified)
        const useFuzzySearch = criteria.fuzzySearch !== false;

        if (useFuzzySearch) {
          // Calculate relevance scores
          const scoredMemories = memories.map((memory) => ({
            memory,
            score: this.calculateRelevanceScore(memory, criteria),
          }));

          // console.log('Memory relevance scores:', scoredMemories.map(m =>
          //   `${m.memory.id}: ${m.score.toFixed(2)} - ${m.memory.title || m.memory.type}`
          // ));

          // Sort by relevance score (highest first)
          scoredMemories.sort((a, b) => b.score - a.score);

          // If topResults is specified, limit to that number of results
          // Default to 10 if not specified
          const topResultsLimit =
            criteria.topResults !== undefined ? criteria.topResults : 10;
          if (topResultsLimit > 0 && scoredMemories.length > topResultsLimit) {
            scoredMemories.splice(topResultsLimit);
          }

          // Replace memories array with sorted results
          memories.length = 0;
          scoredMemories.forEach((item) => memories.push(item.memory));
        }
      } else if (
        criteria.topResults &&
        criteria.topResults > 0 &&
        memories.length > criteria.topResults
      ) {
        // If not using fuzzy search but topResults is specified, just limit the number of results
        memories.splice(criteria.topResults);
      }

      // console.log(`Successfully parsed ${memories.length} memories from search results`);
      return memories;
    } catch (error) {
      // console.error('Failed to search memories:', error);
      throw error;
    }
  }

  /**
   * Get related memories for a given memory ID
   */
  async getRelatedMemories(
    id: string,
    relationType?: MemoryRelationType,
  ): Promise<MemoryNode[]> {
    let relationFilter = '';
    if (relationType) {
      relationFilter = `:${relationType}`;
    }

    const query = `
      MATCH (n)-[r${relationFilter}]->(related)
      WHERE n.id = $id
      RETURN related
    `;

    try {
      const result = (await this.graph.query(query, {
        params: { id },
      })) as RedisGraphQueryResult;

      // Log the related memories result for debugging
      // console.debug('Get related memories result:', JSON.stringify(result, null, 2));

      if (!result.data) {
        return [];
      }

      const relatedMemories: MemoryNode[] = [];

      for (const row of result.data) {
        try {
          const memory = this.parseNodeResult(row);
          relatedMemories.push(memory);
        } catch (parseError: any) {
          console.warn(
            `Failed to parse related memory node: ${parseError.message}`,
          );
          // Continue with other results
        }
      }

      return relatedMemories;
    } catch (error) {
      console.error('Failed to get related memories:', error);
      throw error;
    }
  }

  /**
   * Update a memory node
   */
  async updateMemory(
    id: string,
    updates: Partial<MemoryNode>,
  ): Promise<MemoryNode | null> {
    const memory = await this.getMemoryById(id);

    if (!memory) {
      return null;
    }

    const updatedMemory = {
      ...memory,
      ...updates,
      updated: Date.now(),
    };

    const params = {
      id,
      content: updatedMemory.content,
      updated: updatedMemory.updated,
      metadata: JSON.stringify(updatedMemory.metadata),
      ...this.extractSpecificProperties(updatedMemory),
    };

    const setStatements = Object.keys(params)
      .filter((key) => key !== 'id')
      .map((key) => `n.${key} = $${key}`)
      .join(', ');

    const query = `
      MATCH (n)
      WHERE n.id = $id
      SET ${setStatements}
      RETURN n
    `;

    try {
      await this.graph.query(query, { params });
      return updatedMemory;
    } catch (error) {
      console.error('Failed to update memory:', error);
      throw error;
    }
  }

  /**
   * Delete a memory node
   */
  async deleteMemory(id: string): Promise<boolean> {
    const query = `
      MATCH (n)
      WHERE n.id = $id
      DETACH DELETE n
      RETURN count(n) as deleted
    `;

    try {
      const result = (await this.graph.query(query, {
        params: { id },
      })) as RedisGraphQueryResult;

      // Log the delete result for debugging
      // console.debug('Delete memory result:', JSON.stringify(result, null, 2));

      // Check if the result has data and the deleted count
      if (!result.data || result.data.length === 0) {
        return false;
      }

      // The deleted count is in the first row, first column
      // It might be in a property called 'deleted' or directly as a value
      let deletedCount = 0;

      // Handle different result formats
      const firstRow = result.data[0];
      if (typeof firstRow === 'object' && firstRow !== null) {
        if ('deleted' in firstRow) {
          deletedCount = (firstRow as any).deleted;
        } else if (Array.isArray(firstRow) && firstRow.length > 0) {
          deletedCount = firstRow[0];
        }
      }

      return deletedCount > 0;
    } catch (error) {
      console.error('Failed to delete memory:', error);
      throw error;
    }
  }

  /**
   * Extract specific properties based on memory type
   */
  private extractSpecificProperties(memory: MemoryNode): Record<string, any> {
    const properties: Record<string, any> = {};

    // First, add common properties that should be included for all memory types
    // Note: title is now handled directly in createMemory, so we don't need to include it here

    switch (memory.type) {
      case MemoryNodeType.CONVERSATION:
        const conversationMemory = memory as any;
        if (conversationMemory.summary) {
          properties.summary = conversationMemory.summary;
        }
        break;

      case MemoryNodeType.PROJECT:
        const projectMemory = memory as any;
        if (projectMemory.name) {
          properties.name = projectMemory.name;
        }
        if (projectMemory.description) {
          properties.description = projectMemory.description;
        }
        if (projectMemory.status) {
          properties.status = projectMemory.status;
        }
        break;

      case MemoryNodeType.TASK:
        const taskMemory = memory as any;
        // Title is now handled in createMemory
        if (taskMemory.status) {
          properties.status = taskMemory.status;
        }
        if (taskMemory.dueDate) {
          properties.dueDate = taskMemory.dueDate;
        }
        break;

      case MemoryNodeType.ISSUE:
        const issueMemory = memory as any;
        // Title is now handled in createMemory
        if (issueMemory.severity) {
          properties.severity = issueMemory.severity;
        }
        if (issueMemory.status) {
          properties.status = issueMemory.status;
        }
        break;

      case MemoryNodeType.CONFIG:
        const configMemory = memory as any;
        if (configMemory.key) {
          properties.key = configMemory.key;
        }
        if (configMemory.value) {
          properties.value = configMemory.value;
        }
        if (configMemory.environment) {
          properties.environment = configMemory.environment;
        }
        break;

      case MemoryNodeType.FINANCE:
        const financeMemory = memory as any;
        if (financeMemory.category) {
          properties.category = financeMemory.category;
        }
        if (financeMemory.amount) {
          properties.amount = financeMemory.amount;
        }
        if (financeMemory.currency) {
          properties.currency = financeMemory.currency;
        }
        break;

      case MemoryNodeType.TODO:
        const todoMemory = memory as any;
        // Title is now handled in createMemory
        if (todoMemory.completed !== undefined) {
          properties.completed = todoMemory.completed;
        }
        if (todoMemory.priority) {
          properties.priority = todoMemory.priority;
        }
        break;
    }

    return properties;
  }

  /**
   * Build additional properties string for query
   */
  private buildAdditionalProperties(memory: MemoryNode): string {
    const properties = this.extractSpecificProperties(memory);

    if (Object.keys(properties).length === 0) {
      return '';
    }

    return (
      ', ' +
      Object.entries(properties)
        .map(([key, value]) => `${key}: $${key}`)
        .join(', ')
    );
  }

  /**
   * Parse node result from graph query
   */
  private parseNodeResult(node: any): MemoryNode {
    try {
      // Check if node is an array (Redis Graph sometimes returns arrays)
      // If it's an array, the first element should be the node
      const nodeData = Array.isArray(node) ? node[0] : node;

      // Handle case where node is nested under 'n' property (common in Redis Graph results)
      const nodeObject = nodeData.n || nodeData;

      // Extract properties - Redis Graph might nest them under a 'properties' field
      // or directly on the node object
      const properties = nodeObject.properties || nodeObject || {};

      // Log the node structure for debugging
      // console.debug('Node structure in parseNodeResult:', JSON.stringify(nodeData, null, 2));
      // console.debug('Properties extracted:', JSON.stringify(properties, null, 2));

      // Parse metadata safely
      let metadata = {};
      try {
        if (properties.metadata && typeof properties.metadata === 'string') {
          metadata = JSON.parse(properties.metadata);
        }
      } catch (error: any) {
        console.error('Error parsing metadata:', error);
        metadata = {};
      }

      // Ensure we have an ID
      if (!properties.id) {
        console.error('Missing ID in node properties:', properties);
      }

      return {
        id: properties.id,
        type: properties.type as MemoryNodeType,
        content: properties.content || '',
        created: properties.created || 0,
        updated: properties.updated || 0,
        metadata,
        // Add other properties if they exist
        ...(properties.name ? { name: properties.name } : {}),
        ...(properties.title ? { title: properties.title } : {}),
        ...(properties.description
          ? { description: properties.description }
          : {}),
        ...(properties.summary ? { summary: properties.summary } : {}),
        ...(properties.status ? { status: properties.status } : {}),
        ...(properties.severity ? { severity: properties.severity } : {}),
        ...(properties.key ? { key: properties.key } : {}),
        ...(properties.value ? { value: properties.value } : {}),
        ...(properties.environment
          ? { environment: properties.environment }
          : {}),
        ...(properties.category ? { category: properties.category } : {}),
        ...(properties.completed !== undefined
          ? { completed: properties.completed }
          : {}),
        ...(properties.priority ? { priority: properties.priority } : {}),
        ...(properties.dueDate ? { dueDate: properties.dueDate } : {}),
      };
    } catch (error: any) {
      console.error('Error parsing node result:', error);
      throw new Error(`Failed to parse node result: ${error.message}`);
    }
  }

  /**
   * Calculate relevance score for a memory based on search criteria
   * Higher score means more relevant
   */
  private calculateRelevanceScore(
    memory: MemoryNode,
    criteria: MemorySearchCriteria,
  ): number {
    let score = 0;

    if (criteria.keyword && criteria.keyword.trim()) {
      const keywords = criteria.keyword
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 0);
      const content = (memory.content || '').toLowerCase();
      const title = (memory.title || '').toLowerCase();

      // Score for exact phrase match (highest weight)
      if (keywords.length > 1) {
        const exactPhrase = criteria.keyword.toLowerCase();
        if (content.includes(exactPhrase)) score += 10;
        if (title.includes(exactPhrase)) score += 15; // Title matches are more important
      }

      // Score for individual word matches
      keywords.forEach((word) => {
        if (content.includes(word)) score += 3;
        if (title.includes(word)) score += 5; // Title matches are more important

        // Bonus for word at the beginning of content or title
        if (content.startsWith(word) || content.includes(` ${word}`))
          score += 1;
        if (title.startsWith(word) || title.includes(` ${word}`)) score += 2;
      });

      // Percentage of keywords found (completeness score)
      const contentMatchCount = keywords.filter((word) =>
        content.includes(word),
      ).length;
      const titleMatchCount = keywords.filter((word) =>
        title.includes(word),
      ).length;

      if (keywords.length > 0) {
        score += (contentMatchCount / keywords.length) * 5;
        score += (titleMatchCount / keywords.length) * 7;
      }
    }

    // Recency bonus (newer content is slightly more relevant)
    if (memory.created) {
      const ageInDays = (Date.now() - memory.created) / (1000 * 60 * 60 * 24);
      // Small bonus for newer content, max 2 points for content created today
      score += Math.max(0, 2 - ageInDays / 30); // Decay over 60 days
    }

    return score;
  }
}