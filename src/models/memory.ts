/**
 * Memory types and interfaces for Redis Graph implementation
 */

// Memory node types
export enum MemoryNodeType {
  CONVERSATION = 'Conversation',
  TOPIC = 'Topic',
  PROJECT = 'Project',
  TASK = 'Task',
  ISSUE = 'Issue',
  CONFIG = 'Config',
  FINANCE = 'Finance',
  TODO = 'Todo',
}

// Memory relationship types
export enum MemoryRelationType {
  CONTAINS = 'CONTAINS',
  RELATED_TO = 'RELATED_TO',
  DEPENDS_ON = 'DEPENDS_ON',
  PART_OF = 'PART_OF',
  RESOLVED_BY = 'RESOLVED_BY',
  CREATED_AT = 'CREATED_AT',
  UPDATED_AT = 'UPDATED_AT',
}

// Base interface for all memory nodes
export interface MemoryNode {
  id: string;
  type: MemoryNodeType;
  content: string;
  created: number; // timestamp
  updated: number; // timestamp
  metadata: Record<string, any>;
  
  // Common optional properties for all memory types
  name?: string;
  title?: string;
  description?: string;
  summary?: string;
  status?: string;
  severity?: string;
  key?: string;
  value?: string;
  environment?: string;
  category?: string;
  completed?: boolean;
  priority?: string;
  dueDate?: number;
}

// Conversation memory
export interface ConversationMemory extends MemoryNode {
  type: MemoryNodeType.CONVERSATION;
  summary: string;
}

// Project memory
export interface ProjectMemory extends MemoryNode {
  type: MemoryNodeType.PROJECT;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'archived';
}

// Task memory
export interface TaskMemory extends MemoryNode {
  type: MemoryNodeType.TASK;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: number; // timestamp
}

// Issue memory
export interface IssueMemory extends MemoryNode {
  type: MemoryNodeType.ISSUE;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved';
}

// Config memory
export interface ConfigMemory extends MemoryNode {
  type: MemoryNodeType.CONFIG;
  key: string;
  value: string;
  environment: string;
}

// Finance memory
export interface FinanceMemory extends MemoryNode {
  type: MemoryNodeType.FINANCE;
  category: string;
  amount?: number;
  currency?: string;
}

// Todo memory
export interface TodoMemory extends MemoryNode {
  type: MemoryNodeType.TODO;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
}

// Memory relationship
export interface MemoryRelation {
  from: string; // source node id
  to: string; // target node id
  type: MemoryRelationType;
  properties?: Record<string, any>;
}

// Memory query options
export interface MemoryQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  direction?: 'ASC' | 'DESC';
}

// Memory search criteria
export interface MemorySearchCriteria {
  type?: MemoryNodeType;
  keyword?: string;
  startDate?: number;
  endDate?: number;
  metadata?: Record<string, any>;
} 