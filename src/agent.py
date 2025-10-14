import hashlib
from pathlib import Path

from jinja2 import Template
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain.schema import Document
from langchain.tools.retriever import create_retriever_tool
from langchain_chroma import Chroma
from langchain_community.agent_toolkits import FileManagementToolkit
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_openai import ChatOpenAI
from xdg_base_dirs import xdg_data_home

toolkit = FileManagementToolkit(selected_tools=["read_file", "write_file"])


def _gitignore_to_excludes(root_dir: str) -> list[str]:
    ignore_path = Path(root_dir) / ".rokovoignore"
    if not ignore_path.exists():
        ignore_path = Path(root_dir) / ".gitignore"

    if not ignore_path.exists():
        # Sensible defaults if no .gitignore found
        return [
            # VCS
            "**/.git/**",
            # Language / Dependency Folders
            "**/node_modules/**",  # JavaScript dependencies
            "**/packages/**",
            "**/venv/**",  # Python virtual environments
            "**/.venv/**",
            "**/__pycache__/**",  # Python bytecode cache
            "**/target/**",  # Java/Maven build
            "**/dist/**",  # JS build output
            "**/build/**",  # generic build output
            "**/out/**",
            "**/bin/**",
            "**/obj/**",
            "**/.terraform/**",  # Terraform modules
            "**/vendor/**",  # vendored dependencies
            # Compiled / Generated Files
            "**/*.class",  # Java classes
            "**/*.o",
            "**/*.obj",  # C/C++ object files
            "**/*.pyc",  # Python bytecode
            "**/*.so",
            "**/*.dll",  # Shared libraries or DLLs
            # Documentation / Reports / Coverage
            "**/coverage/**",
            "**/reports/**",
            "**/*.log",  # Log files
            "**/*.tmp",
            "**/*.cache",  # Temporary and cache files
            "**/*.lock",  # Lock files
            # Environment & Secret Files
            "**/.env",
            "**/.env.*",  # Env files
            "**/secrets.*",  # Sensitive files
            "**/*.pem",
            "**/*.key",  # Key files
            # System-Level & OS Files
            "**/.DS_Store",  # macOS
            "**/Thumbs.db",  # Windows
            "**/ehthumbs.db",
            "**/Desktop.ini",
            # IDE / Editor / Workspace Configs
            "**/.idea/**",  # IntelliJ
            "**/.vscode/**",  # VS Code
            "**/.vs/**",  # Visual Studio
            "**/*.suo",
            "*.user",
            "*.sln",
            "*.csproj",  # .NET related
            # Miscellaneous
            "**/coverage.xml",
            # Common binary / media files
            "**/*.png",
            "**/*.jpg",
            "**/*.jpeg",
            "**/*.gif",
            "**/*.svg",
            "**/*.ico",
            "**/*.pdf",
            "**/*.zip",
            "**/*.tar",
            "**/*.gz",
            "**/*.bz2",
            "**/*.7z",
            "**/*.rar",
            "**/*.mp3",
            "**/*.mp4",
            "**/*.mov",
            "**/*.avi",
            "**/*.webm",
            "**/*.ogg",
            "**/*.wasm",
            "**/*.exe",
            "**/*.dylib",
            "**/*.ttf",
            "**/*.otf",
        ]

    patterns: list[str] = []
    for raw in ignore_path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        # Ignore negation rules for now
        if line.startswith("!"):
            continue

        p = line
        # Root-anchored -> make relative
        if p.startswith("/"):
            p = p.lstrip("/")

        # Directory entries end with '/'
        if p.endswith("/"):
            p = p.rstrip("/")
            if p:
                patterns.append(f"**/{p}/**")
                patterns.append(f"**/{p}")
            continue

        # File or path patterns
        if p.startswith("*"):
            # e.g. *.log -> **/*.log
            patterns.append(f"**/{p}")
        else:
            # Include as match-anywhere
            patterns.append(f"**/{p}")

    # De-duplicate
    seen = set()
    deduped: list[str] = []
    for pat in patterns:
        if pat not in seen:
            seen.add(pat)
            deduped.append(pat)
    return deduped


