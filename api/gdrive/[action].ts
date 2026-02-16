export default async function handler(req: any, res: any) {
  const actionRaw = req?.query?.action;
  const action = Array.isArray(actionRaw) ? actionRaw[0] : actionRaw;

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
  let upstreamPath = "";

  if (action === "health") {
    upstreamPath = "/health";
  } else if (
    action === "list-folders" ||
    action === "list-files" ||
    action === "download-file"
  ) {
    upstreamPath = `/gdrive/${action}`;
  } else {
    res.status(400).json({ detail: `Unsupported gdrive action: ${String(action)}` });
    return;
  }

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
    res.send(text);
  } catch (error) {
    res.status(502).json({
      detail: `Proxy request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}
