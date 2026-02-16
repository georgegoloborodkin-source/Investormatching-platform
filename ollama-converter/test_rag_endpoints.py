"""
Smoke tests for RAG endpoints: multi-query, agentic-chunk, contextualize-chunk.
Run with the converter up: python test_rag_endpoints.py
"""

import requests
import json

API_URL = "http://localhost:8000"


def test_health():
    """Health check."""
    print("=" * 60)
    print("TEST: /health")
    print("=" * 60)
    r = requests.get(f"{API_URL}/health", timeout=5)
    r.raise_for_status()
    data = r.json()
    print("Response:", json.dumps(data, indent=2))
    assert data.get("status") == "ok"
    print("OK\n")


def test_multi_query():
    """Multi-query expansion: should return 1+ query variants."""
    print("=" * 60)
    print("TEST: /multi-query")
    print("=" * 60)
    question = "What is their burn rate and unit economics?"
    r = requests.post(
        f"{API_URL}/multi-query",
        json={"question": question, "max_variants": 3},
        timeout=10,
    )
    r.raise_for_status()
    data = r.json()
    queries = data.get("queries", [])
    print("Question:", question)
    print("Queries:", queries)
    print("model_used:", data.get("model_used", ""))
    assert isinstance(queries, list) and len(queries) >= 1
    assert queries[0] == question
    print("OK\n")


def test_agentic_chunk():
    """Agentic chunking: should return sections (or fallback)."""
    print("=" * 60)
    print("TEST: /agentic-chunk")
    print("=" * 60)
    text = (
        "Company Overview. We are a SaaS startup in fintech.\n\n"
        "Team. Our CEO has 10 years experience. CTO from Google.\n\n"
        "Unit Economics. Burn rate is $50k/month. Runway 18 months."
    )
    r = requests.post(
        f"{API_URL}/agentic-chunk",
        json={"document_title": "Test Deck", "document_text": text, "max_sections": 6},
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    sections = data.get("sections", [])
    fallback = data.get("fallback", False)
    print("Sections:", len(sections))
    for i, s in enumerate(sections):
        print(f"  {i+1}. {s.get('label', '')}: {len(s.get('text', ''))} chars")
    print("fallback:", fallback)
    assert isinstance(sections, list) and len(sections) >= 1
    # All input text should appear in sections
    combined = " ".join(s.get("text", "") for s in sections)
    for word in ["SaaS", "Burn", "50k"]:
        assert word in combined, f"Expected '{word}' in combined sections"
    print("OK\n")


def test_contextualize_chunk():
    """Contextualize-chunk: should return enriched_chunk."""
    print("=" * 60)
    print("TEST: /contextualize-chunk")
    print("=" * 60)
    r = requests.post(
        f"{API_URL}/contextualize-chunk",
        json={
            "document_title": "Pitch Deck",
            "document_summary": "Startup pitch",
            "chunk_text": "Burn rate is $50k per month. Runway 18 months.",
            "chunk_index": 0,
            "total_chunks": 3,
        },
        timeout=15,
    )
    r.raise_for_status()
    data = r.json()
    enriched = data.get("enriched_chunk", "")
    header = data.get("contextual_header", "")
    print("Has enriched_chunk:", bool(enriched))
    print("Has contextual_header:", bool(header))
    assert "enriched_chunk" in data
    assert "Burn" in enriched or "50k" in enriched
    print("OK\n")


if __name__ == "__main__":
    test_health()
    test_multi_query()
    test_agentic_chunk()
    test_contextualize_chunk()
    print("All RAG endpoint tests passed.")
