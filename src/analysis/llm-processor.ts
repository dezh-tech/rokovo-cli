import { generateText, LanguageModelV1, ToolSet } from 'ai';
import { BusinessRule, LLMAnalysisError, LLMConfig, LLMConfigSchema } from '../types';
import { createOpenAICompatible, OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import { LangfuseExporter } from 'langfuse-vercel';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

export class LLMProcessor {
  private provider: OpenAICompatibleProvider;
  private model: LanguageModelV1;
  private config: LLMConfig;
  private exporter: LangfuseExporter;
  private sdk: NodeSDK;

  constructor(llmConfig: LLMConfig) {
    // Load environment variables from .env file
    require('dotenv').config();

    // Initialize Langfuse exporter with debug enabled for troubleshooting
    // Use environment variables loaded from .env file
    this.exporter = new LangfuseExporter({
      secretKey: 'sk-lf-ff0b250e-70c4-4268-9fb4-ef84d73a99a6',
      publicKey: 'pk-lf-20e4c065-a45b-4f57-aa2b-cb626ca48ba4',
      baseUrl: 'https://cloud.langfuse.com',
      flushAt: 1,
      flushInterval: 1000,
      // debug: true // Enable debug logging to troubleshoot issues
    });

    console.log('Langfuse exporter initialized:', process.env.LANGFUSE_PUBLIC_KEY);

    // Initialize OpenTelemetry SDK
    this.sdk = new NodeSDK({
      traceExporter: this.exporter,
      instrumentations: [getNodeAutoInstrumentations()],
    });

    // Start the SDK
    this.sdk.start();
    console.log('OpenTelemetry SDK started with Langfuse exporter');
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
      throw new LLMAnalysisError(
        'Invalid base URL format. Please provide a valid URL (e.g., https://api.openai.com/v1)',
        {
          baseUrl: this.config.baseUrl,
        }
      );
    }

    this.provider = createOpenAICompatible({
      name: 'Khodkar-cli',
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl,
    });
    this.model = this.provider(this.config.model);
  }

  async analyze(toolSet: ToolSet): Promise<string> {
    try {
      // Phase 1: Repository Discovery - Identify files containing business logic
      const repositoryDiscoveryResult = await generateText({
        model: this.model,
        system: this.getRepositoryDiscoveryPrompt(),
        prompt: 'start',
        toolChoice: 'auto',
        tools: toolSet,
        maxSteps: this.config.maxSteps,
        stopSequences: ['[REPOSITORY_DISCOVERY_COMPLETE]'],
        experimental_telemetry: {
          isEnabled: true,
          functionId: 'khodkar-business-rules-repository-discovery',
        },
      });

      console.log('Phase 1 (Repository Discovery) completed');
      console.log(repositoryDiscoveryResult.text);

      try {
        await this.exporter.forceFlush();
        console.log('Successfully flushed traces to Langfuse');
      } catch (flushError) {
        console.warn('Failed to flush traces to Langfuse:', flushError);
      }

      // Phase 2: Rule Extraction - Extract business rules from identified files
      const ruleExtractionResult = await generateText({
        model: this.model,
        system: this.getRuleExtractionPrompt(),
        prompt: `Based on the repository discovery results:
${repositoryDiscoveryResult.text}

Now proceed to extract business rules from the identified files.`,
        toolChoice: 'auto',
        tools: toolSet,
        maxSteps: this.config.maxSteps,
        stopSequences: ['[RULE_EXTRACTION_COMPLETE]'],
        experimental_telemetry: {
          isEnabled: true,
          functionId: 'khodkar-business-rules-rule-extraction',
        },
      });

      console.log('Phase 2 (Rule Extraction) completed');
      console.log(ruleExtractionResult.text);

      try {
        await this.exporter.forceFlush();
        console.log('Successfully flushed traces to Langfuse');
      } catch (flushError) {
        console.warn('Failed to flush traces to Langfuse:', flushError);
      }

      // Phase 3: Documentation Synthesis - Combine extracted rules into coherent documentation
      const documentationSynthesisResult = await generateText({
        model: this.model,
        system: this.getDocumentationSynthesisPrompt(),
        prompt: `Based on the rule extraction results:
${ruleExtractionResult.text}

Now synthesize all extracted rules into a coherent customer support guide.`,
        maxSteps: this.config.maxSteps,
        toolChoice: 'auto',
        tools: toolSet,
        stopSequences: ['[DOCUMENTATION_SYNTHESIS_COMPLETE]'],
        experimental_telemetry: {
          isEnabled: true,
          functionId: 'khodkar-business-rules-documentation-synthesis',
        },
      });

      console.log('Phase 3 (Documentation Synthesis) completed');

      console.log(documentationSynthesisResult.text);

      // Force flush the traces to Langfuse
      try {
        await this.exporter.forceFlush();
        console.log('Successfully flushed traces to Langfuse');
      } catch (flushError) {
        console.warn('Failed to flush traces to Langfuse:', flushError);
      }

      return documentationSynthesisResult.text;
    } catch (error) {
      if (error instanceof LLMAnalysisError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown error during LLM analysis';
      throw new LLMAnalysisError(`LLM analysis failed: ${message}`, {
        originalError: error,
        config: this.config,
      });
    }
  }

  /**
   * Cleanup method to properly shutdown the OpenTelemetry SDK and flush remaining traces
   */
  async cleanup(): Promise<void> {
    try {
      console.log('Shutting down OpenTelemetry SDK...');

      // Force flush any remaining traces
      await this.exporter.forceFlush();

      // Shutdown the SDK
      await this.sdk.shutdown();

      console.log('OpenTelemetry SDK shutdown complete');
    } catch (error) {
      console.warn('Error during OpenTelemetry SDK shutdown:', error);
    }
  }

  /**
   * Phase 1: Repository Discovery
   * Identifies files in the repository that likely contain business logic rules
   */
  getRepositoryDiscoveryPrompt() {
    return `
You are a customer support documentation specialist identifying files that contain user-facing business rules and workflows.

DISCOVERY STRATEGY:
1. Use list_directory and search_files to explore the repository systematically
2. Focus on files that contain customer-impacting business logic
3. Prioritize files with user workflows, validation rules, and business constraints
4. Use minimal read_text_file calls only to verify customer relevance

TARGET FILES - Look for files containing:
- User authentication and authorization flows
- Input validation and business rule enforcement  
- API endpoints that customers interact with
- Payment processing and billing logic
- User account management and permissions
- Data processing workflows that affect users
- Error handling and user feedback mechanisms
- Feature flags and business configuration
- Workflow orchestration and state management

CUSTOMER SUPPORT RELEVANCE - Prioritize files that help answer:
- "Why can't a user do X?"
- "What are the limits/restrictions for Y?"
- "How does feature Z work?"
- "What happens when a user does A?"
- "Why did the system behave this way?"

SELECTION CRITERIA:
- Choose 10-15 files maximum that are most relevant to customer support
- Focus on files with business logic that customers directly experience
- Avoid internal tooling, build scripts, or pure technical infrastructure
- Prioritize recently modified files in core user-facing modules

OUTPUT: List each selected file with its customer support relevance:
1. path/to/file.ext - How this file helps answer customer questions

End with "[REPOSITORY_DISCOVERY_COMPLETE]"`;
  }

  /**
   * Phase 2: Rule Extraction
   * Extracts business rules from the files identified in Phase 1
   */
  getRuleExtractionPrompt() {
    return `
You are a customer support documentation expert creating a comprehensive knowledge base from code analysis.

OBJECTIVE: Extract business rules and workflows that customer support agents need to understand user issues and system behavior.

ANALYSIS APPROACH:
1. Read each identified file using read_text_file
2. Extract rules that directly impact customer experience
3. Focus on user-facing behaviors, limitations, and workflows
4. Document in a format that helps support agents answer customer questions

FOR EACH BUSINESS RULE/WORKFLOW, CREATE A SUPPORT-FRIENDLY ENTRY:

**Rule Title**: Clear, searchable name (e.g., "Email Validation Requirements", "Payment Processing Limits")

**What It Does**: Plain English explanation of the rule's purpose and behavior

**Customer Impact**: How this affects users and what they experience

**Common Questions**: Typical customer questions this rule addresses

**Troubleshooting**: How to help customers when this rule causes issues

**Examples**: 
- ✅ What works: Concrete examples of valid scenarios
- ❌ What fails: Common failure cases and error messages

**Edge Cases**: Special situations or exceptions support should know about

**Related Features**: How this connects to other system behaviors

WRITING GUIDELINES:
- Use simple, non-technical language
- Focus on customer-facing behaviors, not implementation details
- Include specific error messages customers might see
- Provide actionable guidance for support agents
- Use bullet points and clear structure for easy scanning
- Make each entry searchable with relevant keywords

ORGANIZATION:
Group related rules under clear categories:
- User Account Management
- Authentication & Security
- Data Validation & Input Rules
- Payment & Billing Logic
- Feature Access & Permissions
- Workflow & Process Rules
- Error Handling & Recovery

End with "[RULE_EXTRACTION_COMPLETE]"`;
  }

  /**
   * Phase 3: Documentation Synthesis
   * Combines all extracted rules into a coherent customer support guide
   */
  getDocumentationSynthesisPrompt() {
    return `
You are creating the definitive customer support knowledge base document. This will be used by support agents to quickly find answers to customer questions.

DOCUMENT STRUCTURE:

# Customer Support Knowledge Base

## Quick Reference Guide
Create a searchable index of common customer issues with direct links to relevant sections.

## User Account Management
Rules about account creation, profile updates, permissions, etc.

## Authentication & Security  
Login requirements, password rules, security restrictions, etc.

## Data Validation & Input Rules
What data is accepted/rejected, format requirements, validation errors, etc.

## Payment & Billing Logic
Payment processing rules, billing cycles, refund policies, etc.

## Feature Access & Permissions
Who can access what, feature limitations, upgrade requirements, etc.

## Workflow & Process Rules
Step-by-step processes, state transitions, approval workflows, etc.

## Error Handling & Recovery
Common errors, what they mean, how to resolve them, etc.

## Troubleshooting Quick Fixes
Fast solutions for frequent customer issues.

FORMATTING REQUIREMENTS:

For each rule entry, use this exact format:

### [Rule Name]

**What it does:** Brief explanation in plain English

**Customer impact:** How users experience this rule

**Common questions:**
- "Why can't I...?"
- "What does this error mean?"
- "How do I...?"

**Troubleshooting steps:**
1. First thing to check
2. Next step if that doesn't work
3. When to escalate

**Examples:**
- ✅ **Works:** Specific valid example
- ❌ **Fails:** Common failure with exact error message

**Keywords:** searchable terms, error codes, feature names

---

WRITING STYLE:
- Use active voice and present tense
- Include exact error messages in quotes
- Provide step-by-step instructions
- Use consistent formatting throughout
- Make it scannable with clear headings
- Include relevant keywords for searchability

FINAL OUTPUT: A complete, well-organized Markdown document that serves as a comprehensive customer support reference guide.

End with "[DOCUMENTATION_SYNTHESIS_COMPLETE]"`;
  }
}
