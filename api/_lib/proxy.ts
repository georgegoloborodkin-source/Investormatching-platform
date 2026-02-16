/** Shared proxy logic for all gdrive API routes */
export async function proxyToBackend(req: any, res: any, upstreamPath: string) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).end();
    return;
  }

  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({ detail: "Method not allowed" });
    return;
  }

  const converterBaseUrl =
    process.env.CONVERTER_API_URL || process.env.VITE_CONVERTER_API_URL;
  if (!converterBaseUrl) {
    res.status(500).json({
      detail:
        "Converter API URL is not configured. Set CONVERTER_API_URL in Vercel env vars.",
    });
    return;
  }

  const normalizedBase = converterBaseUrl.replace(/\/+$/, "");

  try {
    const upstreamUrl = `${normalizedBase}${upstreamPath}`;
    const upstreamRes = await fetch(upstreamUrl, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body: req.method === "POST" ? JSON.stringify(req.body ?? {}) : undefined,
    });

    const contentType = upstreamRes.headers.get("content-type") || "application/json";
    const text = await upstreamRes.text();

    res.status(upstreamRes.status);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(text);
  } catch (error) {
    res.status(502).json({
      detail: `Proxy request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}
