import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginButton } from "@/components/Auth/LoginButton";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Brain, ArrowLeft } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/cis");
      }
    };
    checkSession();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(245,158,11,0.08),transparent)]" />
      <header className="border-b border-slate-200/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/orbit-stats"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <Link to="/orbit-stats" className="flex items-center gap-2 font-semibold text-slate-900 tracking-tight">
            Platform
          </Link>
          <span className="w-24" />
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-md">
          <Card className="border border-slate-700/60 bg-slate-900/60 backdrop-blur-sm shadow-2xl shadow-black/30 rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-700/60 bg-slate-800/30 px-8 pt-8 pb-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
                  <Brain className="h-7 w-7" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold text-slate-900">Welcome back</CardTitle>
                  <CardDescription className="text-slate-400 text-sm mt-1">
                    Sign in to access Platform.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-8 pb-8 px-8">
              <LoginButton />
              <p className="mt-6 text-center text-xs text-slate-500">
                By signing in, you agree to our Terms of Service and Privacy Policy.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
