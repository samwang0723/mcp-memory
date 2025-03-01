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
      
      console.log('Memory graph indices created successfully');
    } catch (error) {
      console.error('Failed to initialize memory graph:', error);
      throw error;
    }
  }

  /**
   * Create a new memory node
   */
  async createMemory(memory: Omit<MemoryNode, 'id' | 'created' | 'updated'>): Promise<MemoryNode> {
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
        ${this.buildAdditionalProperties(newMemory)}
      })
      RETURN n
    `;
    
    try {
      const result = await this.graph.query(query, { params }) as RedisGraphQueryResult;
      
      // Log the result for debugging
      console.debug('Create memory result:', JSON.stringify(result, null, 2));
      
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
      properties: relation.properties ? JSON.stringify(relation.properties) : '{}',
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
      const result = await this.graph.query(query, { params: { id } }) as RedisGraphQueryResult;
      
      // Log the entire result structure for debugging
      console.debug('Full Redis Graph query result:', JSON.stringify(result, null, 2));
      
      if (!result.data || result.data.length === 0) {
        console.log(`No memory found with ID: ${id}`);
        return null;
      }
      
      try {
        // The Redis Graph result structure has data as an array of objects
        return this.parseNodeResult(result.data[0]);
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
  async searchMemories(criteria: MemorySearchCriteria, options: MemoryQueryOptions = {}): Promise<MemoryNode[]> {
    let whereClause = '';
    const params: Record<string, any> = {};
    
    if (criteria.type) {
      whereClause += 'n:' + criteria.type;
    }
    
    if (criteria.keyword) {
      params.keyword = criteria.keyword;
      whereClause += whereClause ? ' AND ' : '';
      // Use CONTAINS instead of regex matching
      whereClause += '(n.content CONTAINS $keyword OR n.title CONTAINS $keyword)';
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
    
    const whereStatement = whereClause ? `WHERE ${whereClause}` : '';
    
    // Handle ordering
    const orderBy = options.orderBy ? `ORDER BY n.${options.orderBy} ${options.direction || 'DESC'}` : 'ORDER BY n.created DESC';
    
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
    
    try {
      const result = await this.graph.query(query, { params }) as RedisGraphQueryResult;
      
      // Log the search result for debugging
      console.debug('Search memories result:', JSON.stringify(result, null, 2));
      
      if (!result.data) {
        return [];
      }
      
      const memories: MemoryNode[] = [];
      
      for (const row of result.data) {
        try {
          const memory = this.parseNodeResult(row);
          memories.push(memory);
        } catch (parseError: any) {
          console.warn(`Failed to parse memory node in search results: ${parseError.message}`);
          // Continue with other results
        }
      }
      
      return memories;
    } catch (error) {
      console.error('Failed to search memories:', error);
      throw error;
    }
  }

  /**
   * Get related memories for a given memory ID
   */
  async getRelatedMemories(id: string, relationType?: MemoryRelationType): Promise<MemoryNode[]> {
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
      const result = await this.graph.query(query, { params: { id } }) as RedisGraphQueryResult;
      
      // Log the related memories result for debugging
      console.debug('Get related memories result:', JSON.stringify(result, null, 2));
      
      if (!result.data) {
        return [];
      }
      
      const relatedMemories: MemoryNode[] = [];
      
      for (const row of result.data) {
        try {
          const memory = this.parseNodeResult(row);
          relatedMemories.push(memory);
        } catch (parseError: any) {
          console.warn(`Failed to parse related memory node: ${parseError.message}`);
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
  async updateMemory(id: string, updates: Partial<MemoryNode>): Promise<MemoryNode | null> {
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
      .filter(key => key !== 'id')
      .map(key => `n.${key} = $${key}`)
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
      const result = await this.graph.query(query, { params: { id } }) as RedisGraphQueryResult;
      
      // Log the delete result for debugging
      console.debug('Delete memory result:', JSON.stringify(result, null, 2));
      
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
        if (taskMemory.title) {
          properties.title = taskMemory.title;
        }
        if (taskMemory.status) {
          properties.status = taskMemory.status;
        }
        if (taskMemory.dueDate) {
          properties.dueDate = taskMemory.dueDate;
        }
        break;
        
      case MemoryNodeType.ISSUE:
        const issueMemory = memory as any;
        if (issueMemory.title) {
          properties.title = issueMemory.title;
        }
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
        if (todoMemory.title) {
          properties.title = todoMemory.title;
        }
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
    
    return ', ' + Object.entries(properties)
      .map(([key, value]) => `${key}: $${key}`)
      .join(', ');
  }

  /**
   * Parse node result from graph query
   */
  private parseNodeResult(node: any): MemoryNode {
    try {
      const properties = node.properties || {};
      
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
        ...(properties.description ? { description: properties.description } : {}),
        ...(properties.summary ? { summary: properties.summary } : {}),
        ...(properties.status ? { status: properties.status } : {}),
        ...(properties.severity ? { severity: properties.severity } : {}),
        ...(properties.key ? { key: properties.key } : {}),
        ...(properties.value ? { value: properties.value } : {}),
        ...(properties.environment ? { environment: properties.environment } : {}),
        ...(properties.category ? { category: properties.category } : {}),
        ...(properties.completed !== undefined ? { completed: properties.completed } : {}),
        ...(properties.priority ? { priority: properties.priority } : {}),
        ...(properties.dueDate ? { dueDate: properties.dueDate } : {}),
      };
    } catch (error: any) {
      console.error('Error parsing node result:', error);
      throw new Error(`Failed to parse node result: ${error.message}`);
    }
  }
} 