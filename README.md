# Rokovo CLI

Rokovo CLI is a powerful tool developed by [Rokovo](https://Rokovo.io) that helps teams extract business flow and logic documentation from their codebase. It's specifically designed to create comprehensive knowledge base documentation that helps support teams understand the business rules embedded in the code.
<p align="center">
  <img src="assets/logo.png" alt="Rokovo CLI Logo" width="300">
</p>
## Quick Start

```bash
npm install -g rokovo-cli
rokovo analyze --directory ./my-project --output ./docs.md \
  --llm-base-url https://api.openai.com/v1 \
  --llm-api-key your-api-key-here \
  --llm-model gpt-4o-mini
```

## Key Features

- **2-Phase Sequential Analysis**: Uses AI SDK's sequential generations pattern for comprehensive rule extraction
  - **Repository Discovery**: Identifies files containing customer-facing business logic using MCP filesystem tools
  - **Rule Extraction & Documentation**: Extracts and documents rules in customer-support-friendly language

## Basic Usage

```bash
rokovo analyze \
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

## License

MIT License - see LICENSE file for details.

## Support

Visit [Rokovo](https://Rokovo.io) for support or create an issue on GitHub.
