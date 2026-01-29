import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Mail, Copy, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function TeamInvitationForm() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"team_member" | "organizer">("team_member");
  const [isSending, setIsSending] = useState(false);
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isMD = profile?.role === "managing_partner" || profile?.role === "organizer";
  const orgId = profile?.organization_id;

  if (!isMD || !orgId) {
    return null;
  }

  const handleSendInvitation = async () => {
    if (!email.trim()) {
      toast({
        title: "Email required",
        description: "Please enter an email address.",
        variant: "destructive",
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      // Create invitation
      const { data, error } = await supabase
        .from("invitations")
        .insert({
          organization_id: orgId,
          invited_by: profile.id,
          email: email.trim().toLowerCase(),
          role: role,
        })
        .select("token")
        .single();

      if (error) {
        throw error;
      }

      // Generate invitation link
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/invite/${data.token}`;
      setInvitationLink(link);

      toast({
        title: "Invitation created!",
        description: "Copy the link below to send to your team member.",
      });

      setEmail("");
    } catch (err: any) {
      console.error("Error creating invitation:", err);
      toast({
        title: "Failed to create invitation",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const copyToClipboard = async () => {
    if (!invitationLink) return;
    await navigator.clipboard.writeText(invitationLink);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Invitation link copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite Team Members</CardTitle>
        <CardDescription>
          Send invitations to team members to join your fund
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email Address</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="team.member@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="invite-role">Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as typeof role)} disabled={isSending}>
            <SelectTrigger id="invite-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="team_member">Team Member</SelectItem>
              <SelectItem value="organizer">Organizer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleSendInvitation}
          disabled={isSending || !email.trim()}
          className="w-full"
        >
          {isSending ? "Creating..." : "Create Invitation Link"}
        </Button>

        {invitationLink && (
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <p className="font-medium">Invitation link created!</p>
              <div className="flex gap-2">
                <Input
                  value={invitationLink}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyToClipboard}
                >
                  {copied ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Send this link to {email || "the team member"}. They can click it to join your fund.
              </p>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