def extract_faq(
    root_dir: str = ".",
    model: str = "openai/gpt-4.1",
    temperature: float = 0.5,
    base_url: str = "https://openrouter.ai/api/v1",
    api_key: str = None,
    context: str = "",
    re_index: bool = False,
):
    llm = ChatOpenAI(
        model=model,
        temperature=temperature,
        base_url=base_url,
        api_key=api_key,
    )

    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )

    excludes = _gitignore_to_excludes(root_dir)

    loader = DirectoryLoader(
        root_dir,
        glob="**/*.*",
        loader_cls=TextLoader,
        exclude=excludes,
        recursive=True,
        silent_errors=False,
        loader_kwargs={"autodetect_encoding": True},
    )
    docs = loader.load()

    enhanced_docs = []
    for doc in docs:
        path = Path(doc.metadata.get("source", ""))
        language = path.suffix.lstrip(".") or "unknown"
        rel_source = str(Path(root_dir).resolve().joinpath(path).resolve()) if path else ""
        new_content = f"language: {language}\nfile_name: {path.name}\n\n{doc.page_content}"
        enhanced_docs.append(
            Document(
                page_content=new_content,
                metadata={"source": rel_source or path.name, "language": language},
            )
        )

    # Create a separate Chroma collection per codebase (by absolute path hash)
    persist_dir = str(xdg_data_home() / "rokovo" / "chroma_db")
    repo_abs = str(Path(root_dir).resolve())
    repo_hash = hashlib.sha1(repo_abs.encode("utf-8")).hexdigest()[:12]
    collection_name = f"code_{Path(root_dir).resolve().name}_{repo_hash}"

    try:
        import chromadb

        client = chromadb.PersistentClient(path=persist_dir)
        if re_index:
            try:
                client.delete_collection(collection_name)
            except Exception:
                pass
            vector_store = Chroma.from_documents(
                documents=enhanced_docs,
                embedding=embeddings,
                persist_directory=persist_dir,
                collection_name=collection_name,
            )
        else:
            existing_collections = {c.name for c in client.list_collections()}
            if collection_name in existing_collections:
                # Open existing without re-adding docs
                vector_store = Chroma(
                    collection_name=collection_name,
                    embedding_function=embeddings,
                    persist_directory=persist_dir,
                )
            else:
                vector_store = Chroma.from_documents(
                    documents=enhanced_docs,
                    embedding=embeddings,
                    persist_directory=persist_dir,
                    collection_name=collection_name,
                )
    except Exception:
        # Fallback: always (re)create the collection
        vector_store = Chroma.from_documents(
            documents=enhanced_docs,
            embedding=embeddings,
            persist_directory=persist_dir,
            collection_name=collection_name,
        )

    retriever = vector_store.as_retriever(search_kwargs={"k": 20})
    code_search_tool = create_retriever_tool(
        retriever,
        name="codebase_search",
        description=(
            "Search the codebase to find relevant files and code snippets. "
            "Use this before answering questions about the repository."
        ),
    )

    tools = [
        code_search_tool,
        *toolkit.get_tools(),
    ]

    template_path = Path(__file__).parent / "prompts" / "faq_system.j2"
    faq_sys_prompt = ""
    with open(template_path, encoding="utf-8") as file:
        faq_sys_prompt = file.read()

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                faq_sys_prompt,
            ),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
            # This placeholder is required for tool-calling agents to track intermediate steps
            MessagesPlaceholder("agent_scratchpad"),
        ]
    )

    # Create the tool-calling agent and wrap it in an AgentExecutor
    agent = create_tool_calling_agent(llm=llm, tools=tools, prompt=prompt)
    agent_executor = AgentExecutor(
        agent=agent, tools=tools, verbose=True, handle_parsing_errors=True
    )

    faq_user_prompt = ""
    template_path = Path(__file__).parent / "prompts" / "faq_user.j2"
    with open(template_path, encoding="utf-8") as file:
        faq_user_prompt = file.read()

    template = Template(faq_user_prompt)

    # Run the agent with a concrete instruction
    return agent_executor.invoke(
        {
            "input": (template.render(context=context)),
            "chat_history": [],
        }
    )


