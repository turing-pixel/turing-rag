# Ollama Embedding Models

RAG Web UI supports two recommended Ollama embedding models via `OLLAMA_EMBEDDINGS_MODEL`:

| Model | Dimensions | Size | Best for |
| ----- | ---------- | ---- | -------- |
| `bge-m3` | 1024 | ~1.2GB | Multilingual and Chinese retrieval (default) |
| `nomic-embed-text` | 768 | ~274MB | Low resource usage, fast indexing |

## Setup

```bash
# Install one or both
ollama pull bge-m3
ollama pull nomic-embed-text
```

## Configuration

```env
EMBEDDINGS_PROVIDER=ollama
OLLAMA_API_BASE=http://localhost:11434
OLLAMA_EMBEDDINGS_MODEL=bge-m3
# OLLAMA_EMBEDDINGS_MODEL=nomic-embed-text
```

Use `http://host.docker.internal:11434` when the backend runs in Docker and Ollama runs on the host.

## Switching models

Embedding dimensions differ between models. After changing `OLLAMA_EMBEDDINGS_MODEL`, **re-process all documents** in affected knowledge bases (or recreate the knowledge base).

## Verify

```bash
curl http://localhost:11434/api/embeddings -d '{"model":"bge-m3","prompt":"test"}'
```
