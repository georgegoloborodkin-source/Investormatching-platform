/**
 * AI converter client utility
 * Talks to the backend converter API (Claude or other provider).
 */

import { Startup, Investor, Mentor, CorporatePartner } from "@/types";

const ENV_CONVERTER_API_URL = import.meta.env.VITE_CONVERTER_API_URL as string | undefined;

function buildCandidateBaseUrls(): string[] {
  if (ENV_CONVERTER_API_URL) return [ENV_CONVERTER_API_URL];
  return [];
}

let resolvedBaseUrl: string | null = null;

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 800): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveConverterApiBaseUrl(): Promise<string> {
  if (resolvedBaseUrl) return resolvedBaseUrl;

  const candidates = buildCandidateBaseUrls();
  if (!candidates.length) {
    throw new Error("VITE_CONVERTER_API_URL is not set. Configure it to use the Render converter.");
  }

  for (const base of candidates) {
    try {
      const res = await fetchWithTimeout(`${base}/health`, undefined, 800);
      if (res.ok) {
        resolvedBaseUrl = base;
        return base;
      }
    } catch {
      // try next
    }
  }

  // Nothing reachable; still return first candidate so error messages are consistent.
  resolvedBaseUrl = candidates[0];
  return resolvedBaseUrl;
}

export interface AIConversionRequest {
  data: string;
  dataType?: "startup" | "investor" | "mentor" | "corporate";
  format?: string;
}

export interface AIConversionResponse {
  startups: Startup[];
  investors: Investor[];
  mentors: Mentor[];
  corporates: CorporatePartner[];
  detectedType: string;
  confidence: number;
  warnings: string[];
  errors: string[];
  raw_content?: string | null;
}

export interface AskFundSource {
  title?: string | null;
  snippet?: string | null;
  file_name?: string | null;
}

export interface AskFundDecision {
  startup_name?: string | null;
  action_type?: string | null;
  outcome?: string | null;
  notes?: string | null;
}

export interface AskFundConnection {
  source_company_name: string;
  target_company_name: string;
  connection_type: string;
  connection_status: string;
  ai_reasoning?: string | null;
  notes?: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Convert unstructured data using the converter API
 */
export async function convertWithAI(
  data: string,
  dataType?: "startup" | "investor"
): Promise<AIConversionResponse> {
  try {
    const baseUrl = await resolveConverterApiBaseUrl();
    const response = await fetch(`${baseUrl}/convert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data,
        dataType,
      } as AIConversionRequest),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    const result: AIConversionResponse = await response.json();

    // Convert to our internal types
    return {
      startups: (result.startups || []).map((s) => ({
        id: `startup-${Date.now()}-${Math.random()}`,
        companyName: s.companyName,
        geoMarkets: s.geoMarkets,
        industry: s.industry,
        fundingTarget: s.fundingTarget,
        fundingStage: s.fundingStage,
        availabilityStatus: s.availabilityStatus as "present" | "not-attending",
      })),
      investors: (result.investors || []).map((i) => ({
        id: `investor-${Date.now()}-${Math.random()}`,
        firmName: i.firmName,
        memberName: (i as any).memberName || "UNKNOWN",
        geoFocus: i.geoFocus,
        industryPreferences: i.industryPreferences,
        stagePreferences: i.stagePreferences,
        minTicketSize: i.minTicketSize,
        maxTicketSize: i.maxTicketSize,
        totalSlots: i.totalSlots,
        tableNumber: i.tableNumber,
        availabilityStatus: i.availabilityStatus as "present" | "not-attending",
      })),
      mentors: (result.mentors || []).map((m: any) => ({
        id: `mentor-${Date.now()}-${Math.random()}`,
        fullName: m.fullName,
        email: m.email,
        linkedinUrl: m.linkedinUrl,
        geoFocus: m.geoFocus || [],
        industryPreferences: m.industryPreferences || [],
        expertiseAreas: m.expertiseAreas || [],
        totalSlots: m.totalSlots || 3,
        availabilityStatus: (m.availabilityStatus as "present" | "not-attending") || "present",
      })),
      corporates: (result.corporates || []).map((c: any) => ({
        id: `corporate-${Date.now()}-${Math.random()}`,
        firmName: c.firmName,
        contactName: c.contactName,
        email: c.email,
        geoFocus: c.geoFocus || [],
        industryPreferences: c.industryPreferences || [],
        partnershipTypes: c.partnershipTypes || [],
        stages: c.stages || [],
        totalSlots: c.totalSlots || 3,
        availabilityStatus: (c.availabilityStatus as "present" | "not-attending") || "present",
      })),
      detectedType: result.detectedType,
      confidence: result.confidence,
      warnings: result.warnings,
      errors: result.errors,
      raw_content: result.raw_content ?? null,
    };
  } catch (error) {
    throw new Error(
      `AI conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export async function askClaudeAnswer(input: {
  question: string;
  sources: AskFundSource[];
  decisions: AskFundDecision[];
}): Promise<{ answer: string }> {
  const baseUrl = await resolveConverterApiBaseUrl();
  const controller = new AbortController();
  // Increased timeout to 70 seconds to match backend (60s) + buffer
  const timeoutMs = 70000;
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  let response: Response | null = null;
  const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        response = await fetch(`${baseUrl}/ask`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
          signal: controller.signal,
        });
        break;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new Error("Claude request timed out after 70 seconds. The question may be too complex or the API is slow. Please try again with a simpler question.");
        }
        if (attempt < 2) {
          // Exponential backoff: 1s, 2s
          await sleep(1000 * (attempt + 1));
          continue;
        }
        throw error;
      }
    }
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response || !response.ok) {
    const error = await response.json().catch(() => ({}));
    const errorMessage = error.detail || error.message || `HTTP error! status: ${response?.status || 'unknown'}`;
    throw new Error(errorMessage);
  }

  return await response.json();
}