def call_agent(
    root_dir: str = ".",
    model: str = "openai/gpt-4.1",
    temperature: float = 0.5,
    base_url: str = "https://openrouter.ai/api/v1",
    api_key: str = None,
    context: str = "",
    re_index: bool = False,
    user_query: str = "What is this code base about?",
):
    llm = ChatOpenAI(
        model=model,
        temperature=temperature,
        base_url=base_url,
        api_key=api_key,
    )

    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )

    excludes = _gitignore_to_excludes(root_dir)

    loader = DirectoryLoader(
        root_dir,
        glob="**/*.*",
        loader_cls=TextLoader,
        exclude=excludes,
        recursive=True,
        silent_errors=True,
        loader_kwargs={"autodetect_encoding": True},
    )
    docs = loader.load()

    enhanced_docs = []
    for doc in docs:
        path = Path(doc.metadata.get("source", ""))
        language = path.suffix.lstrip(".") or "unknown"
        rel_source = str(Path(root_dir).resolve().joinpath(path).resolve()) if path else ""
        new_content = f"language: {language}\nfile_name: {path.name}\n\n{doc.page_content}"
        enhanced_docs.append(
            Document(
                page_content=new_content,
                metadata={"source": rel_source or path.name, "language": language},
            )
        )

    persist_dir = str(xdg_data_home() / "rokovo" / "chroma_db")
    repo_abs = str(Path(root_dir).resolve())
    repo_hash = hashlib.sha1(repo_abs.encode("utf-8")).hexdigest()[:12]
    collection_name = f"code_{Path(root_dir).resolve().name}_{repo_hash}"

    try:
        import chromadb

        client = chromadb.PersistentClient(path=persist_dir)
        if re_index:
            try:
                client.delete_collection(collection_name)
            except Exception:
                pass
            vector_store = Chroma.from_documents(
                documents=enhanced_docs,
                embedding=embeddings,
                persist_directory=persist_dir,
                collection_name=collection_name,
            )
        else:
            existing_collections = {c.name for c in client.list_collections()}
            if collection_name in existing_collections:
                vector_store = Chroma(
                    collection_name=collection_name,
                    embedding_function=embeddings,
                    persist_directory=persist_dir,
                )
            else:
                vector_store = Chroma.from_documents(
                    documents=enhanced_docs,
                    embedding=embeddings,
                    persist_directory=persist_dir,
                    collection_name=collection_name,
                )
    except Exception:
        vector_store = Chroma.from_documents(
            documents=enhanced_docs,
            embedding=embeddings,
            persist_directory=persist_dir,
            collection_name=collection_name,
        )

    retriever = vector_store.as_retriever(search_kwargs={"k": 20})
    code_search_tool = create_retriever_tool(
        retriever,
        name="codebase_search",
        description=(
            "Search the codebase to find relevant files and code snippets. "
            "Use this before answering questions about the repository."
        ),
    )

    tools = [
        code_search_tool,
    ]

    template_path = Path(__file__).parent / "prompts" / "interactive_qa.j2"
    faq_sys_prompt = ""
    with open(template_path, encoding="utf-8") as file:
        faq_sys_prompt = file.read()

    template = Template(faq_sys_prompt)

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                template.render(context=context),
            ),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder("agent_scratchpad"),
        ]
    )

    # Create the tool-calling agent and wrap it in an AgentExecutor
    agent = create_tool_calling_agent(llm=llm, tools=tools, prompt=prompt)
    agent_executor = AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=False,
        handle_parsing_errors=True,
    )

    return agent_executor.invoke(
        {
            "input": (user_query),
            "chat_history": [],
        },
        config={"callbacks": []},
    )
