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
  // Role used when submitting code (avoids race where profile hasn't refreshed yet)
  const [codeEntryRole, setCodeEntryRole] = useState<"managing_partner" | "team_member" | null>(null);

  useEffect(() => {
    // If user already has organization, redirect to CIS
    if (profile?.organization_id) {
      navigate("/cis");
      return;
    }

    // If user already selected role but no org, show appropriate step
    // Both MDs and team members enter codes now
    if ((profile?.role === "managing_partner" || profile?.role === "team_member") && !profile?.organization_id) {
      setStep("code_entry");
      setCodeEntryRole(profile.role as "managing_partner" | "team_member");
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

      setCodeEntryRole(role);
      setStep("code_entry");
    } catch (error: any) {
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
    setCodeEntryRole("managing_partner");
    setStep("code_entry");
  };

  const handleJoinFund = async () => {
    if (!invitationCode.trim()) {
      toast({
        title: "Code required",
        description: "Please enter the code you received.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await (supabase as any).rpc("join_by_code", {
        code_param: invitationCode.trim().toUpperCase(),
      });

      if (error) {
        throw error;
      }

      await refreshProfile();

      if (data?.message === "Fund created successfully") {
        setCreatedInvitationCode(data?.invitation_code ?? data?.organization?.invitation_code ?? null);
        setFundName(data?.organization?.name ?? "");
        setStep("fund_created");
      } else if (data?.organization?.name) {
        toast({
          title: "Welcome!",
          description: `You've joined ${data.organization.name}.`,
        });
        navigate("/cis");
      } else {
        toast({
          title: "Welcome!",
          description: "You've joined the fund.",
        });
        navigate("/cis");
      }
    } catch (error: any) {
      const msg =
        error?.message ||
        error?.details ||
        (typeof error === "string"
          ? error
          : "Invalid or inactive code. Managing Partners: use the fund code from admin. Team members: use the invitation code from your MD.");
      toast({
        title: "Could not join",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const cardClass = "w-full max-w-2xl border border-slate-700/60 bg-slate-900/50 backdrop-blur-sm rounded-2xl shadow-xl shadow-black/20 overflow-hidden";
  const cardHeaderClass = "text-center border-b border-slate-700/60 bg-slate-800/30 px-6 py-6";
  const btnPrimaryClass = "w-full rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold h-11 shadow-[0_2px_12px_-2px_rgba(245,158,11,0.4)]";
  const btnSecondaryClass = "w-full rounded-lg border-slate-600 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60 font-medium h-11";

  if (step === "fund_created" && createdInvitationCode) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 page-content">
        <Card className={cardClass}>
          <CardHeader className={cardHeaderClass}>
            <CardTitle className="text-2xl font-bold text-white">Fund Created Successfully!</CardTitle>
            <CardDescription className="text-slate-400 text-base mt-1">
              Share this invitation code with your team members
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <Alert className="border-amber-500/20 bg-amber-500/5 text-amber-200">
              <CheckCircle className="h-4 w-4 text-amber-400" />
              <AlertDescription>
                Your fund <strong>{fundName}</strong> has been created. Share the code below with your investment team.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label className="text-slate-300">Invitation Code</Label>
              <div className="flex gap-2">
                <Input
                  value={createdInvitationCode}
                  readOnly
                  className="font-mono text-xl text-center font-bold tracking-wider bg-slate-800/50 border-slate-600 text-white"
                />
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(createdInvitationCode); toast({ title: "Copied!", description: "Invitation code copied to clipboard." }); }} className={btnSecondaryClass + " shrink-0"}>
                  Copy
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Team members can enter this code when they sign up as "Team Member"
              </p>
            </div>

            <Button onClick={() => navigate("/cis")} className={btnPrimaryClass}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "code_entry") {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 page-content">
        <Card className={cardClass}>
          <CardHeader className={cardHeaderClass}>
            <CardTitle className="text-2xl font-bold text-white">
              Enter Your Code
            </CardTitle>
            <CardDescription className="text-slate-400 text-base mt-1">
              {(codeEntryRole || profile?.role) === "managing_partner"
                ? "Use the fund code from admin (e.g. FUND-1234) to create or join your fund"
                : "Use the invitation code from your Managing Partner (they get it after creating the fund)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <Alert className="border-amber-500/20 bg-amber-500/5 text-slate-300">
              <Key className="h-4 w-4 text-amber-400" />
              <AlertDescription>
                {(codeEntryRole || profile?.role) === "managing_partner"
                  ? "Fund code = from admin. First person to use it creates the fund; others join the same fund."
                  : "Invitation code = from your MD after they create the fund. It is different from the fund code."}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="invitation-code" className="text-slate-300">
                {(codeEntryRole || profile?.role) === "managing_partner" ? "Fund code" : "Invitation code"}
              </Label>
              <Input
                id="invitation-code"
                placeholder="e.g. FUND-1234"
                value={invitationCode}
                onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                disabled={isSaving}
                className="font-mono text-center text-lg tracking-wider bg-slate-800/50 border-slate-600 text-white"
              />
            </div>

            <Button onClick={handleJoinFund} disabled={isSaving || !invitationCode.trim()} className={btnPrimaryClass}>
              {isSaving ? "Processing..." : "Continue"}
            </Button>

            <Button variant="ghost" onClick={() => setStep("role_selection")} disabled={isSaving} className="w-full rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 h-11">
              Change Role
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 page-content">
      <Card className={cardClass}>
        <CardHeader className={cardHeaderClass}>
          <CardTitle className="text-2xl font-bold text-white">Welcome to Platform</CardTitle>
          <CardDescription className="text-slate-400 text-base mt-1">
            Choose your role to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Button
              variant="outline"
              className="h-auto p-6 flex flex-col items-center justify-center space-y-3 rounded-xl border border-slate-600 bg-slate-800/40 text-slate-200 hover:bg-slate-700/50 hover:border-amber-500/30 hover:text-white transition-all duration-200"
              onClick={() => handleRoleSelect("managing_partner")}
              disabled={isSaving}
            >
              <Briefcase className="h-12 w-12 text-amber-400" />
              <div className="text-center">
                <div className="font-semibold text-lg text-white">Managing Partner</div>
                <div className="text-sm text-slate-400 mt-1">
                  Create your fund and get an invitation code for your team
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-6 flex flex-col items-center justify-center space-y-3 rounded-xl border border-slate-600 bg-slate-800/40 text-slate-200 hover:bg-slate-700/50 hover:border-amber-500/30 hover:text-white transition-all duration-200"
              onClick={() => handleRoleSelect("team_member")}
              disabled={isSaving}
            >
              <Users className="h-12 w-12 text-amber-400" />
              <div className="text-center">
                <div className="font-semibold text-lg text-white">Investment Team Member</div>
                <div className="text-sm text-slate-400 mt-1">
                  Enter invitation code from your Managing Partner
                </div>
              </div>
            </Button>
          </div>

          <Separator className="bg-slate-700/60" />

          <Alert className="border-slate-600 bg-slate-800/30 text-slate-300">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <AlertDescription>
              <strong className="text-white">Managing Partners</strong> create the fund and receive an invitation code.
              <br />
              <strong className="text-white">Team Members</strong> enter the code to join their fund's workspace.
            </AlertDescription>
          </Alert>

          {isSaving && (
            <div className="text-center text-sm text-slate-400">
              Setting up your account...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
