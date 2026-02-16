export default async function handler(req: any, res: any) {
  try {
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      return res.status(204).end();
    }
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ detail: "Method not allowed" });
    }
    const base = process.env.CONVERTER_API_URL || process.env.VITE_CONVERTER_API_URL;
    if (!base) {
      return res.status(500).json({ detail: "CONVERTER_API_URL env var is not set in Vercel." });
    }
    const url = `${base.replace(/\/+$/, "")}/gdrive/list-folders`;
    const upstream = await fetch(url, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body: req.method === "POST" ? JSON.stringify(req.body ?? {}) : undefined,
    });
    const text = await upstream.text();
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(upstream.status).send(text);
  } catch (err: any) {
    return res.status(502).json({ detail: `Proxy error: ${err?.message || "Unknown"}` });
  }
}
