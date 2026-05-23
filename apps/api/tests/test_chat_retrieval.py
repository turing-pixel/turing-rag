"""Unit tests for multi-KB retrieval merge."""

import asyncio

from langchain_core.documents import Document

from app.services.chat_retrieval import (
    RETRIEVAL_SCORE_METADATA_KEY,
    _doc_dedupe_key,
    retrieve_from_knowledge_bases,
    stream_retrieve_from_knowledge_bases,
)

KB_A = "01KBAAAAAAAAAAAAAAAAAAAAAAAA"
KB_B = "01KBBBBBBBBBBBBBBBBBBBBBBBBB"


class _FakeRetriever:
    def __init__(self, docs):
        self._docs = docs

    async def ainvoke(self, _query: str):
        return self._docs


class _FakeStore:
    def __init__(self, docs):
        self._docs = docs

    def as_retriever(self, **kwargs):
        return _FakeRetriever(self._docs)


class _FakeScoredStore:
    def __init__(self, scored_docs):
        self._scored_docs = scored_docs

    def similarity_search_with_score(self, _query: str, k: int = 4):
        return self._scored_docs[:k]


def test_merge_collects_from_all_kbs():
    doc_a = Document(
        page_content="from kb1", metadata={"document_id": 1, "kb_uuid": KB_A}
    )
    doc_b = Document(
        page_content="from kb2", metadata={"document_id": 2, "kb_uuid": KB_B}
    )
    doc_c = Document(
        page_content="also kb2", metadata={"document_id": 3, "kb_uuid": KB_B}
    )

    stores = [_FakeStore([doc_a]), _FakeStore([doc_b, doc_c])]
    merged = asyncio.run(
        retrieve_from_knowledge_bases(
            "query", stores, [KB_A, KB_B], k_per_kb=4, max_docs=12
        )
    )
    assert len(merged) == 3
    assert {d.metadata.get("kb_uuid") for d in merged} == {KB_A, KB_B}


def test_merge_deduplicates_identical_chunks():
    duplicate = Document(
        page_content="overlap", metadata={"document_id": 9, "kb_uuid": KB_A}
    )
    stores = [_FakeStore([duplicate]), _FakeStore([duplicate])]
    merged = asyncio.run(
        retrieve_from_knowledge_bases(
            "query", stores, [KB_A, KB_A], k_per_kb=4, max_docs=12
        )
    )
    assert len(merged) == 1


def test_doc_dedupe_key_uses_kb_and_document():
    doc = Document(
        page_content="text", metadata={"document_id": 5, "kb_uuid": KB_B}
    )
    assert _doc_dedupe_key(doc) == (KB_B, 5, "text")


async def _collect_stream(query, stores, kb_uuids, **kwargs):
    return [
        doc
        async for doc in stream_retrieve_from_knowledge_bases(
            query, stores, kb_uuids, **kwargs
        )
    ]


def test_stream_matches_list_retrieve():
    doc_a = Document(
        page_content="from kb1", metadata={"document_id": 1, "kb_uuid": KB_A}
    )
    doc_b = Document(
        page_content="from kb2", metadata={"document_id": 2, "kb_uuid": KB_B}
    )
    stores = [_FakeStore([doc_a]), _FakeStore([doc_b])]
    streamed = asyncio.run(_collect_stream("query", stores, [KB_A, KB_B]))
    listed = asyncio.run(
        retrieve_from_knowledge_bases(
            "query", stores, [KB_A, KB_B], k_per_kb=4, max_docs=12
        )
    )
    assert len(streamed) == len(listed) == 2
    assert {d.metadata.get("document_id") for d in streamed} == {1, 2}


def test_stream_yields_single_kb_one_by_one():
    docs = [
        Document(
            page_content=f"chunk {i}",
            metadata={"document_id": i, "kb_uuid": KB_A},
        )
        for i in range(3)
    ]
    stores = [_FakeStore(docs)]
    streamed = asyncio.run(_collect_stream("query", stores, [KB_A], max_docs=3))
    assert len(streamed) == 3


def test_stream_attaches_retrieval_scores_when_available():
    doc = Document(
        page_content="scored chunk",
        metadata={"document_id": 1, "kb_uuid": KB_A},
    )
    stores = [_FakeScoredStore([(doc, 0.1234)])]
    streamed = asyncio.run(_collect_stream("query", stores, [KB_A], max_docs=3))
    assert streamed[0].metadata[RETRIEVAL_SCORE_METADATA_KEY] == 0.1234
