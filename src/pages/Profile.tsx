import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InvestorAvailability } from "@/components/InvestorAvailability";
import { Loader2, Save, LogOut, User as UserIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState(profile?.role || "team_member");
  const [saving, setSaving] = useState(false);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setRole(profile.role || "team_member");
    }
  }, [profile]);

  useEffect(() => {
    const loadEvents = async () => {
      if (!profile?.organization_id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('status', 'active')
          .order('date', { ascending: false });

        if (error) throw error;
        setEvents(data || []);
        if (data && data.length > 0) {
          setActiveEventId(data[0].id);
        }
      } catch (error: any) {
        console.error("Error loading events:", error);
        toast({
          title: "Error loading events",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, [profile, toast]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ full_name: fullName, role })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      toast({
        title: "Profile updated!",
        description: "Your profile has been saved.",
      });
    } catch (error: any) {
      toast({
        title: "Error saving profile",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleCreateProfile = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from("user_profiles").insert({
        id: user.id,
        email: user.email,
        full_name: (user.user_metadata as any)?.full_name || (user.user_metadata as any)?.name || "",
        role: "team_member",
      });
      if (error) throw error;
      await refreshProfile();
    } catch (error: any) {
      toast({
        title: "Profile setup failed",
        description: error.message || "Could not create profile record.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <Card className="w-full max-w-md border border-slate-700/60 bg-slate-900/50 backdrop-blur-sm rounded-2xl shadow-xl shadow-black/20">
          <CardContent className="pt-8 pb-8">
            <p className="text-center text-slate-400 mb-6">
              Please sign in to view your profile.
            </p>
            <div className="space-y-3">
              <Button onClick={() => navigate("/login")} className="w-full rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold h-11">
                Sign In
              </Button>
              {user ? (
                <Button variant="outline" onClick={handleCreateProfile} className="w-full rounded-lg border-slate-600 text-slate-200 hover:bg-slate-800 h-11">
                  Fix Profile
                </Button>
              ) : null}
              <Button variant="ghost" onClick={handleSignOut} className="w-full rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 h-11">
                Log out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 page-content">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">My Profile</h1>
            <p className="text-slate-400 text-sm mt-1">
              Manage your account and availability
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="rounded-lg border-slate-600 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60 hover:border-slate-500 font-semibold self-start sm:self-auto"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border border-slate-700/60 bg-slate-900/40 backdrop-blur-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-700/60 bg-slate-800/30">
              <CardTitle className="flex items-center gap-2 text-white font-semibold">
                <UserIcon className="h-5 w-5 text-amber-400" />
                Profile Information
              </CardTitle>
              <CardDescription className="text-slate-400 text-sm">
                Update your personal information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <Input
                  id="email"
                  value={user.email || ""}
                  disabled
                  className="bg-slate-800/50 border-slate-600 text-slate-300"
                />
                <p className="text-xs text-slate-500">
                  Email is managed by your Google account
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-slate-300">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="bg-slate-800/50 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    <SelectItem value="managing_partner" className="text-white focus:bg-slate-700">Managing Partner</SelectItem>
                    <SelectItem value="team_member" className="text-white focus:bg-slate-700">Team Member</SelectItem>
                    <SelectItem value="organizer" className="text-white focus:bg-slate-700">Organizer</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Role controls access to org data and workflows.
                </p>
              </div>

              <Separator className="bg-slate-700/60" />

              <Button
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold h-11 shadow-[0_2px_12px_-2px_rgba(245,158,11,0.4)]"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {profile.role === 'investor' && (
            <Card className="border border-slate-700/60 bg-slate-900/40 backdrop-blur-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-slate-700/60 bg-slate-800/30">
                <CardTitle className="text-white font-semibold">Time Slot Availability</CardTitle>
                <CardDescription className="text-slate-400 text-sm">
                  Set which time slots you're available for meetings
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {events.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <p>No active events found.</p>
                    <p className="text-sm mt-2">
                      Contact your organizer to create an event.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {events.length > 1 && (
                      <div className="space-y-2">
                        <Label className="text-slate-300">Select Event</Label>
                        <select
                          className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-600 text-white"
                          value={activeEventId || ""}
                          onChange={(e) => setActiveEventId(e.target.value)}
                        >
                          {events.map((event) => (
                            <option key={event.id} value={event.id}>
                              {event.name} {event.date ? `(${new Date(event.date).toLocaleDateString()})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {activeEventId && (
                      <InvestorAvailability eventId={activeEventId} />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

