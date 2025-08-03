# Khodkar CLI

Khodkar CLI is a powerful tool developed by [khodkar.dezh.tech](https://khodkar.dezh.tech) that helps teams extract business flow and logic documentation from their codebase. It's specifically designed to create comprehensive knowledge base documentation that helps support teams understand the business rules embedded in the code.
<p align="center">
  <img src="assets/logo.png" alt="Khodkar CLI Logo" width="300">
</p>
## Quick Start

```bash
npm install -g khodkar-cli
khodkar analyze --directory ./my-project --output ./docs.md \
  --llm-base-url https://api.openai.com/v1 \
  --llm-api-key your-api-key-here \
  --llm-model gpt-4
```

## Key Features

- **2-Phase Sequential Analysis**: Uses AI SDK's sequential generations pattern for comprehensive rule extraction
  - **Repository Discovery**: Identifies files containing customer-facing business logic using MCP filesystem tools
  - **Rule Extraction & Documentation**: Extracts and documents rules in customer-support-friendly language
- **Model Context Protocol (MCP) Integration**: Leverages MCP servers for advanced file system operations and analysis
- Supports multiple programming languages and frameworks
- Generates documentation in Markdown format optimized for customer support teams
- Uses advanced LLM technology with configurable providers (OpenAI, Anthropic, OpenAI-compatible)
- Real-time progress tracking with phase-by-phase updates
- **Built-in Langfuse OpenTelemetry integration** for comprehensive LLM observability and tracing
- Organizes rules into 5 key categories: User Management, Authentication, Business Logic, Security Rules, and Workflow Rules

## How It Works: 2-Phase Sequential Analysis

Khodkar CLI uses a sophisticated 2-phase sequential processing approach powered by the AI SDK's sequential generations pattern and Model Context Protocol (MCP) integration:

### Phase 1: Repository Discovery
- **Purpose**: Identifies files containing customer-facing business logic
- **Tools**: Uses MCP filesystem server with `list_directory`, `search_files`, and `read_text_file` tools
- **Focus**: Files that help answer support questions like "Why can't a user do X?" or "What are the limits for Y?"
- **Strategy**: Systematic exploration prioritizing user workflows, validation rules, controllers, and business constraints
- **Output**: Curated list of relevant files with customer support relevance

### Phase 2: Rule Extraction & Documentation
- **Purpose**: Extracts business rules and creates comprehensive documentation in one integrated step
- **Process**: Reads identified files and transforms code logic into customer-support-friendly documentation
- **Format**: Structured Markdown with sections for rule descriptions, customer impact, troubleshooting steps, and examples
- **Output**: Complete customer support knowledge base document

This sequential approach ensures comprehensive coverage while maintaining focus on customer-support-relevant information, with each phase building upon the previous phase's output.

## Basic Usage

```bash
khodkar analyze \
  --directory ./my-project \
  --output ./business-rules.md \
  --llm-base-url https://api.openai.com/v1 \
  --llm-api-key your-api-key-here \
  --llm-model gpt-4o-mini
```

## Model Recommendations

Choosing the right LLM model is crucial for balancing cost, performance, and quality in business rule extraction:

### Recommended: gpt-4o-mini
- **Best for**: Most users seeking cost-effective analysis with solid performance
- **Strengths**: Excellent cost-to-performance ratio, good at understanding business logic patterns
- **Use case**: Regular business rule extraction, documentation generation, medium to large codebases
- **Cost**: ~90% less expensive than GPT-4 while maintaining high quality output

### Alternative Providers
```bash
# Anthropic Claude (excellent for code analysis)
--llm-base-url https://api.anthropic.com \
--llm-model claude-3-sonnet-20240229

# OpenAI-compatible providers (e.g., local models, other services)
--llm-base-url https://your-provider.com/v1 \
--llm-model your-model-name
```

**💡 Tip**: Start with `gpt-4o-mini` for most projects. It provides excellent results at a fraction of the cost, making it ideal for regular use and experimentation.

## Langfuse Integration

Khodkar CLI includes built-in Langfuse OpenTelemetry integration for comprehensive LLM observability and tracing. All LLM calls are automatically traced and sent to your Langfuse dashboard.

### Configuration

You can configure Langfuse using environment variables:

```bash
export LANGFUSE_SECRET_KEY=sk-lf-your-secret-key
export LANGFUSE_PUBLIC_KEY=pk-lf-your-public-key
export LANGFUSE_BASEURL=https://cloud.langfuse.com
```

Or copy `.env.example` to `.env` and fill in your credentials.

### Features

- ✅ **Phase-specific tracing**: Separate traces for Repository Discovery and Rule Extraction phases
- ✅ **Sequential workflow monitoring**: Track how each phase builds upon the previous phase's output
- ✅ Automatic trace collection for all LLM calls
- ✅ Debug logging for troubleshooting
- ✅ Proper trace flushing and cleanup between phases
- ✅ Custom metadata and function IDs for each processing phase
- ✅ Error tracking and performance monitoring

## Documentation

- **[Architecture Guide](./ARCHITECTURE.md)**: Detailed explanation of the 2-phase sequential processing architecture
- **[AI SDK Sequential Generations](https://ai-sdk.dev/docs/advanced/sequential-generations)**: Official AI SDK documentation on sequential processing patterns

## License

MIT License - see LICENSE file for details.

## Support

Visit [khodkar.dezh.tech](https://khodkar.dezh.tech) for support or create an issue on GitHub.
