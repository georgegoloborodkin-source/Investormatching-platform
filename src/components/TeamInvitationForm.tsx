import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Key, Copy, CheckCircle, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function TeamInvitationForm() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [invitationCode, setInvitationCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const isMD = profile?.role === "managing_partner" || profile?.role === "organizer";
  const orgId = profile?.organization_id;

  useEffect(() => {
    if (isMD && orgId) {
      loadInvitationCode();
    }
  }, [isMD, orgId]);

  const loadInvitationCode = async () => {
    if (!orgId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("invitation_code")
        .eq("id", orgId)
        .single();

      if (error) {
        throw error;
      }

      setInvitationCode(data?.invitation_code || null);
    } catch (err: any) {
      console.error("Error loading invitation code:", err);
      toast({
        title: "Failed to load invitation code",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!invitationCode) return;
    await navigator.clipboard.writeText(invitationCode);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Invitation code copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isMD || !orgId) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invitation Code</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Invite Your Team
        </CardTitle>
        <CardDescription>
          Share this invitation code with your investment team members
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {invitationCode ? (
          <>
            <Alert>
              <Key className="h-4 w-4" />
              <AlertDescription>
                Team members should select "Investment Team Member" during signup and enter this code.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Your Fund's Invitation Code</Label>
              <div className="flex gap-2">
                <Input
                  value={invitationCode}
                  readOnly
                  className="font-mono text-xl text-center font-bold tracking-wider"
                />
                <Button
                  variant="outline"
                  onClick={copyToClipboard}
                  className="min-w-[100px]"
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
                Share this code via email, Slack, or any communication channel. Team members will enter it when they sign up.
              </p>
            </div>
          </>
        ) : (
          <Alert variant="destructive">
            <AlertDescription>
              No invitation code found. Please contact support if this persists.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
