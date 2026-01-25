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
        // Wait a bit for Supabase to process the OAuth callback
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Get the session - this should work after OAuth redirect
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          throw sessionError;
        }

        if (sessionData?.session) {
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
          }

          toast({
            title: "Successfully signed in!",
            description: "Welcome to the platform.",
          });

          navigate("/");
        } else {
          // Try getting user directly as fallback
          const { data: userData, error: userError } = await supabase.auth.getUser();
          
          if (userError) {
            console.error("Get user error:", userError);
            throw userError;
          }
          
          if (userData?.user) {
            // User exists but no session - try to refresh
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              throw new Error("Session expired. Please sign in again.");
            }
            // Retry navigation after refresh
            navigate("/");
          } else {
            setErrorMessage("No session returned from Supabase. Check redirect URLs and try again.");
          }
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

