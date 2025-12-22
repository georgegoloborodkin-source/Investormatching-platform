import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { TimeSlotConfig } from "@/types";
import { Clock, Plus, Trash2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TimeSlotManagerProps {
  timeSlots: TimeSlotConfig[];
  onUpdateTimeSlots: (slots: TimeSlotConfig[]) => void;
}

export function TimeSlotManager({ timeSlots, onUpdateTimeSlots }: TimeSlotManagerProps) {
  const { toast } = useToast();
  const [editingSlots, setEditingSlots] = useState<TimeSlotConfig[]>([...timeSlots]);
  const [hasChanges, setHasChanges] = useState(false);

  const addNewSlot = () => {
    const newSlot: TimeSlotConfig = {
      id: `slot-${Date.now()}`,
      label: `Slot ${editingSlots.length + 1}`,
      startTime: "09:00",
      endTime: "09:20",
      isDone: false,
      breakAfter: 5
    };
    const updated = [...editingSlots, newSlot];
    setEditingSlots(updated);
    setHasChanges(true);
  };

  const updateSlot = (index: number, field: keyof TimeSlotConfig, value: string | number) => {
    const updated = [...editingSlots];
    updated[index] = { ...updated[index], [field]: value };
    setEditingSlots(updated);
    setHasChanges(true);
  };


  const removeSlot = (index: number) => {
    const updated = editingSlots.filter((_, i) => i !== index);
    setEditingSlots(updated);
    setHasChanges(true);
  };

  const saveChanges = () => {
    // Validate time slots
    const isValid = editingSlots.every(slot => 
      slot.startTime && slot.endTime && slot.label.trim()
    );

    if (!isValid) {
      toast({
        title: "Invalid Time Slots",
        description: "Please ensure all time slots have valid start times, end times, and labels.",
        variant: "destructive"
      });
      return;
    }

    onUpdateTimeSlots(editingSlots);
    setHasChanges(false);
    toast({
      title: "Time Slots Updated",
      description: `${editingSlots.length} time slots configured successfully.`,
    });
  };

  const resetChanges = () => {
    setEditingSlots([...timeSlots]);
    setHasChanges(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Slot Configuration
          </div>
          <Badge variant="secondary">{editingSlots.length} slots</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {editingSlots.map((slot, index) => (
            <div key={slot.id} className="flex items-end gap-3 p-3 border rounded-lg">
              <div className="flex-1 space-y-2">
                <Label htmlFor={`label-${index}`}>Label</Label>
                <Input
                  id={`label-${index}`}
                  value={slot.label}
                  onChange={(e) => updateSlot(index, 'label', e.target.value)}
                  placeholder="e.g., Slot 1"
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor={`start-${index}`}>Start Time</Label>
                <Input
                  id={`start-${index}`}
                  type="time"
                  value={slot.startTime}
                  onChange={(e) => updateSlot(index, 'startTime', e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor={`end-${index}`}>End Time</Label>
                <Input
                  id={`end-${index}`}
                  type="time"
                  value={slot.endTime}
                  onChange={(e) => updateSlot(index, 'endTime', e.target.value)}
                />
              </div>
              <div className="w-24 space-y-2">
                <Label htmlFor={`break-${index}`}>Break (min)</Label>
                <Input
                  id={`break-${index}`}
                  type="number"
                  min="0"
                  max="60"
                  value={slot.breakAfter || 0}
                  onChange={(e) => updateSlot(index, 'breakAfter', parseInt(e.target.value) || 0)}
                  placeholder="5"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeSlot(index)}
                className="text-destructive hover:text-destructive"
                disabled={editingSlots.length <= 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={addNewSlot}>
            <Plus className="h-4 w-4 mr-2" />
            Add Time Slot
          </Button>
          
          {hasChanges && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetChanges} size="sm">
                Cancel
              </Button>
              <Button onClick={saveChanges} size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}