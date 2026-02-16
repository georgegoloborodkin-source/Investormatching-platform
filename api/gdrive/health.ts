export default async function handler(req: any, res: any) {
  try {
    const base = process.env.CONVERTER_API_URL || process.env.VITE_CONVERTER_API_URL;
    if (!base) {
      return res.status(500).json({ detail: "CONVERTER_API_URL env var is not set in Vercel." });
    }
    const url = `${base.replace(/\/+$/, "")}/health`;
    const upstream = await fetch(url, { method: "GET" });
    const text = await upstream.text();
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(upstream.status).send(text);
  } catch (err: any) {
    return res.status(502).json({ detail: `Proxy error: ${err?.message || "Unknown"}` });
  }
}
