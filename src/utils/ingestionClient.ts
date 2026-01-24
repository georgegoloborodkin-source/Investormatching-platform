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

async function resolveIngestionBaseUrl(): Promise<string> {
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

  resolvedBaseUrl = candidates[0];
  return resolvedBaseUrl;
}

export async function ingestClickUpList(
  listId: string,
  includeClosed = true
): Promise<{
  tasks: Array<{
    id: string;
    name: string;
    url?: string | null;
    status?: string | null;
    assignees?: string[];
    description?: string | null;
  }>;
}> {
  try {
    const baseUrl = await resolveIngestionBaseUrl();
    const response = await fetch(`${baseUrl}/ingest/clickup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ list_id: listId, include_closed: includeClosed }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(
      `ClickUp ingestion failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export async function ingestGoogleDrive(
  url: string,
  accessToken?: string | null
): Promise<{ title: string; content: string; raw_content: string; sourceType: string }> {
  try {
    const baseUrl = await resolveIngestionBaseUrl();
    const response = await fetch(`${baseUrl}/ingest/google-drive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, access_token: accessToken || null }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(
      `Google Drive ingestion failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

