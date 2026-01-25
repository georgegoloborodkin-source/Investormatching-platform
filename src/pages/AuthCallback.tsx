import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Handle OAuth callback - exchange code for session
        const { data: authData, error: authError } = await supabase.auth.getSession();
        
        // If no session yet, try to get it from URL hash (OAuth callback)
        if (!authData?.session) {
          // Check if we have hash params (OAuth callback)
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            // Set the session manually from URL hash
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (sessionError) {
              console.error("Set session error:", sessionError);
              throw sessionError;
            }
            
            if (!sessionData?.session) {
              throw new Error("Failed to establish session from OAuth callback");
            }
          } else {
            // No hash params, wait a bit and retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            const { data: retryData, error: retryError } = await supabase.auth.getSession();
            
            if (retryError) {
              throw retryError;
            }
            
            if (!retryData?.session) {
              throw new Error("No session found. Please try signing in again.");
            }
          }
        }
        
        // Now get the session (should exist now)
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          throw sessionError;
        }

        if (!sessionData?.session) {
          throw new Error("No session returned from Supabase. Check redirect URLs and try again.");
        }

        const user = sessionData.session.user;
        
        // Check if user profile exists, create if not
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError && profileError.code === 'PGRST116') {
          // Profile doesn't exist, create it
          const { error: insertError } = await supabase
            .from('user_profiles')
            .insert({
              id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
              role: 'team_member',
            });

          if (insertError) {
            console.error("Profile insert error:", insertError);
            throw insertError;
          }
        } else if (profileError) {
          console.error("Profile fetch error:", profileError);
          // Don't throw - profile might exist but RLS is blocking
        }

        // Clear URL hash to clean up
        window.history.replaceState(null, '', window.location.pathname);

        toast({
          title: "Successfully signed in!",
          description: "Welcome to the platform.",
        });

        // Small delay to ensure state is updated
        await new Promise(resolve => setTimeout(resolve, 100));
        navigate("/");
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
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        {errorMessage ? (
          <div className="space-y-3">
            <div className="text-lg font-semibold">Sign-in failed</div>
            <div className="text-sm text-muted-foreground">{errorMessage}</div>
            <Button onClick={() => navigate("/login")}>Back to Login</Button>
          </div>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Completing sign in...</p>
          </>
        )}
      </div>
    </div>
  );
}

