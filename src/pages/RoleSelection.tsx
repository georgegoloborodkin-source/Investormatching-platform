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
    if (profile?.role === "managing_partner" && !profile?.organization_id) {
      setStep("fund_creation");
    } else if (profile?.role === "team_member" && !profile?.organization_id) {
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

      // Navigate to appropriate step
      if (role === "managing_partner") {
        setStep("fund_creation");
      } else {
        setStep("code_entry");
      }
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
    if (!user || !profile) {
      toast({
        title: "Error",
        description: "Please sign in again.",
        variant: "destructive",
      });
      return;
    }

    if (!fundName.trim()) {
      toast({
        title: "Fund name required",
        description: "Please enter your fund name.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const fundSlug = slugifyOrgName(fundName) || `fund-${user.id.slice(0, 8)}`;
      
      const { data, error } = await supabase.rpc("create_fund_for_md", {
        fund_name: fundName.trim(),
        fund_slug: fundSlug,
        fund_type: fundType || null,
        website: website.trim() || null,
      });

      if (error) {
        throw error;
      }

      setCreatedInvitationCode(data?.invitation_code || data?.organization?.invitation_code || null);
      await refreshProfile();

      setStep("fund_created");
    } catch (error: any) {
      console.error("Error creating fund:", error);
      toast({
        title: "Failed to create fund",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleJoinFund = async () => {
    if (!invitationCode.trim()) {
      toast({
        title: "Code required",
        description: "Please enter the invitation code.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase.rpc("join_fund_by_code", {
        invitation_code: invitationCode.trim().toUpperCase(),
      });

      if (error) {
        throw error;
      }

      await refreshProfile();

      toast({
        title: "Welcome!",
        description: `You've joined ${data?.organization?.name || "the fund"}.`,
      });

      // Redirect to app
      navigate("/");
    } catch (error: any) {
      console.error("Error joining fund:", error);
      toast({
        title: "Failed to join fund",
        description: error.message || "Invalid invitation code. Please check and try again.",
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

  if (step === "fund_creation") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Create Your Fund</CardTitle>
            <CardDescription className="text-base">
              Set up your VC fund organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fund-name">Fund Name *</Label>
              <Input
                id="fund-name"
                placeholder="e.g., Orbit Ventures"
                value={fundName}
                onChange={(e) => setFundName(e.target.value)}
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fund-type">Fund Type</Label>
              <Select value={fundType} onValueChange={setFundType} disabled={isSaving}>
                <SelectTrigger id="fund-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vc">Venture Capital</SelectItem>
                  <SelectItem value="angel">Angel Fund</SelectItem>
                  <SelectItem value="syndicate">Syndicate</SelectItem>
                  <SelectItem value="family_office">Family Office</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website (optional)</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://yourfund.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                disabled={isSaving}
              />
            </div>

            <Button
              onClick={handleCreateFund}
              disabled={isSaving || !fundName.trim()}
              className="w-full"
            >
              {isSaving ? "Creating..." : "Create Fund"}
            </Button>

            <Button
              variant="ghost"
              onClick={() => setStep("role_selection")}
              disabled={isSaving}
              className="w-full"
            >
              Back
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
            <CardTitle className="text-2xl font-bold">Join Your Fund</CardTitle>
            <CardDescription className="text-base">
              Enter the invitation code from your Managing Partner
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Key className="h-4 w-4" />
              <AlertDescription>
                Ask your Managing Partner for the invitation code (e.g., ORBIT-1234)
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="invitation-code">Invitation Code</Label>
              <Input
                id="invitation-code"
                placeholder="ORBIT-1234"
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
              {isSaving ? "Joining..." : "Join Fund"}
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
          <CardTitle className="text-2xl font-bold">Welcome to Orbit AI</CardTitle>
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