export async function askClaudeAnswerStream(
  input: {
    question: string;
    sources: AskFundSource[];
    decisions: AskFundDecision[];
    connections?: AskFundConnection[];
    previousMessages?: ChatMessage[];
  },
  onChunk: (text: string) => void,
  onError?: (error: Error) => void
): Promise<void> {
  const baseUrl = await resolveConverterApiBaseUrl();
  const controller = new AbortController();
  const timeoutMs = 70000;
  let timeoutFired = false;
  const timeout = window.setTimeout(() => {
    timeoutFired = true;
    controller.abort();
  }, timeoutMs);

  try {
    const payload = {
      question: input.question,
      sources: input.sources,
      decisions: input.decisions,
      connections: input.connections || [],
      // Backend expects snake_case
      previous_messages: input.previousMessages || [],
    };
    const response = await fetch(`${baseUrl}/ask/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || error.message || `HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error("No response body");
    }

    let buffer = "";
    let hasReceivedData = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // If stream ended without any data, it's an error
          if (!hasReceivedData && !timeoutFired) {
            onError?.(new Error("Stream ended without data. The server may have encountered an error."));
          }
          break;
        }

        // Check if timeout fired during read
        if (timeoutFired) {
          reader.cancel();
          onError?.(new Error("Request timed out after 70 seconds. The response is taking too long. Please try again with a simpler question."));
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            hasReceivedData = true;
            try {
              const dataStr = line.slice(6).trim();
              if (!dataStr) {
                continue;
              }
              if (dataStr === "[DONE]") {
                return;
              }
              const data = JSON.parse(dataStr);
              if (data.text) {
                onChunk(data.text);
              } else if (data.error) {
                onError?.(new Error(data.error));
                return;
              }
            } catch (e) {
              if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
                onError?.(e);
                return;
              }
            }
          }
        }
      }
    } catch (readError) {
      // If timeout fired, we already handled it above
      if (!timeoutFired) {
        if (readError instanceof DOMException && readError.name === "AbortError") {
          onError?.(new Error("Request timed out after 70 seconds. The response is taking too long. Please try again with a simpler question."));
        } else {
          onError?.(readError instanceof Error ? readError : new Error("Stream read error"));
        }
      }
    }
  } catch (error) {
    if (timeoutFired) {
      onError?.(new Error("Request timed out after 70 seconds. The response is taking too long. Please try again with a simpler question."));
    } else if (error instanceof DOMException && error.name === "AbortError") {
      onError?.(new Error("Request timed out after 70 seconds. The response is taking too long. Please try again with a simpler question."));
    } else {
      onError?.(error instanceof Error ? error : new Error("Unknown error"));
    }
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function rerankDocuments(input: {
  query: string;
  documents: Array<{ id: string; text: string }>;
  topN?: number;
}): Promise<Array<{ id: string; score: number }>> {
  const baseUrl = await resolveConverterApiBaseUrl();
  if (!input.documents.length) return [];
  const response = await fetch(`${baseUrl}/rerank`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: input.query,
      documents: input.documents,
      top_n: input.topN,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const errorMessage = error.detail || error.message || `HTTP error! status: ${response.status}`;
    throw new Error(errorMessage);
  }
  const data = await response.json();
  return data?.results || [];
}

export async function rewriteQueryWithLLM(
  question: string,
  previousMessages?: ChatMessage[]
): Promise<string> {
  const baseUrl = await resolveConverterApiBaseUrl();
  const response = await fetch(`${baseUrl}/rewrite-query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question,
      previous_messages: previousMessages || [],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || error.message || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.rewritten_question || question;
}

export async function embedQuery(text: string, inputType: "query" | "document" = "query"): Promise<number[]> {
  const baseUrl = await resolveConverterApiBaseUrl();
  const response = await fetchWithTimeout(
    `${baseUrl}/embed/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, input_type: inputType }),
    },
    15000
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  return result.embedding || [];
}

