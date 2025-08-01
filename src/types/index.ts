import { z } from 'zod';

// CLI Options Schema
export const CLIOptionsSchema = z.object({
  directory: z.string().min(1, 'Directory path is required'),
  output: z.string().min(1, 'Output path is required'),
  format: z.enum(['json', 'markdown']).default('markdown'),
  verbose: z.boolean().default(false),
  llmBaseUrl: z.string().min(1, 'LLM base URL is required'),
  llmApiKey: z.string().min(1, 'LLM API key is required'),
  llmModel: z.string().min(1, 'LLM model name is required'),
  llmMaxSteps: z.number().min(1).max(500).optional(),
});

export type CLIOptions = z.infer<typeof CLIOptionsSchema>;

// LLM Configuration Schema
export const LLMConfigSchema = z.object({
  baseUrl: z.string().min(1, 'Base URL is required'),
  apiKey: z.string().min(1, 'API key is required'),
  model: z.string().min(1, 'Model name is required'),
  maxSteps: z.number().min(1).max(500).default(20),
});

export type LLMConfig = z.infer<typeof LLMConfigSchema>;

// Business Rule Schema
export const BusinessRuleSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
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
``
export const llmObjectGeneratedSchema = z.object({
  rules: z.array(BusinessRuleSchema),
});
export type LlmObjectGenerated = z.infer<typeof llmObjectGeneratedSchema>;



// Analysis Result Schema
export const AnalysisResultSchema = z.object({
  analysisDate: z.string(),
  businessRules: z.array(BusinessRuleSchema),
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
