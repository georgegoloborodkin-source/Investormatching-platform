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

      // Redirect to CIS
      navigate("/cis");
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

  const cardClass = "w-full max-w-md border border-slate-700/60 bg-slate-900/50 backdrop-blur-sm rounded-2xl shadow-xl shadow-black/20 overflow-hidden";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 page-content">
        <Card className={cardClass}>
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
              <p className="text-sm text-slate-400">Loading invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 page-content">
        <Card className={cardClass}>
          <CardHeader className="border-b border-slate-700/60 bg-slate-800/30">
            <CardTitle className="text-white">Invitation Error</CardTitle>
            <CardDescription className="text-slate-400">There was a problem with this invitation</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Alert variant="destructive" className="border-red-500/30 bg-red-500/10">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={() => navigate("/orbit-stats")} className="w-full mt-4 rounded-lg border-slate-600 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60" variant="outline">
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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 page-content">
        <Card className={cardClass}>
          <CardHeader className="border-b border-slate-700/60 bg-slate-800/30">
            <CardTitle className="text-white">Sign In Required</CardTitle>
            <CardDescription className="text-slate-400">Please sign in to accept this invitation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <Alert className="border-amber-500/20 bg-amber-500/5 text-slate-300">
              <Mail className="h-4 w-4 text-amber-400" />
              <AlertDescription>
                This invitation is for <strong className="text-white">{invitation.email}</strong>
              </AlertDescription>
            </Alert>
            <p className="text-sm text-slate-500">
              You need to sign in with this email address to accept the invitation.
            </p>
            <Button onClick={() => navigate("/login")} className="w-full rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold h-11">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 page-content">
      <Card className={cardClass}>
        <CardHeader className="text-center border-b border-slate-700/60 bg-slate-800/30">
          <CardTitle className="text-2xl font-bold text-white">You're Invited!</CardTitle>
          <CardDescription className="text-slate-400">Join {invitation.organization_name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2 text-center">
            <p className="text-sm text-slate-300">
              You've been invited to join <strong className="text-white">{invitation.organization_name}</strong> as a{" "}
              <strong className="text-amber-400">{invitation.role === "team_member" ? "Team Member" : "Organizer"}</strong>.
            </p>
          </div>

          <Alert className="border-amber-500/20 bg-amber-500/5 text-slate-300">
            <CheckCircle className="h-4 w-4 text-amber-400" />
            <AlertDescription>
              You'll have access to the fund's workspace, documents, and decision logs.
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold h-11 shadow-[0_2px_12px_-2px_rgba(245,158,11,0.4)]"
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
            onClick={() => navigate("/cis")}
            variant="ghost"
            className="w-full rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 h-11"
            disabled={accepting}
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
