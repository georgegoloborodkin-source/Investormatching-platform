import { supabase } from "@/integrations/supabase/client";
import { clearMyToken404Cache } from "@/utils/ingestionClient";

const ENV_OAUTH_BACKEND = import.meta.env.VITE_GOOGLE_OAUTH_BACKEND_URL as string | undefined;
const ENV_CONVERTER_API_URL = import.meta.env.VITE_CONVERTER_API_URL as string | undefined;
/** Backend that has /auth/google-drive/start and /gdrive/my-token. Default: general-platform (full backend). */
export function getGoogleOAuthBackendUrl(): string {
  return ENV_OAUTH_BACKEND || ENV_CONVERTER_API_URL || "https://general-platform.onrender.com";
}

/**
 * Start backend-driven Google Drive OAuth: backend stores tokens and returns them via GET /gdrive/my-token.
 * Redirects to backend -> Google -> back to frontend. No reliance on Supabase provider_token.
 */
export async function triggerGoogleOAuthForDrive(): Promise<void> {
  clearMyToken404Cache();

  let accessToken: string | undefined;

  const { data: sessionData } = await supabase.auth.getSession();
  accessToken = sessionData?.session?.access_token;

  if (!accessToken) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      const msg = refreshError.message ?? "";
      if (msg.includes("429") || msg.toLowerCase().includes("too many")) {
        throw new Error("Too many requests. Wait a moment and try again.");
      }
      throw new Error(
        "Grant Google Drive access: you'll be redirected to Google to sign in and allow access."
      );
    }
    accessToken = refreshData?.session?.access_token;
  }

  if (!accessToken) {
    throw new Error(
      "You must be signed in to connect Google Drive. Sign out and sign back in to fix this."
    );
  }

  const base = getGoogleOAuthBackendUrl();
  const res = await fetch(`${base}/auth/google-drive/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 404) {
      throw new Error(
        "Google Drive connection is not available on this backend. Set VITE_GOOGLE_OAUTH_BACKEND_URL to your full backend URL (e.g. https://general-platform.onrender.com) in Vercel env."
      );
    }
    if (res.status === 429) {
      throw new Error("Too many requests. Wait a moment and try again.");
    }
    throw new Error(text || `Backend returned ${res.status}`);
  }
  const json = await res.json();
  if (json.redirect_url) {
    window.location.href = json.redirect_url;
  }
}
