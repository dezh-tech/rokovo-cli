# Rokovo CLI

<p align="center">
  <img src="assets/logo.png" alt="Rokovo CLI Logo" width="300">
</p>

The Rokovo CLI brings a simple AI agent on your command line to help you with documenting pure source codes for both developers and end users.

## Quick Start

You can install the CLI using PIP:

```sh
pip install rokovo
```

To extract FAQs from your codebase, run the following command:

```sh
rokovo --context-dir ./context.md --root-dir ./path/to/project --api-key <your-openrouter-api-key>
```

>[!NOTE]
> If you wan to lookup more commands take a look at `rokovo --help`.

### Context file

Context file is a markdown file that contains a high level description of your project. This will help the AI agent to understand the project better and generate more accurate documentation. A basic model of writing a context file is as follows:

1. Project name and a brief description.
2. Project structure and important files.
3. Important keywords and terminologies.
4. A set of questions as example to help agent with finding questions and answers.

An example context file can be found on [examples_context.md](./examples_context.md).

## LLM

We use the OpenRouter API as default and you can use `--api-key` flag to pass your API key. If you are using another provider feel free to pass ``--base-url` and `--model` flags to configure your provider.

Any provider compatible with OpenAI API is accepted and you can use local models too.

## License

MIT License - see [LICENSE](./LICENSE).
