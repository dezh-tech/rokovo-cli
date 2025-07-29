import { z } from 'zod';

// CLI Options Schema
export const CLIOptionsSchema = z.object({
  directory: z.string().min(1, 'Directory path is required'),
  output: z.string().min(1, 'Output path is required'),
  format: z.enum(['json', 'markdown']).default('markdown'),
  verbose: z.boolean().default(false),
});

export type CLIOptions = z.infer<typeof CLIOptionsSchema>;

// File Types for Analysis
export const SupportedFileExtensions = [
  '.ts', '.tsx', '.js', '.jsx',
  '.py', '.java', '.cs', '.cpp', '.c',
  '.go', '.rs', '.rb', '.php',
  '.swift', '.kt', '.scala', '.clj'
] as const;

export type SupportedFileExtension = typeof SupportedFileExtensions[number];

// Business Rule Schema
export const BusinessRuleSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  source: z.object({
    file: z.string(),
    startLine: z.number().optional(),
    endLine: z.number().optional(),
  }),
  tags: z.array(z.string()).default([]),
  userFacing: z.boolean().default(true),
});

export type BusinessRule = z.infer<typeof BusinessRuleSchema>;

// Analysis Result Schema
export const AnalysisResultSchema = z.object({
  applicationName: z.string(),
  analysisDate: z.string(),
  totalFilesAnalyzed: z.number(),
  businessRules: z.array(BusinessRuleSchema),
  categories: z.array(z.string()),
  summary: z.object({
    totalRules: z.number(),
    highPriorityRules: z.number(),
    userFacingRules: z.number(),
  }),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

// File Analysis Schema
export const FileAnalysisSchema = z.object({
  filePath: z.string(),
  fileType: z.string(),
  language: z.string(),
  size: z.number(),
  lastModified: z.string(),
  businessRules: z.array(BusinessRuleSchema),
  analysisStatus: z.enum(['pending', 'analyzing', 'completed', 'failed']),
  error: z.string().optional(),
});

export type FileAnalysis = z.infer<typeof FileAnalysisSchema>;

// Progress Information
export const ProgressInfoSchema = z.object({
  currentFile: z.string(),
  filesProcessed: z.number(),
  totalFiles: z.number(),
  currentPhase: z.enum(['scanning', 'analyzing', 'formatting', 'complete']),
  estimatedTimeRemaining: z.number().optional(),
});

export type ProgressInfo = z.infer<typeof ProgressInfoSchema>;

// MCP Server Configuration
export const MCPServerConfigSchema = z.object({
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional(),
  enabled: z.boolean().default(true),
});

export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;

// LLM Analysis Request
export const LLMAnalysisRequestSchema = z.object({
  filePath: z.string(),
  fileContent: z.string(),
  language: z.string(),
  context: z.object({
    projectName: z.string().optional(),
    fileType: z.string(),
    relatedFiles: z.array(z.string()).default([]),
  }),
});

export type LLMAnalysisRequest = z.infer<typeof LLMAnalysisRequestSchema>;

// Output Format Schemas
export const MarkdownOutputSchema = z.object({
  format: z.literal('markdown'),
  content: z.string(),
});

export const JSONOutputSchema = z.object({
  format: z.literal('json'),
  content: z.string(),
});

export const OutputSchema = z.union([MarkdownOutputSchema, JSONOutputSchema]);
export type Output = z.infer<typeof OutputSchema>;

// Error Types
export class KhodkarError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'KhodkarError';
  }
}

export class FileSystemError extends KhodkarError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'FILESYSTEM_ERROR', details);
    this.name = 'FileSystemError';
  }
}

export class LLMAnalysisError extends KhodkarError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'LLM_ANALYSIS_ERROR', details);
    this.name = 'LLMAnalysisError';
  }
}

export class MCPServerError extends KhodkarError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'MCP_SERVER_ERROR', details);
    this.name = 'MCPServerError';
  }
}

// Constants
export const DEFAULT_IGNORE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  'coverage/**',
  '*.min.js',
  '*.map',
  '.env*',
  '*.log',
] as const;

export const BUSINESS_RULE_CATEGORIES = [
  'User Management',
  'Authentication',
  'Authorization',
  'Payment Processing',
  'Data Validation',
  'Business Logic',
  'API Constraints',
  'Security Rules',
  'Workflow Rules',
  'Integration Rules',
] as const;

export type BusinessRuleCategory = typeof BUSINESS_RULE_CATEGORIES[number];
