import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace("#", "?"));
        const errorParam = urlParams.get("error") || hashParams.get("error");
        const errorDescription = urlParams.get("error_description") || hashParams.get("error_description");

        if (errorParam) {
          throw new Error(errorDescription || errorParam);
        }

        // With PKCE (flowType: 'pkce') + detectSessionInUrl: true, the Supabase
        // client auto-exchanges the code for a session when it detects ?code= in
        // the URL. If we also call exchangeCodeForSession manually, the code_verifier
        // is already consumed → "both auth code and code verifier should be non-empty".
        //
        // Fix: just poll for the session to appear (Supabase handles the exchange).
        let session = null;
        let lastError: Error | null = null;
        const maxAttempts = 20;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const { data, error } = await supabase.auth.getSession();
            if (error) {
              lastError = error;
            }
            if (data?.session) {
              session = data.session;
              break;
            }
          } catch (e: any) {
            lastError = e;
          }
          await new Promise((resolve) => setTimeout(resolve, 400 * Math.min(attempt + 1, 4)));
        }

        if (!session) {
          throw new Error(
            lastError?.message ||
            "Session not established after sign-in. Please clear your browser cache and try again."
          );
        }

        const user = session.user;

        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profileError && profileError.code === "PGRST116") {
          const { error: upsertError } = await supabase.from("user_profiles").upsert(
            {
              id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
              role: "team_member",
            },
            { onConflict: "id", ignoreDuplicates: true }
          );

          if (upsertError) {
            throw upsertError;
          }
        }

        window.history.replaceState(null, "", window.location.pathname);

        const { data: userProfile } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        toast({
          title: "Successfully signed in!",
          description: "Welcome to the platform.",
        });

        await new Promise((resolve) => setTimeout(resolve, 200));

        if (userProfile?.role === "team_member") {
          navigate("/role-selection");
        } else {
          navigate("/cis");
        }
      } catch (error: any) {
        toast({
          title: "Authentication error",
          description: error.message || "Failed to complete sign in",
          variant: "destructive",
        });
        setErrorMessage(error.message || "Failed to complete sign in.");
      }
    };

    handleAuthCallback();
  }, [navigate, toast]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 page-content">
      <div className="text-center">
        {errorMessage ? (
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 backdrop-blur-sm p-8 max-w-md space-y-4">
            <div className="text-lg font-semibold text-white">Sign-in failed</div>
            <div className="text-sm text-slate-400">{errorMessage}</div>
            <Button
              onClick={() => navigate("/login")}
              className="rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Login
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-amber-500/15 flex items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-amber-400" />
            </div>
            <p className="text-slate-400 font-medium">Completing sign in...</p>
          </div>
        )}
      </div>
    </div>
  );
}