/**
 * Convert file using the converter API
 */
export async function convertFileWithAI(
  file: File,
  dataType?: "startup" | "investor"
): Promise<AIConversionResponse> {
  // Re-pack the file from bytes before uploading.
  const buf = await file.arrayBuffer();
  if (buf.byteLength === 0) {
    throw new Error(
      `Selected file is empty in the browser (0 bytes). filename="${file.name}", type="${file.type}". Re-select the file from disk.`
    );
  }

  const uploadFile = new File([buf], file.name, {
    type: file.type || "application/octet-stream",
  });

  const formData = new FormData();
  formData.append("file", uploadFile);
  if (dataType) {
    formData.append("dataType", dataType);
  }

  try {
    const baseUrl = await resolveConverterApiBaseUrl();
    const response = await fetchWithTimeout(
      `${baseUrl}/convert-file`,
      {
        method: "POST",
        body: formData,
      },
      60000
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    const result: AIConversionResponse = await response.json();

    // Convert to our internal types
    return {
      startups: (result.startups || []).map((s) => ({
        id: `startup-${Date.now()}-${Math.random()}`,
        companyName: s.companyName,
        geoMarkets: s.geoMarkets,
        industry: s.industry,
        fundingTarget: s.fundingTarget,
        fundingStage: s.fundingStage,
        availabilityStatus: s.availabilityStatus as "present" | "not-attending",
      })),
      investors: (result.investors || []).map((i) => ({
        id: `investor-${Date.now()}-${Math.random()}`,
        firmName: i.firmName,
        memberName: (i as any).memberName || "UNKNOWN",
        geoFocus: i.geoFocus,
        industryPreferences: i.industryPreferences,
        stagePreferences: i.stagePreferences,
        minTicketSize: i.minTicketSize,
        maxTicketSize: i.maxTicketSize,
        totalSlots: i.totalSlots,
        tableNumber: i.tableNumber,
        availabilityStatus: i.availabilityStatus as "present" | "not-attending",
      })),
      mentors: (result.mentors || []).map((m: any) => ({
        id: `mentor-${Date.now()}-${Math.random()}`,
        fullName: m.fullName,
        email: m.email,
        linkedinUrl: m.linkedinUrl,
        geoFocus: m.geoFocus || [],
        industryPreferences: m.industryPreferences || [],
        expertiseAreas: m.expertiseAreas || [],
        totalSlots: m.totalSlots || 3,
        availabilityStatus: (m.availabilityStatus as "present" | "not-attending") || "present",
      })),
      corporates: (result.corporates || []).map((c: any) => ({
        id: `corporate-${Date.now()}-${Math.random()}`,
        firmName: c.firmName,
        contactName: c.contactName,
        email: c.email,
        geoFocus: c.geoFocus || [],
        industryPreferences: c.industryPreferences || [],
        partnershipTypes: c.partnershipTypes || [],
        stages: c.stages || [],
        totalSlots: c.totalSlots || 3,
        availabilityStatus: (c.availabilityStatus as "present" | "not-attending") || "present",
      })),
      detectedType: result.detectedType,
      confidence: result.confidence,
      warnings: result.warnings,
      errors: result.errors,
      raw_content: result.raw_content ?? null,
    };
  } catch (error) {
    const baseUrl = resolvedBaseUrl ?? "(unresolved)";
    throw new Error(
      `AI file conversion failed (API: ${baseUrl}): ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// ---------------------------------------------------------------------------
//  Step 1: Contextual chunking — call /contextualize-chunk before embedding
// ---------------------------------------------------------------------------

export interface ContextualizeChunkInput {
  document_title: string;
  document_summary: string;
  chunk_text: string;
  chunk_index: number;
  total_chunks: number;
}

export interface ContextualizeChunkResult {
  enriched_chunk: string;
  contextual_header: string;
}

export async function contextualizeChunk(
  input: ContextualizeChunkInput
): Promise<ContextualizeChunkResult> {
  try {
    const baseUrl = await resolveConverterApiBaseUrl();
    const response = await fetchWithTimeout(
      `${baseUrl}/contextualize-chunk`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      20000 // 20s — Haiku is fast but network can be slow
    );
    if (!response.ok) {
      // Fall back to raw chunk
      return { enriched_chunk: input.chunk_text, contextual_header: "" };
    }
    return await response.json();
  } catch {
    // Fail silently — return raw chunk
    return { enriched_chunk: input.chunk_text, contextual_header: "" };
  }
}

// ---------------------------------------------------------------------------
//  Step 2: GraphRAG retrieval — call /graphrag/retrieve for relevance filtering
// ---------------------------------------------------------------------------

export interface GraphRAGChunk {
  id: string;
  text: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface GraphRAGResult {
  relevant_chunks: GraphRAGChunk[];
  expanded: boolean;
  total_assessed: number;
}

export async function graphragRetrieve(input: {
  query: string;
  initial_chunks: GraphRAGChunk[];
  neighboring_chunks?: GraphRAGChunk[];
  min_relevant_chunks?: number;
}): Promise<GraphRAGResult> {
  try {
    const baseUrl = await resolveConverterApiBaseUrl();
    const response = await fetchWithTimeout(
      `${baseUrl}/graphrag/retrieve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: input.query,
          initial_chunks: input.initial_chunks,
          neighboring_chunks: input.neighboring_chunks || [],
          min_relevant_chunks: input.min_relevant_chunks ?? 2,
        }),
      },
      30000 // 30s — Claude needs to assess each chunk
    );
    if (!response.ok) {
      return { relevant_chunks: input.initial_chunks, expanded: false, total_assessed: 0 };
    }
    return await response.json();
  } catch {
    return { relevant_chunks: input.initial_chunks, expanded: false, total_assessed: 0 };
  }
}

