import { proxyToBackend } from "../_lib/proxy";

export default async function handler(req: any, res: any) {
  return proxyToBackend(req, res, "/gdrive/download-file");
}
