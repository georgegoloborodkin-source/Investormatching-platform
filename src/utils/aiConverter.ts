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
  },
  onChunk: (text: string) => void,
  onError?: (error: Error) => void
): Promise<void> {
  const baseUrl = await resolveConverterApiBaseUrl();
  const controller = new AbortController();
  const timeoutMs = 70000;
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/ask/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
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
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // If stream ended without any data, it's an error
        if (!hasReceivedData) {
          onError?.(new Error("Stream ended without data. The server may have encountered an error."));
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          hasReceivedData = true;
          try {
            const data = JSON.parse(line.slice(6));
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
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      onError?.(new Error("Request timed out after 70 seconds."));
    } else {
      onError?.(error instanceof Error ? error : new Error("Unknown error"));
    }
  } finally {
    window.clearTimeout(timeout);
  }
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

