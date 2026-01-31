import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Users, AlertCircle, CheckCircle, Key } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

type OnboardingStep = "role_selection" | "fund_creation" | "code_entry" | "fund_created";

function slugifyOrgName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 50);
}

export default function RoleSelection() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<OnboardingStep>("role_selection");
  const [isSaving, setIsSaving] = useState(false);
  
  // Fund creation form state
  const [fundName, setFundName] = useState("");
  const [fundType, setFundType] = useState<string>("vc");
  const [website, setWebsite] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [createdInvitationCode, setCreatedInvitationCode] = useState<string | null>(null);

  useEffect(() => {
    // If user already has organization, redirect to app
    if (profile?.organization_id) {
      navigate("/");
      return;
    }

    // If user already selected role but no org, show appropriate step
    // Both MDs and team members enter codes now
    if ((profile?.role === "managing_partner" || profile?.role === "team_member") && !profile?.organization_id) {
      setStep("code_entry");
    }
  }, [profile, navigate]);

  const handleRoleSelect = async (role: "managing_partner" | "team_member") => {
    if (!user || !profile) {
      toast({
        title: "Error",
        description: "Please sign in again.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Update role
      const { error } = await supabase
        .from("user_profiles")
        .update({ role })
        .eq("id", user.id);

      if (error) {
        throw error;
      }

      await refreshProfile();

      // Both MDs and team members enter codes
      setStep("code_entry");
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast({
        title: "Failed to update role",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateFund = async () => {
    // MDs now enter fund code (created by admin), not create fund directly
    setStep("code_entry");
  };

  const handleJoinFund = async () => {
    if (!invitationCode.trim()) {
      toast({
        title: "Code required",
        description: "Please enter the fund code.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // For MDs: use fund code to create/join fund
      // For team members: use invitation code to join
      const { data, error } = await supabase.rpc("join_fund_by_code", {
        code_param: invitationCode.trim().toUpperCase(),
      });

      if (error) {
        throw error;
      }

      await refreshProfile();

      if (profile?.role === "managing_partner") {
        // MD created/joined fund
        setCreatedInvitationCode(data?.invitation_code || data?.organization?.invitation_code || null);
        if (data?.message === "Fund created successfully") {
          setStep("fund_created");
        } else {
          toast({
            title: "Welcome!",
            description: `You've joined ${data?.organization?.name || "the fund"}.`,
          });
          navigate("/");
        }
      } else {
        // Team member joined
        toast({
          title: "Welcome!",
          description: `You've joined ${data?.organization?.name || "the fund"}.`,
        });
        navigate("/");
      }
    } catch (error: any) {
      console.error("Error joining fund:", error);
      toast({
        title: "Failed to join fund",
        description: error.message || "Invalid fund code. Please check and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (step === "fund_created" && createdInvitationCode) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Fund Created Successfully!</CardTitle>
            <CardDescription className="text-base">
              Share this invitation code with your team members
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Your fund <strong>{fundName}</strong> has been created. Share the code below with your investment team.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Invitation Code</Label>
              <div className="flex gap-2">
                <Input
                  value={createdInvitationCode}
                  readOnly
                  className="font-mono text-2xl text-center font-bold tracking-wider"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(createdInvitationCode);
                    toast({
                      title: "Copied!",
                      description: "Invitation code copied to clipboard.",
                    });
                  }}
                >
                  Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Team members can enter this code when they sign up as "Team Member"
              </p>
            </div>

            <Button
              onClick={() => navigate("/")}
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  if (step === "code_entry") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              {profile?.role === "managing_partner" ? "Enter Fund Code" : "Join Your Fund"}
            </CardTitle>
            <CardDescription className="text-base">
              {profile?.role === "managing_partner" 
                ? "Enter the fund code provided by admin to create or join your fund"
                : "Enter the invitation code from your Managing Partner"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Key className="h-4 w-4" />
              <AlertDescription>
                {profile?.role === "managing_partner"
                  ? "Contact admin to get your fund code (e.g., VOS-1234). First MD to use it creates the fund."
                  : "Ask your Managing Partner for the invitation code (e.g., VOS-1234)"}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="invitation-code">
                {profile?.role === "managing_partner" ? "Fund Code" : "Invitation Code"}
              </Label>
              <Input
                id="invitation-code"
                placeholder="VOS-1234"
                value={invitationCode}
                onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                disabled={isSaving}
                className="font-mono text-center text-lg tracking-wider"
              />
            </div>

            <Button
              onClick={handleJoinFund}
              disabled={isSaving || !invitationCode.trim()}
              className="w-full"
            >
              {isSaving 
                ? "Processing..." 
                : profile?.role === "managing_partner" 
                  ? "Create/Join Fund" 
                  : "Join Fund"}
            </Button>

            <Button
              variant="ghost"
              onClick={() => setStep("role_selection")}
              disabled={isSaving}
              className="w-full"
            >
              Change Role
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome to VentureOS</CardTitle>
          <CardDescription className="text-base">
            Choose your role to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Button
              variant="outline"
              className="h-auto p-6 flex flex-col items-center justify-center space-y-3 border-2"
              onClick={() => handleRoleSelect("managing_partner")}
              disabled={isSaving}
            >
              <Briefcase className="h-12 w-12 text-primary" />
              <div className="text-center">
                <div className="font-semibold text-lg">Managing Partner</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Create your fund and get an invitation code for your team
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-6 flex flex-col items-center justify-center space-y-3 border-2"
              onClick={() => handleRoleSelect("team_member")}
              disabled={isSaving}
            >
              <Users className="h-12 w-12 text-primary" />
              <div className="text-center">
                <div className="font-semibold text-lg">Investment Team Member</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Enter invitation code from your Managing Partner
                </div>
              </div>
            </Button>
          </div>

          <Separator />

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Managing Partners</strong> create the fund and receive an invitation code.
              <br />
              <strong>Team Members</strong> enter the code to join their fund's workspace.
            </AlertDescription>
          </Alert>

          {isSaving && (
            <div className="text-center text-sm text-muted-foreground">
              Setting up your account...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
