from typing import Optional

import typer

import agent

app = typer.Typer(help="Rokovo CLI - A modern Python CLI template.")


@app.command("faq")
def faq(
    root_dir: str = typer.Option(
        ".", "--root-dir", "-r", help="Root directory of the codebase to scan"
    ),
    context_dir: str = typer.Option(
        None, "--context-dir", help="Directory of markdown context file"
    ),
    model: str = typer.Option("openai/gpt-4.1", "--model", help="LLM model identifier"),
    temperature: float = typer.Option(0.5, "--temperature", "-t", help="Sampling temperature"),
    base_url: str = typer.Option(
        "https://openrouter.ai/api/v1", "--base-url", help="Base URL for the LLM API"
    ),
    api_key: Optional[str] = typer.Option(
        None, "--api-key", help="API key for the LLM provider", envvar="OPENROUTER_API_KEY"
    ),
) -> None:
    """Extracts a list of FAQs from your code base."""
    if context_dir is None:
        raise Exception("Please provide a context file using --context-dir flag.")
    context = ""
    with open(context_dir) as file:
        context = file.read()

    agent.extract_faq(
        root_dir=root_dir,
        model=model,
        temperature=temperature,
        base_url=base_url,
        api_key=api_key,
        context=context,
    )


def main() -> None:
    """Entry point for console_scripts."""
    app()


if __name__ == "__main__":
    main()
