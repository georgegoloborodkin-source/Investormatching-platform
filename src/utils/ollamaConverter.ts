/**
 * Ollama-based data converter utility
 * Converts unstructured data to structured Startup/Investor format
 */

import { Startup, Investor } from "@/types";

const ENV_OLLAMA_API_URL = import.meta.env.VITE_OLLAMA_API_URL as string | undefined;

function buildCandidateBaseUrls(): string[] {
  const ports = [8010, 8011, 8012, 8013, 8014, 8015, 8000];
  const urls: string[] = [];

  if (ENV_OLLAMA_API_URL) urls.push(ENV_OLLAMA_API_URL);

  // When the UI is opened via a LAN IP (e.g. http://10.x.x.x:8080),
  // "localhost" in the browser still points to the client machine.
  // So we must also try the current hostname.
  const host =
    typeof window !== "undefined" && window.location?.hostname
      ? window.location.hostname
      : "localhost";

  const candidates = Array.from(new Set([host, "localhost", "127.0.0.1"]));
  for (const c of candidates) {
    for (const p of ports) {
      urls.push(`http://${c}:${p}`);
    }
  }

  return Array.from(new Set(urls));
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

async function resolveOllamaApiBaseUrl(): Promise<string> {
  if (resolvedBaseUrl) return resolvedBaseUrl;

  const candidates = buildCandidateBaseUrls();

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

export interface OllamaConversionRequest {
  data: string;
  dataType?: "startup" | "investor";
  format?: string;
}

export interface OllamaConversionResponse {
  startups: Startup[];
  investors: Investor[];
  detectedType: string;
  confidence: number;
  warnings: string[];
  errors: string[];
}

/**
 * Convert unstructured data using Ollama
 */
export async function convertWithOllama(
  data: string,
  dataType?: "startup" | "investor"
): Promise<OllamaConversionResponse> {
  try {
    const baseUrl = await resolveOllamaApiBaseUrl();
    const response = await fetch(`${baseUrl}/convert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data,
        dataType,
      } as OllamaConversionRequest),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    const result: OllamaConversionResponse = await response.json();

    // Convert to our internal types
    return {
      startups: result.startups.map((s) => ({
        id: `startup-${Date.now()}-${Math.random()}`,
        companyName: s.companyName,
        geoMarkets: s.geoMarkets,
        industry: s.industry,
        fundingTarget: s.fundingTarget,
        fundingStage: s.fundingStage,
        availabilityStatus: s.availabilityStatus as "present" | "not-attending",
      })),
      investors: result.investors.map((i) => ({
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
      detectedType: result.detectedType,
      confidence: result.confidence,
      warnings: result.warnings,
      errors: result.errors,
    };
  } catch (error) {
    throw new Error(
      `Ollama conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Convert file using Ollama
 */
export async function convertFileWithOllama(
  file: File,
  dataType?: "startup" | "investor"
): Promise<OllamaConversionResponse> {
  // Re-pack the file from bytes before uploading.
  // We’ve seen intermittent 0-byte multipart uploads in some browsers/setups even when the File looks valid.
  // Building a fresh File from `arrayBuffer()` ensures we actually send the bytes.
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
    const baseUrl = await resolveOllamaApiBaseUrl();
    const response = await fetch(`${baseUrl}/convert-file`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    const result: OllamaConversionResponse = await response.json();

    // Convert to our internal types
    return {
      startups: result.startups.map((s) => ({
        id: `startup-${Date.now()}-${Math.random()}`,
        companyName: s.companyName,
        geoMarkets: s.geoMarkets,
        industry: s.industry,
        fundingTarget: s.fundingTarget,
        fundingStage: s.fundingStage,
        availabilityStatus: s.availabilityStatus as "present" | "not-attending",
      })),
      investors: result.investors.map((i) => ({
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
      detectedType: result.detectedType,
      confidence: result.confidence,
      warnings: result.warnings,
      errors: result.errors,
    };
  } catch (error) {
    const baseUrl = resolvedBaseUrl ?? "(unresolved)";
    throw new Error(
      `Ollama file conversion failed (API: ${baseUrl}): ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Check if Ollama API is available
 */
export async function checkOllamaHealth(): Promise<{
  available: boolean;
  models?: string[];
  error?: string;
}> {
  try {
    // Re-resolve each time; if user starts API later, we can find it.
    resolvedBaseUrl = null;
    const baseUrl = await resolveOllamaApiBaseUrl();
    const response = await fetch(`${baseUrl}/health`);
    const data = await response.json();
    return {
      available: data.ollama_available === true,
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
 * List available Ollama models
 */
export async function listOllamaModels(): Promise<string[]> {
  try {
    const baseUrl = await resolveOllamaApiBaseUrl();
    const response = await fetch(`${baseUrl}/models`);
    const data = await response.json();
    return data.models.map((m: { name: string }) => m.name);
  } catch (error) {
    throw new Error(
      `Failed to list models: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Validate data and get missing fields report
 * This tells the investment team what needs to be added!
 */
export interface ValidationResult {
  isValid: boolean;
  missingFields: {
    startups: string[];
    investors: string[];
  };
  incompleteFields: {
    startups: string[];
    investors: string[];
  };
  suggestions: string[];
  extractedData: {
    startups: Startup[];
    investors: Investor[];
    detectedType: string;
    confidence: number;
  };
}

export async function validateDataWithOllama(
  data: string,
  dataType?: "startup" | "investor"
): Promise<ValidationResult> {
  try {
    const baseUrl = await resolveOllamaApiBaseUrl();
    const response = await fetch(`${baseUrl}/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data,
        dataType,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    const result: ValidationResult = await response.json();

    // Convert to our internal types
    return {
      ...result,
      extractedData: {
        startups: result.extractedData.startups.map((s: any) => ({
          id: `startup-${Date.now()}-${Math.random()}`,
          companyName: s.companyName,
          geoMarkets: s.geoMarkets || [],
          industry: s.industry,
          fundingTarget: s.fundingTarget,
          fundingStage: s.fundingStage,
          availabilityStatus: s.availabilityStatus || "present",
        })),
        investors: result.extractedData.investors.map((i: any) => ({
          id: `investor-${Date.now()}-${Math.random()}`,
          firmName: i.firmName,
          memberName: i.memberName || "UNKNOWN",
          geoFocus: i.geoFocus || [],
          industryPreferences: i.industryPreferences || [],
          stagePreferences: i.stagePreferences || [],
          minTicketSize: i.minTicketSize,
          maxTicketSize: i.maxTicketSize,
          totalSlots: i.totalSlots || 3,
          tableNumber: i.tableNumber,
          availabilityStatus: i.availabilityStatus || "present",
        })),
        detectedType: result.extractedData.detectedType,
        confidence: result.extractedData.confidence,
      },
    };
  } catch (error) {
    throw new Error(
      `Validation failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

