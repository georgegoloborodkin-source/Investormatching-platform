import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Users, AlertCircle, CheckCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

type OnboardingStep = "role_selection" | "fund_creation" | "team_member_waiting";

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
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [step, setStep] = useState<OnboardingStep>("role_selection");
  const [isSaving, setIsSaving] = useState(false);
  
  // Fund creation form state
  const [fundName, setFundName] = useState("");
  const [fundType, setFundType] = useState<string>("vc");
  const [website, setWebsite] = useState("");

  // Check if user came from invitation link
  const invitationToken = searchParams.get("token");

  useEffect(() => {
    // If user has invitation token, redirect to invitation acceptance
    if (invitationToken) {
      navigate(`/invite/${invitationToken}`);
      return;
    }

    // If user already has organization, redirect to app
    if (profile?.organization_id) {
      navigate("/");
      return;
    }

    // If user already selected role but no org, show appropriate step
    if (profile?.role === "managing_partner" && !profile?.organization_id) {
      setStep("fund_creation");
    } else if (profile?.role === "team_member" && !profile?.organization_id) {
      setStep("team_member_waiting");
    }
  }, [profile, invitationToken, navigate]);

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
        setStep("team_member_waiting");
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

      await refreshProfile();

      toast({
        title: "Fund created!",
        description: `Welcome to ${fundName}. You can now invite your team.`,
      });

      // Redirect to app
      navigate("/");
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

  if (step === "team_member_waiting") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Waiting for Invitation</CardTitle>
            <CardDescription className="text-base">
              You need an invitation from a Managing Partner to join a fund
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Team members cannot create their own fund. Please ask your Managing Partner
                to send you an invitation link.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Once you receive an invitation email, click the link to join your fund's workspace.
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => setStep("role_selection")}
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
            Please select your role to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Button
              variant="outline"
              className="h-auto p-6 flex flex-col items-center justify-center space-y-3"
              onClick={() => handleRoleSelect("managing_partner")}
              disabled={isSaving}
            >
              <Briefcase className="h-12 w-12 text-primary" />
              <div className="text-center">
                <div className="font-semibold text-lg">Managing Partner</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Create your fund and invite your team
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-6 flex flex-col items-center justify-center space-y-3"
              onClick={() => handleRoleSelect("team_member")}
              disabled={isSaving}
            >
              <Users className="h-12 w-12 text-primary" />
              <div className="text-center">
                <div className="font-semibold text-lg">Team Member</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Join via invitation from your fund
                </div>
              </div>
            </Button>
          </div>

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
