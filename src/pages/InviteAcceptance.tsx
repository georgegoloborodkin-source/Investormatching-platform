import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, AlertCircle, Mail } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function InviteAcceptance() {
  const { token } = useParams<{ token: string }>();
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<{
    email: string;
    role: string;
    organization_name: string;
    expires_at: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid invitation link");
      setLoading(false);
      return;
    }

    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    if (!token) return;

    try {
      // Get invitation details (using RLS, user can only see their own invitations)
      const { data, error: fetchError } = await supabase
        .from("invitations")
        .select(`
          email,
          role,
          expires_at,
          accepted_at,
          organizations:organization_id (
            name
          )
        `)
        .eq("token", token)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (!data) {
        setError("Invitation not found");
        setLoading(false);
        return;
      }

      if (data.accepted_at) {
        setError("This invitation has already been accepted");
        setLoading(false);
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setError("This invitation has expired");
        setLoading(false);
        return;
      }

      // Check if user email matches invitation email
      const userEmail = user?.email || profile?.email;
      if (userEmail && userEmail.toLowerCase() !== data.email.toLowerCase()) {
        setError(`This invitation is for ${data.email}, but you're signed in as ${userEmail}`);
        setLoading(false);
        return;
      }

      setInvitation({
        email: data.email,
        role: data.role,
        organization_name: (data.organizations as any)?.name || "Unknown",
        expires_at: data.expires_at,
      });
    } catch (err: any) {
      console.error("Error loading invitation:", err);
      setError(err.message || "Failed to load invitation");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!token || !user) {
      toast({
        title: "Error",
        description: "Please sign in to accept the invitation.",
        variant: "destructive",
      });
      return;
    }

    setAccepting(true);
    try {
      const { data, error: acceptError } = await supabase.rpc("accept_invitation", {
        invitation_token: token,
      });

      if (acceptError) {
        throw acceptError;
      }

      await refreshProfile();

      toast({
        title: "Invitation accepted!",
        description: `Welcome to ${invitation?.organization_name}`,
      });

      // Redirect to app
      navigate("/");
    } catch (err: any) {
      console.error("Error accepting invitation:", err);
      toast({
        title: "Failed to accept invitation",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation Error</CardTitle>
            <CardDescription>There was a problem with this invitation</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={() => navigate("/")} className="w-full mt-4" variant="outline">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  // Check if user needs to sign in
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
            <CardDescription>Please sign in to accept this invitation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                This invitation is for <strong>{invitation.email}</strong>
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
              You need to sign in with this email address to accept the invitation.
            </p>
            <Button onClick={() => navigate("/login")} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">You're Invited!</CardTitle>
          <CardDescription>Join {invitation.organization_name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-center">
            <p className="text-sm">
              You've been invited to join <strong>{invitation.organization_name}</strong> as a{" "}
              <strong>{invitation.role === "team_member" ? "Team Member" : "Organizer"}</strong>.
            </p>
          </div>

          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              You'll have access to the fund's workspace, documents, and decision logs.
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full"
          >
            {accepting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Accepting...
              </>
            ) : (
              "Accept Invitation"
            )}
          </Button>

          <Button
            onClick={() => navigate("/")}
            variant="ghost"
            className="w-full"
            disabled={accepting}
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
