import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Users } from "lucide-react";

export default function RoleSelection() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

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
      const { error } = await supabase
        .from("user_profiles")
        .update({ role })
        .eq("id", user.id);

      if (error) {
        throw error;
      }

      await refreshProfile();

      toast({
        title: "Role updated!",
        description: `You are now set as ${role === "managing_partner" ? "Managing Partner" : "Team Member"}.`,
      });

      // Small delay to ensure profile is refreshed
      await new Promise(resolve => setTimeout(resolve, 300));
      navigate("/");
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

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30">
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
                  Full access to all features and team management
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
                  Access to decision logging and document management
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