// ---------------------------------------------------------------------------
//  Step 3: Query router — entity extraction, intent, complexity, routing
// ---------------------------------------------------------------------------

export type QueryIntent =
  | "factual"       // Simple lookup: "What is Giga Energy?"
  | "compare"       // Compare entities: "Compare Ridelink vs Weego"
  | "summarize"     // Summarize a doc/company
  | "diligence"     // Due diligence: "risks of investing in X"
  | "forecast"      // Forward-looking: "What's the growth potential"
  | "relationship"  // About connections: "Who is connected to X"
  | "meta"          // About the system: "What can you do?"
  | "conversational"; // Greeting/chat

export interface QueryAnalysis {
  entities: Array<{ name: string; type: "company" | "person" | "fund" | "metric" | "sector" | "unknown" }>;
  intent: QueryIntent;
  complexity: number; // 0.0–1.0
  retrieval_strategy: "vector" | "vector+graph" | "vector+graph+structured" | "none";
  rewritten_query: string;
}

export async function analyzeQuery(
  question: string,
  previousMessages?: ChatMessage[]
): Promise<QueryAnalysis> {
  try {
    const baseUrl = await resolveConverterApiBaseUrl();
    const response = await fetchWithTimeout(
      `${baseUrl}/analyze-query`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, previous_messages: previousMessages || [] }),
      },
      10000
    );
    if (!response.ok) {
      // Fallback: simple heuristic
      return fallbackQueryAnalysis(question);
    }
    return await response.json();
  } catch {
    return fallbackQueryAnalysis(question);
  }
}

function fallbackQueryAnalysis(question: string): QueryAnalysis {
  const q = question.toLowerCase();
  const connectionWords = ["connect", "partner", "introduce", "relationship", "linked"];
  const compareWords = ["compare", "vs", "versus", "difference", "better"];
  const diligenceWords = ["risk", "diligence", "red flag", "concern", "weakness"];
  const forecastWords = ["growth", "potential", "forecast", "predict", "future"];
  const metaWords = ["what can you", "your purpose", "help me", "what do you"];

  let intent: QueryIntent = "factual";
  let strategy: QueryAnalysis["retrieval_strategy"] = "vector";

  if (metaWords.some((w) => q.includes(w))) { intent = "meta"; strategy = "none"; }
  else if (connectionWords.some((w) => q.includes(w))) { intent = "relationship"; strategy = "vector+graph"; }
  else if (compareWords.some((w) => q.includes(w))) { intent = "compare"; strategy = "vector+graph"; }
  else if (diligenceWords.some((w) => q.includes(w))) { intent = "diligence"; strategy = "vector+graph+structured"; }
  else if (forecastWords.some((w) => q.includes(w))) { intent = "forecast"; strategy = "vector+graph+structured"; }
  else { intent = "factual"; strategy = "vector"; }

  return {
    entities: [],
    intent,
    complexity: q.split(" ").length > 15 ? 0.8 : 0.3,
    retrieval_strategy: strategy,
    rewritten_query: question,
  };
}

