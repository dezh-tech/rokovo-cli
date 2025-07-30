import { generateObject, generateText, LanguageModelV1 } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import {
  BusinessRule,
  BusinessRuleSchema,
  LLMAnalysisRequest,
  LLMAnalysisError,
  BUSINESS_RULE_CATEGORIES,
  LLMConfig,
  LLMConfigSchema,
} from '../types';
import { createOpenAICompatible, OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';

// Schema for LLM response
const BusinessRuleExtractionSchema = z.object({
  rules: z.array(BusinessRuleSchema),
  summary: z.object({
    totalRules: z.number(),
    categories: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  }),
});

export class LLMProcessor {
  private provider: OpenAICompatibleProvider;
  private model: LanguageModelV1;
  private config: LLMConfig;

  constructor(llmConfig: LLMConfig) {
    // Validate configuration
    try {
      this.config = LLMConfigSchema.parse(llmConfig);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid LLM configuration';
      throw new LLMAnalysisError(`LLM Configuration Error: ${message}`, { config: llmConfig });
    }

    // Validate base URL format
    try {
      new URL(this.config.baseUrl);
    } catch {
      throw new LLMAnalysisError('Invalid base URL format. Please provide a valid URL (e.g., https://api.openai.com/v1)', {
        baseUrl: this.config.baseUrl
      });
    }

    this.provider = createOpenAICompatible({
      name: 'Khodkar-cli',
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl,
    });
    this.model = this.provider(this.config.model);
  }

  async analyzeFile(request: LLMAnalysisRequest): Promise<BusinessRule[]> {
    try {
      const prompt = this.buildAnalysisPrompt(request);

      const result = await generateObject({
        model: this.model,
        schema: BusinessRuleExtractionSchema,
        prompt,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
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

    return `You are an expert business analyst specializing in translating technical code into customer support knowledge. Your job is to extract business rules from code and explain them in completely non-technical language that customer support representatives can understand and use to help customers effectively.

CRITICAL REQUIREMENT: Write ALL business rules in plain English that a non-technical customer support representative can understand. Avoid ALL technical terminology, function names, variable names, class names, or code-specific references.

Analyze the ${request.language} code and extract business rules that customer support teams need to know to help customers effectively.

Analyze Rules: Look beyond surface-level code to understand:
- Business logic and decision-making processes
- User interaction patterns and workflows
- Data validation and business constraints
- Error handling and user feedback mechanisms
- Security and access control implications
- Integration points and external dependencies

Code to user-friendly language examples:
- Instead of "validateUserCredentials() function" → "User passwords must meet security requirements"
- Instead of "API rate limiting" → "Users can only make a certain number of requests per hour"
- Instead of "database constraint" → "System requirement" or "Business rule"
- Instead of "authentication middleware" → "Login verification process"
- Instead of "validation error" → "System prevents this action because..."
- Instead of "enum values" → "Available options are..."
- Instead of "boolean flag" → "Setting that can be turned on or off"

Focus on:
- What users can and cannot do in the system
- Limits and restrictions that affect user experience
- Required information users must provide
- Steps users must follow to complete actions
- Conditions that must be met for features to work
- Error situations users might encounter and why
- Business processes and workflows users experience
- Account and access requirements

Available categories: ${categories}
- User Management: Rules about user accounts, profiles, roles, and permissions
- Authentication: Rules about logging in, passwords, and account security
- Business Logic: Core business processes, calculations, and operational rules
- Security Rules: Safety measures and restrictions to protect users and data
- Workflow Rules: Step-by-step processes users must follow

File content:
- File: ${request.filePath}
- Language: ${request.language}
- Project: ${request.context.projectName || 'Unknown'}

Code to analyze:
\`\`\`${request.language.toLowerCase()}
${request.fileContent}
\`\`\`

Writing Rules:
1. Write each rule as if explaining to a customer support representative who has never seen code
2. Focus on the "what" and "why" from a user's perspective, not the "how" from a technical perspective
3. Explain the business impact or user experience, not the implementation
4. Use active voice and clear, simple sentences
5. If you must reference a technical concept, translate it to business terms

Example transformations:

❌ "The validateEmail() method checks if the email format matches the regex pattern"
✅ "User email addresses must be in the correct format (like user@company.com) before account creation is allowed"

❌ "The user.role === 'admin' condition grants elevated privileges"
✅ "Only users with administrator privileges can access advanced system features"

❌ "The API returns a 429 status code when rate limit is exceeded"
✅ "Users who make too many requests in a short time will be temporarily blocked to ensure system performance"

❌ "The payment.amount > maxLimit throws ValidationError"
✅ "Payments cannot exceed the maximum allowed amount set for each account type"

❌ "JWT token expires after 24 hours"
✅ "Users must log in again after 24 hours for security reasons"

❌ "Database transaction rollback on constraint violation"
✅ "If required information is missing, the system will not save changes and will ask users to complete all required fields"

CONTEXT ANALYSIS TIPS:
- Look for conditional statements (if/else) → These often represent business rules
- Examine validation logic → These define what users can/cannot do
- Check error handling → These explain what happens when things go wrong
- Review loops and iterations → These might indicate batch processing or limits
- Analyze data transformations → These show how user input is processed
- Study configuration values → These often represent business constraints

Response format FORMAT:
Return a JSON object with:
- rules: Array of business rules written in customer support friendly language
- summary: Object with totalRules, categories used, and confidence score (0.0-1.0)

Each rule should have:
- id: Unique identifier (use descriptive names like "email-validation-rule")
- title: Brief, clear title in plain English (max 80 characters)
- description: Complete explanation in non-technical language that customer support can use (2-4 sentences)
- category: One of the 5 available categories (${categories})
- priority: high/medium/low based on how often customers might encounter this
- source: Object with file path and line numbers where the rule was found
- tags: Array of business-relevant tags (no technical terms, focus on user actions/features)
- userFacing: Boolean indicating if rule directly affects customer experience

Quality Guidelines:
- Focus on rules that help customer support understand what customers can do, what they cannot do, and why
- Prioritize rules that customers are likely to encounter or ask about
- Ensure each rule provides actionable information for customer support
- Include edge cases and error conditions that customers might experience
- Consider the business impact and user experience implications of each rule

CONFIDENCE SCORING:
- 0.9-1.0: Very clear business rules with obvious customer impact
- 0.7-0.8: Clear rules but may require some interpretation
- 0.5-0.6: Moderate confidence, some technical complexity
- Below 0.5: Low confidence, mostly technical implementation details`;
  }

  async generateSummary(rules: BusinessRule[]): Promise<string> {
    if (rules.length === 0) {
      return 'No business rules were extracted from the analyzed codebase.';
    }

    const prompt = `Create a customer support summary of the following business rules extracted from an application.
This summary will be used by customer support representatives to understand what customers can and cannot do in the system.

BUSINESS RULES:
${rules.map(rule => `- ${rule.title}: ${rule.description}`).join('\n')}

WRITING REQUIREMENTS:
- Use completely non-technical language that any customer support representative can understand
- Avoid all technical terms, function names, or code references
- Focus on customer experience and what users encounter
- Group related rules together logically
- Highlight the most important restrictions and capabilities customers should know about
- Write as if explaining the system to someone who will help customers use it
- Keep it practical and actionable for customer support scenarios

Generate a 2-3 paragraph summary that helps customer support understand the key things customers can do, cannot do, and need to know about this system:`;

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
}
