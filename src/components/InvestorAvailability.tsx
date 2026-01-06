import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

interface TimeSlot {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
  is_done: boolean;
}

interface InvestorAvailabilityProps {
  eventId: string;
  investorId?: string; // If provided, edit this investor's availability
}

export function InvestorAvailability({ eventId, investorId }: InvestorAvailabilityProps) {
  const { toast } = useToast();
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  // Load time slots for event
  useEffect(() => {
    const loadSlots = async () => {
      try {
        const { data, error } = await supabase
          .from('time_slots')
          .select('*')
          .eq('event_id', eventId)
          .order('start_time', { ascending: true });

        if (error) throw error;
        setSlots(data || []);
      } catch (error: any) {
        toast({
          title: "Error loading time slots",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      loadSlots();
    }
  }, [eventId, toast]);

  // Load existing availability
  useEffect(() => {
    const loadAvailability = async () => {
      if (!eventId) return;

      try {
        let query = supabase
          .from('investors')
          .select('slot_availability')
          .eq('event_id', eventId);

        if (investorId) {
          query = query.eq('id', investorId);
        } else if (userId) {
          query = query.eq('user_id', userId);
        } else {
          return;
        }

        const { data, error } = await query.single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data?.slot_availability) {
          setAvailability(data.slot_availability);
        } else {
          // Default: all slots available
          const defaultAvailability: Record<string, boolean> = {};
          slots.forEach(slot => {
            defaultAvailability[slot.id] = true;
          });
          setAvailability(defaultAvailability);
        }
      } catch (error: any) {
        console.error("Error loading availability:", error);
      }
    };

    if (slots.length > 0 && (investorId || userId)) {
      loadAvailability();
    }
  }, [eventId, investorId, userId, slots]);

  // Save availability
  const saveAvailability = async () => {
    if (!eventId) return;

    setSaving(true);
    try {
      let query = supabase
        .from('investors')
        .update({ slot_availability: availability })
        .eq('event_id', eventId);

      if (investorId) {
        query = query.eq('id', investorId);
      } else if (userId) {
        query = query.eq('user_id', userId);
      } else {
        throw new Error("No investor ID or user ID provided");
      }

      const { error } = await query;

      if (error) throw error;

      toast({
        title: "Availability saved!",
        description: "Your time slot preferences have been updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error saving availability",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleSlot = (slotId: string) => {
    setAvailability(prev => ({
      ...prev,
      [slotId]: !prev[slotId],
    }));
  };

  const selectAll = () => {
    const allAvailable: Record<string, boolean> = {};
    slots.forEach(slot => {
      allAvailable[slot.id] = true;
    });
    setAvailability(allAvailable);
  };

  const deselectAll = () => {
    const allUnavailable: Record<string, boolean> = {};
    slots.forEach(slot => {
      allUnavailable[slot.id] = false;
    });
    setAvailability(allUnavailable);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Set Your Availability</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAll}>
              Deselect All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No time slots have been created for this event yet.
          </p>
        ) : (
          <>
            <div className="space-y-3">
              {slots.map(slot => (
                <div
                  key={slot.id}
                  className="flex items-center space-x-3 p-3 border rounded-md hover:bg-muted/50"
                >
                  <Checkbox
                    id={slot.id}
                    checked={availability[slot.id] ?? true}
                    onCheckedChange={() => toggleSlot(slot.id)}
                    disabled={slot.is_done}
                  />
                  <Label
                    htmlFor={slot.id}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{slot.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {slot.start_time} - {slot.end_time}
                      </span>
                    </div>
                    {slot.is_done && (
                      <span className="text-xs text-muted-foreground ml-2">
                        (Slot completed)
                      </span>
                    )}
                  </Label>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={saveAvailability} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Availability
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

