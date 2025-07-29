import { generateObject, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { 
  BusinessRule, 
  BusinessRuleSchema, 
  LLMAnalysisRequest, 
  LLMAnalysisError,
  BUSINESS_RULE_CATEGORIES 
} from '@/types';

// Schema for LLM response
const BusinessRuleExtractionSchema = z.object({
  rules: z.array(BusinessRuleSchema),
  summary: z.object({
    totalRules: z.number(),
    categories: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  }),
});

export interface LLMProcessorOptions {
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export class LLMProcessor {
  private readonly defaultOptions: Required<LLMProcessorOptions> = {
    temperature: 0.1, // Low temperature for consistent analysis
    maxTokens: 4000,
    timeout: 30000,
  };

  private readonly model = openai('gpt-4o-mini'); // Using a cost-effective model for analysis

  constructor(private options: LLMProcessorOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  async analyzeFile(request: LLMAnalysisRequest): Promise<BusinessRule[]> {
    try {
      const prompt = this.buildAnalysisPrompt(request);
      
      const result = await generateObject({
        model: this.model,
        schema: BusinessRuleExtractionSchema,
        prompt,
        temperature: this.options.temperature,
        maxTokens: this.options.maxTokens,
      });

      // Add source information to each rule
      const rulesWithSource = result.object.rules.map(rule => ({
        ...rule,
        source: {
          file: request.filePath,
          startLine: rule.source.startLine,
          endLine: rule.source.endLine,
        },
      }));

      return rulesWithSource;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new LLMAnalysisError(`Failed to analyze file: ${message}`, {
        filePath: request.filePath,
        language: request.language,
        error: message,
      });
    }
  }

  async batchAnalyze(requests: LLMAnalysisRequest[]): Promise<BusinessRule[]> {
    const batchSize = 5; // Process files in batches to avoid rate limits
    const allRules: BusinessRule[] = [];

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      
      const batchPromises = batch.map(request => 
        this.analyzeFile(request).catch(error => {
          console.warn(`Failed to analyze ${request.filePath}: ${error.message}`);
          return []; // Return empty array for failed analyses
        })
      );

      const batchResults = await Promise.all(batchPromises);
      allRules.push(...batchResults.flat());

      // Add delay between batches to respect rate limits
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return allRules;
  }

  private buildAnalysisPrompt(request: LLMAnalysisRequest): string {
    const categories = BUSINESS_RULE_CATEGORIES.join(', ');
    
    return `You are an expert code analyst specializing in extracting business rules and logic from source code for customer support knowledge bases.

TASK: Analyze the following ${request.language} code and extract business rules that would be useful for customer support teams.

FOCUS ON:
- User-facing features and constraints
- Business logic that affects user experience
- Validation rules and limits
- Authentication and authorization rules
- Payment and transaction rules
- Data processing constraints
- API limitations and behaviors
- Error conditions and handling
- Workflow rules and processes

IGNORE:
- Pure technical implementation details
- Internal code structure
- Development-specific configurations
- Database schema details (unless user-facing)

FILE CONTEXT:
- File: ${request.filePath}
- Language: ${request.language}
- Project: ${request.context.projectName || 'Unknown'}
- File Type: ${request.context.fileType}

AVAILABLE CATEGORIES: ${categories}

CODE TO ANALYZE:
\`\`\`${request.language.toLowerCase()}
${request.fileContent}
\`\`\`

INSTRUCTIONS:
1. Extract business rules that customer support would need to know
2. Write descriptions in plain language (avoid technical jargon)
3. Categorize each rule appropriately
4. Set priority based on customer impact (high/medium/low)
5. Mark rules as user-facing if they directly affect user experience
6. Include line numbers when possible for traceability
7. Generate unique IDs for each rule

RESPONSE FORMAT:
Return a JSON object with:
- rules: Array of business rules
- summary: Object with totalRules, categories used, and confidence score

Each rule should have:
- id: Unique identifier
- title: Brief, clear title
- description: Plain language explanation
- category: One of the available categories
- priority: high/medium/low based on customer impact
- source: Object with file path and line numbers
- tags: Array of relevant tags
- userFacing: Boolean indicating if rule directly affects users

Focus on extracting 3-10 meaningful business rules per file. Quality over quantity.`;
  }

  async generateSummary(rules: BusinessRule[]): Promise<string> {
    if (rules.length === 0) {
      return 'No business rules were extracted from the analyzed codebase.';
    }

    const prompt = `Generate a concise summary of the following business rules extracted from a codebase. 
This summary will be used by customer support teams to understand the application's key constraints and features.

BUSINESS RULES:
${rules.map(rule => `- ${rule.title}: ${rule.description}`).join('\n')}

REQUIREMENTS:
- Write in plain language suitable for customer support
- Highlight the most important user-facing rules
- Group similar rules together
- Keep it concise but informative
- Focus on what customer support needs to know

Generate a 2-3 paragraph summary:`;

    try {
      const result = await generateText({
        model: this.model,
        prompt,
        temperature: 0.3,
        maxTokens: 500,
      });

      return result.text;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new LLMAnalysisError(`Failed to generate summary: ${message}`, {
        rulesCount: rules.length,
        error: message,
      });
    }
  }

  async categorizeRules(rules: BusinessRule[]): Promise<Record<string, BusinessRule[]>> {
    const categorized: Record<string, BusinessRule[]> = {};

    for (const rule of rules) {
      if (!categorized[rule.category]) {
        categorized[rule.category] = [];
      }
      categorized[rule.category].push(rule);
    }

    // Sort categories by number of rules (descending)
    const sortedCategories = Object.keys(categorized).sort(
      (a, b) => categorized[b].length - categorized[a].length
    );

    const result: Record<string, BusinessRule[]> = {};
    for (const category of sortedCategories) {
      result[category] = categorized[category].sort((a, b) => {
        // Sort by priority: high > medium > low
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
    }

    return result;
  }

  // Utility methods
  static validateApiKey(): boolean {
    return !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
  }

  static getRequiredEnvironmentVariables(): string[] {
    return ['OPENAI_API_KEY or ANTHROPIC_API_KEY'];
  }
}
