import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginButton } from "@/components/Auth/LoginButton";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Brain } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };
    checkSession();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-12">
      <div className="w-full max-w-md page-content">
        <Card className="border border-slate-700/60 bg-slate-900/50 backdrop-blur-sm shadow-xl shadow-black/20 rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-700/60 bg-slate-800/30">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                <Brain className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-white">Welcome</CardTitle>
                <CardDescription className="text-slate-400 text-sm mt-0.5">
                  Sign in to access the platform
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 pb-8">
            <LoginButton />
            <p className="mt-5 text-center text-xs text-slate-500">
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
