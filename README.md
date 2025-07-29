# Khodkar CLI

A TypeScript CLI application that extracts business rules and logic from codebases for customer support knowledge bases.

## Overview

Khodkar CLI is a simple, focused tool that scans code and outputs business rules in plain language for customer support teams. It uses LLM analysis to identify user-facing features, constraints, and business logic that customer support representatives need to understand.

## Features

- **Multi-language Support**: Analyzes TypeScript, JavaScript, Python, Java, C#, Go, Rust, and more
- **LLM-Powered Analysis**: Uses advanced language models to extract meaningful business rules
- **Multiple Output Formats**: Supports JSON and Markdown output formats
- **MCP Integration**: Leverages Model Context Protocol servers for enhanced functionality
- **Progress Tracking**: Real-time progress indicators and detailed logging
- **Customer Support Focus**: Outputs are optimized for non-technical customer support teams

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- An OpenAI API key or Anthropic API key

### Install from npm (when published)

```bash
npm install -g khodkar-cli
```

### Install from source

```bash
git clone <repository-url>
cd khodkar-cli
npm install
npm run build
npm link
```

## Configuration

Set your API key as an environment variable:

```bash
# For OpenAI
export OPENAI_API_KEY="your-api-key-here"

# Or for Anthropic
export ANTHROPIC_API_KEY="your-api-key-here"
```

## Usage

### Basic Analysis

```bash
khodkar analyze --directory ./my-project --output ./business-rules.md
```

### Advanced Options

```bash
khodkar analyze \
  --directory ./my-project \
  --output ./rules.json \
  --format json \
  --verbose
```

### Validate Environment

```bash
khodkar validate
```

## Command Reference

### `analyze`

Analyze a codebase and extract business rules.

**Options:**
- `-d, --directory <path>` - Target codebase directory to analyze (required)
- `-o, --output <path>` - Output file path for extracted business rules (required)
- `-f, --format <format>` - Output format: `json` or `markdown` (default: `markdown`)
- `-v, --verbose` - Enable detailed progress logging

**Example:**
```bash
khodkar analyze -d ./src -o ./business-rules.md -f markdown -v
```

### `validate`

Validate environment and dependencies.

**Example:**
```bash
khodkar validate
```

## Output Formats

### Markdown Format

The default markdown format creates a customer support-friendly document:

```markdown
# Business Rules for My Application

## Analysis Summary
- **Analysis Date:** 2024-01-15
- **Total Files Analyzed:** 25
- **Total Business Rules:** 42
- **High Priority Rules:** 8
- **User-Facing Rules:** 35

## User Management
### 🔴 Email Validation Required
Users must provide valid email addresses during registration...

### 🟡 Password Requirements
Passwords must be at least 8 characters with special characters...
```

### JSON Format

The JSON format provides structured data for programmatic use:

```json
{
  "applicationName": "My Application",
  "analysisDate": "2024-01-15T10:30:00.000Z",
  "totalFilesAnalyzed": 25,
  "businessRules": [
    {
      "id": "rule-001",
      "title": "Email Validation Required",
      "description": "Users must provide valid email addresses...",
      "category": "User Management",
      "priority": "high",
      "userFacing": true,
      "source": {
        "file": "src/auth/validation.ts",
        "startLine": 15,
        "endLine": 25
      },
      "tags": ["validation", "email", "registration"]
    }
  ]
}
```

## Supported File Types

- **TypeScript**: `.ts`, `.tsx`
- **JavaScript**: `.js`, `.jsx`
- **Python**: `.py`
- **Java**: `.java`
- **C#**: `.cs`
- **C/C++**: `.c`, `.cpp`
- **Go**: `.go`
- **Rust**: `.rs`
- **Ruby**: `.rb`
- **PHP**: `.php`
- **Swift**: `.swift`
- **Kotlin**: `.kt`
- **Scala**: `.scala`
- **Clojure**: `.clj`

## Business Rule Categories

The tool automatically categorizes extracted rules into:

- User Management
- Authentication
- Authorization
- Payment Processing
- Data Validation
- Business Logic
- API Constraints
- Security Rules
- Workflow Rules
- Integration Rules

## Development

### Setup

```bash
git clone <repository-url>
cd khodkar-cli
npm install
```

### Development Commands

```bash
# Run in development mode
npm run dev -- analyze -d ./example -o ./output.md

# Build the project
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Project Structure

```
src/
├── analysis/          # LLM processing and analysis logic
├── cli/              # CLI commands and interface
├── mcp/              # Model Context Protocol integration
├── types/            # TypeScript type definitions
├── utils/            # Utility functions and helpers
└── index.ts          # Main entry point
```

## Troubleshooting

### Common Issues

1. **API Key Not Found**
   ```
   Error: LLM API Key: Missing
   ```
   Solution: Set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` environment variable.

2. **MCP Server Connection Failed**
   ```
   Warning: Failed to connect to filesystem MCP server
   ```
   Solution: Ensure MCP server dependencies are installed correctly.

3. **File Access Denied**
   ```
   File system error: Cannot access directory
   ```
   Solution: Check directory permissions and path validity.

### Debug Mode

Run with verbose logging to see detailed information:

```bash
khodkar analyze -d ./src -o ./output.md --verbose
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section above
- Review the command reference for proper usage
