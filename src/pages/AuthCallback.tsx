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
        const { data, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (data.session) {
          // Check if user profile exists, create if not
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', data.session.user.id)
            .single();

          if (profileError && profileError.code === 'PGRST116') {
            // Profile doesn't exist, create it
            const { error: insertError } = await supabase
              .from('user_profiles')
              .insert({
                id: data.session.user.id,
                email: data.session.user.email,
                full_name: data.session.user.user_metadata?.full_name || data.session.user.user_metadata?.name || '',
                role: 'team_member', // Default role (organizer can promote users later)
              });

            if (insertError) throw insertError;
          }

          toast({
            title: "Successfully signed in!",
            description: "Welcome to the platform.",
          });

          navigate("/");
        } else {
          setErrorMessage("No session returned from Supabase. Check redirect URLs and try again.");
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

