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
        // Supabase OAuth uses query parameters (?code=...&state=...)
        // Supabase automatically processes these and establishes the session
        // We just need to wait for it to complete
        
        // Wait for Supabase to process the OAuth callback
        // Try multiple times with increasing delays
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
          
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 300 * (attempts + 1)));
          attempts++;
        }
        
        if (!session) {
          // Check URL for error parameters
          const urlParams = new URLSearchParams(window.location.search);
          const errorParam = urlParams.get('error');
          const errorDescription = urlParams.get('error_description');
          
          if (errorParam) {
            throw new Error(errorDescription || errorParam);
          }
          
          throw new Error("Session not established. Please try signing in again.");
        }

        const user = session.user;
        
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

        // Clear URL parameters to clean up
        window.history.replaceState(null, '', window.location.pathname);

        // Check if user needs to select role (new users with team_member default)
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        toast({
          title: "Successfully signed in!",
          description: "Welcome to the platform.",
        });

        // Small delay to ensure state is updated
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Redirect to role selection if user is new (team_member by default)
        // Or if they haven't explicitly chosen a role
        if (userProfile?.role === 'team_member') {
          navigate("/role-selection");
        } else {
          navigate("/");
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