// ---------------------------------------------------------------------------
//  Step 7 (partial): RAG eval logging
// ---------------------------------------------------------------------------

export interface RAGEvalEntry {
  question: string;
  retrieval_strategy: string;
  chunks_retrieved: number;
  chunks_cited: number;
  model_used: string;
  latency_ms: number;
  user_feedback?: "helpful" | "not_helpful" | null;
}

export async function logRAGEval(entry: RAGEvalEntry): Promise<void> {
  try {
    const baseUrl = await resolveConverterApiBaseUrl();
    await fetchWithTimeout(
      `${baseUrl}/rag-eval/log`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      },
      5000
    );
  } catch {
    // Non-critical — don't block the user
    console.warn("[RAG eval] Failed to log entry");
  }
}

// ---------------------------------------------------------------------------
//  Entity Extraction — auto-populate knowledge graph + KPIs from documents
// ---------------------------------------------------------------------------

export interface ExtractedEntity {
  name: string;
  type: "company" | "person" | "fund" | "round" | "sector" | "metric" | "location";
  properties: Record<string, unknown>;
  confidence: number;
}

export interface ExtractedRelationship {
  source_name: string;
  target_name: string;
  relation_type: string;
  properties: Record<string, unknown>;
  confidence: number;
}

export interface ExtractedKPI {
  company_name: string;
  metric_name: string;
  value: number;
  unit: string;
  period: string;
  category: string;
  confidence: number;
}

export interface EntityExtractionResult {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  kpis: ExtractedKPI[];
}

export async function extractEntities(input: {
  document_title: string;
  document_text: string;
  document_type?: string;
}): Promise<EntityExtractionResult> {
  try {
    const baseUrl = await resolveConverterApiBaseUrl();
    const response = await fetchWithTimeout(
      `${baseUrl}/extract-entities`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      45000 // 45s — Sonnet extraction can be slow on large docs
    );
    if (!response.ok) {
      return { entities: [], relationships: [], kpis: [] };
    }
    return await response.json();
  } catch {
    console.warn("[extractEntities] Failed");
    return { entities: [], relationships: [], kpis: [] };
  }
}

/**
 * Check if converter API is available
 */
export async function checkConverterHealth(): Promise<{
  available: boolean;
  provider?: string;
  models?: string[];
  error?: string;
}> {
  try {
    // Re-resolve each time; if user starts API later, we can find it.
    resolvedBaseUrl = null;
    const baseUrl = await resolveConverterApiBaseUrl();
    const response = await fetch(`${baseUrl}/health`);
    const data = await response.json();
    const available = data.available === true || data.status === "healthy";
    return {
      available,
      provider: data.provider,
      models: data.models,
      error: data.error,
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

/**
 * Ask Claude to suggest company connections based on documents + existing graph
 */
export interface SuggestedConnection {
  source_company: string;
  target_company: string;
  connection_type: string;
  reasoning: string;
  confidence: number;
}

export async function suggestConnections(input: {
  companyName?: string;
  question?: string;
  sources: AskFundSource[];
  existingConnections: AskFundConnection[];
  maxSuggestions?: number;
}): Promise<{ suggestions: SuggestedConnection[]; contextSummary: string }> {
  try {
    const baseUrl = await resolveConverterApiBaseUrl();
    const response = await fetch(`${baseUrl}/suggest-connections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_name: input.companyName || "",
        question: input.question || "",
        sources: input.sources,
        existing_connections: input.existingConnections,
        max_suggestions: input.maxSuggestions ?? 5,
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${response.status}`);
    }
    const data = await response.json();
    return {
      suggestions: data.suggestions || [],
      contextSummary: data.context_summary || "",
    };
  } catch (error) {
    console.error("[suggestConnections] Error:", error);
    return { suggestions: [], contextSummary: "Failed to get suggestions." };
  }
}

