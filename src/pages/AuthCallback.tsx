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
        let session = null;
        let attempts = 0;
        const maxAttempts = 10;

        while (!session && attempts < maxAttempts) {
          const { data, error } = await supabase.auth.getSession();

          if (error) {
            console.error("Session error:", error);
            throw error;
          }

          if (data?.session) {
            session = data.session;
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 300 * (attempts + 1)));
          attempts++;
        }

        if (!session) {
          const urlParams = new URLSearchParams(window.location.search);
          const errorParam = urlParams.get("error");
          const errorDescription = urlParams.get("error_description");

          if (errorParam) {
            throw new Error(errorDescription || errorParam);
          }

          throw new Error("Session not established. Please try signing in again.");
        }

        const user = session.user;

        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profileError && profileError.code === "PGRST116") {
          const { error: insertError } = await supabase.from("user_profiles").insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
            role: "team_member",
          });

          if (insertError) {
            console.error("Profile insert error:", insertError);
            throw insertError;
          }
        } else if (profileError) {
          console.error("Profile fetch error:", profileError);
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
        console.error("Auth callback error:", error);
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
