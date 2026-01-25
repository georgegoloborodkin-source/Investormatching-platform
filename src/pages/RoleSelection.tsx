import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getClickUpLists } from "@/utils/ingestionClient";

export default function RoleSelection() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [clickUpTeamId, setClickUpTeamId] = useState("");
  const [clickUpLists, setClickUpLists] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedListId, setSelectedListId] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("clickup_list_id") || "";
  });
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [clickUpLink, setClickUpLink] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("clickup_list_url") || "";
  });

  const parseClickUpListId = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/list\/(\d+)/i) || trimmed.match(/\/l\/(\d+)/i);
    if (match?.[1]) return match[1];
    if (/^\d+$/.test(trimmed)) return trimmed;
    return null;
  };

  const handleLoadLists = async () => {
    if (!clickUpTeamId.trim()) {
      toast({
        title: "Missing team ID",
        description: "Enter your ClickUp team ID to load lists.",
        variant: "destructive",
      });
      return;
    }
    setIsLoadingLists(true);
    try {
      const response = await getClickUpLists(clickUpTeamId.trim());
      setClickUpLists(response.lists || []);
    } catch (error: any) {
      toast({
        title: "Failed to load ClickUp lists",
        description: error.message || "Please verify your team ID and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLists(false);
    }
  };

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
      const listId = selectedListId || parseClickUpListId(clickUpLink);
      if (typeof window !== "undefined") {
        localStorage.setItem("clickup_list_url", clickUpLink.trim());
        if (listId) {
          localStorage.setItem("clickup_list_id", listId);
        }
      }
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
          <div className="space-y-3">
            <div className="text-sm font-medium">Optional: Connect ClickUp</div>
            <div className="grid gap-2 md:grid-cols-3">
              <Input
                placeholder="ClickUp team ID"
                value={clickUpTeamId}
                onChange={(e) => setClickUpTeamId(e.target.value)}
                disabled={isSaving || isLoadingLists}
              />
              <Button
                variant="outline"
                onClick={handleLoadLists}
                disabled={isSaving || isLoadingLists}
              >
                {isLoadingLists ? "Loading lists..." : "Load Lists"}
              </Button>
              <Select
                value={selectedListId}
                onValueChange={(value) => {
                  setSelectedListId(value);
                  if (typeof window !== "undefined") {
                    localStorage.setItem("clickup_list_id", value);
                  }
                }}
                disabled={isSaving || isLoadingLists || clickUpLists.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a ClickUp list" />
                </SelectTrigger>
                <SelectContent>
                  {clickUpLists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Or paste ClickUp list URL/ID (optional)"
              value={clickUpLink}
              onChange={(e) => setClickUpLink(e.target.value)}
              disabled={isSaving}
            />
            <div className="text-xs text-muted-foreground">
              We’ll use this list for ingestion later. You can change it in Sources.
            </div>
          </div>
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
