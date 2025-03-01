import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Graph } from 'redis';
import { z } from 'zod';
import { MemoryService } from '../services/memory-service';
import { MemoryNodeType, MemoryRelationType } from '../models/memory';

// Initialize memory service
let memoryService: MemoryService;

/**
 * Initialize the memory tools with the Redis graph
 */
export function initializeMemoryTools(graph: Graph): MemoryService {
  memoryService = new MemoryService(graph);
  return memoryService;
}

/**
 * Register all memory-related tools with the MCP server
 */
export function registerMemoryTools(server: McpServer, graph: Graph) {
  // Initialize memory service if not already done
  if (!memoryService) {
    memoryService = initializeMemoryTools(graph);
  }
  
  // Register all tools
  registerCreateMemoryTool(server);
  registerRetrieveMemoryTool(server);
  registerSearchMemoriesTool(server);
  registerUpdateMemoryTool(server);
  registerDeleteMemoryTool(server);
  registerCreateRelationTool(server);
  registerGetRelatedMemoriesTool(server);
}

/**
 * Tool to create a new memory
 */
function registerCreateMemoryTool(server: McpServer) {
  server.tool(
    'create_memory',
    {
      type: z.enum([
        MemoryNodeType.CONVERSATION,
        MemoryNodeType.TOPIC,
        MemoryNodeType.PROJECT,
        MemoryNodeType.TASK,
        MemoryNodeType.ISSUE,
        MemoryNodeType.CONFIG,
        MemoryNodeType.FINANCE,
        MemoryNodeType.TODO,
      ]).describe('The type of memory to create'),
      content: z.string().describe('The content of the memory'),
      title: z.string().optional().describe('Title for the memory'),
      metadata: z.record(z.any()).optional().describe('Additional metadata for the memory'),
    },
    async (params, extra) => {
      try {
        const { type, content, title, metadata } = params;
        
        const memory = await memoryService.createMemory({
          type,
          content,
          title,
          metadata: metadata || {},
        });
        
        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully created ${type} memory with ID: ${memory.id}`,
            }
          ],
          memory,
        };
      } catch (error) {
        console.error('Error creating memory:', error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to create memory: ${(error as Error).message}`,
            }
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Tool to retrieve a memory by ID
 */
function registerRetrieveMemoryTool(server: McpServer) {
  server.tool(
    'retrieve_memory',
    {
      id: z.string().describe('The ID of the memory to retrieve'),
    },
    async ({ id }, extra) => {
      try {
        const memory = await memoryService.getMemoryById(id);
        
        if (!memory) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Memory not found with ID: ${id}`,
              }
            ],
            isError: true,
          };
        }
        
        return {
          content: [
            {
              type: "text" as const,
              text: `Retrieved memory of type ${memory.type}`,
            }
          ],
          memory,
        };
      } catch (error) {
        console.error('Error retrieving memory:', error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to retrieve memory: ${(error as Error).message}`,
            }
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Tool to search for memories
 */
function registerSearchMemoriesTool(server: McpServer) {
  server.tool(
    'search_memories',
    {
      type: z.enum([
        MemoryNodeType.CONVERSATION,
        MemoryNodeType.TOPIC,
        MemoryNodeType.PROJECT,
        MemoryNodeType.TASK,
        MemoryNodeType.ISSUE,
        MemoryNodeType.CONFIG,
        MemoryNodeType.FINANCE,
        MemoryNodeType.TODO,
      ]).optional().describe('Filter by memory type'),
      keyword: z.string().optional().describe('Search keyword in content or title'),
    },
    async (params, extra) => {
      try {
        const { type, keyword } = params;
        
        const criteria = {
          type,
          keyword,
        };
        
        // Always use these defaults
        const options = {
          limit: 10,
          orderBy: 'created',
          direction: 'DESC' as const,
        };
        
        const memories = await memoryService.searchMemories(criteria, options);
        
        const responseContent = [
          {
            type: "text" as const,
            text: `Found ${memories.length} memories`,
          }
        ];
        
        // Add summary of each memory
        memories.forEach(memory => {
          responseContent.push({
            type: "text" as const,
            text: `- ${memory.type}: ${(memory as any).title || (memory as any).name || memory.content.substring(0, 50)}... (ID: ${memory.id})`,
          });
        });
        
        return {
          content: responseContent,
          memories,
          count: memories.length,
        };
      } catch (error) {
        console.error('Error searching memories:', error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to search memories: ${(error as Error).message}`,
            }
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Tool to update a memory
 */
function registerUpdateMemoryTool(server: McpServer) {
  server.tool(
    'update_memory',
    {
      id: z.string().describe('The ID of the memory to update'),
      content: z.string().optional().describe('Updated content'),
      title: z.string().optional().describe('Updated title'),
      status: z.string().optional().describe('Status of the memory'),
      dueDate: z.number().optional().describe('Due date timestamp'),
      metadata: z.record(z.any()).optional().describe('Updated metadata'),
    },
    async (params, extra) => {
      try {
        const { id, ...updates } = params;
        
        const updatedMemory = await memoryService.updateMemory(id, updates);
        
        if (!updatedMemory) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Memory not found with ID: ${id}`,
              }
            ],
            isError: true,
          };
        }
        
        return {
          content: [
            {
              type: "text" as const,
              text: `Memory updated successfully with ID: ${id}`,
            }
          ],
          memory: updatedMemory,
        };
      } catch (error) {
        console.error('Error updating memory:', error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to update memory: ${(error as Error).message}`,
            }
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Tool to delete a memory
 */
function registerDeleteMemoryTool(server: McpServer) {
  server.tool(
    'delete_memory',
    {
      id: z.string().describe('The ID of the memory to delete'),
    },
    async ({ id }, extra) => {
      try {
        const deleted = await memoryService.deleteMemory(id);
        
        if (!deleted) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Memory not found or could not be deleted with ID: ${id}`,
              }
            ],
            isError: true,
          };
        }
        
        return {
          content: [
            {
              type: "text" as const,
              text: `Memory deleted successfully with ID: ${id}`,
            }
          ],
        };
      } catch (error) {
        console.error('Error deleting memory:', error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to delete memory: ${(error as Error).message}`,
            }
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Tool to create a relationship between memories
 */
function registerCreateRelationTool(server: McpServer) {
  server.tool(
    'create_relation',
    {
      fromId: z.string().describe('The ID of the source memory'),
      toId: z.string().describe('The ID of the target memory'),
      type: z.enum([
        MemoryRelationType.CONTAINS,
        MemoryRelationType.RELATED_TO,
        MemoryRelationType.DEPENDS_ON,
        MemoryRelationType.PART_OF,
        MemoryRelationType.RESOLVED_BY,
        MemoryRelationType.CREATED_AT,
        MemoryRelationType.UPDATED_AT,
      ]).describe('The type of relationship'),
      properties: z.record(z.any()).optional().describe('Additional properties for the relationship'),
    },
    async ({ fromId, toId, type, properties }, extra) => {
      try {
        await memoryService.createRelation({
          from: fromId,
          to: toId,
          type,
          properties,
        });
        
        return {
          content: [
            {
              type: "text" as const,
              text: `Relationship created successfully from ${fromId} to ${toId} with type ${type}`,
            }
          ],
        };
      } catch (error) {
        console.error('Error creating relationship:', error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to create relationship: ${(error as Error).message}`,
            }
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Tool to get related memories
 */
function registerGetRelatedMemoriesTool(server: McpServer) {
  server.tool(
    'get_related_memories',
    {
      id: z.string().describe('The ID of the memory to find relations for'),
      relationType: z.enum([
        MemoryRelationType.CONTAINS,
        MemoryRelationType.RELATED_TO,
        MemoryRelationType.DEPENDS_ON,
        MemoryRelationType.PART_OF,
        MemoryRelationType.RESOLVED_BY,
        MemoryRelationType.CREATED_AT,
        MemoryRelationType.UPDATED_AT,
      ]).optional().describe('Filter by relationship type'),
    },
    async ({ id, relationType }, extra) => {
      try {
        const relatedMemories = await memoryService.getRelatedMemories(id, relationType);
        
        const responseContent = [
          {
            type: "text" as const,
            text: `Found ${relatedMemories.length} related memories for ID: ${id}`,
          }
        ];
        
        // Add summary of each related memory
        relatedMemories.forEach(memory => {
          responseContent.push({
            type: "text" as const,
            text: `- ${memory.type}: ${(memory as any).title || (memory as any).name || memory.content.substring(0, 50)}... (ID: ${memory.id})`,
          });
        });
        
        return {
          content: responseContent,
          memories: relatedMemories,
          count: relatedMemories.length,
        };
      } catch (error) {
        console.error('Error getting related memories:', error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to get related memories: ${(error as Error).message}`,
            }
          ],
          isError: true,
        };
      }
    }
  );
} 