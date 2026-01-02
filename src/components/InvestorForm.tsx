import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Plus } from "lucide-react";
import { Investor, FUNDING_STAGES, GEO_MARKETS, TimeSlotConfig } from "@/types";

interface InvestorFormProps {
  investor?: Investor;
  timeSlots: TimeSlotConfig[];
  industries: string[];
  onSave: (investor: Omit<Investor, 'id'>) => void;
  onAddIndustry: (industry: string) => void;
  onCancel: () => void;
}

export function InvestorForm({ investor, timeSlots, industries, onSave, onAddIndustry, onCancel }: InvestorFormProps) {
  const [formData, setFormData] = useState({
    firmName: investor?.firmName || '',
    memberName: investor?.memberName || '',
    geoFocus: investor?.geoFocus || [],
    industryPreferences: investor?.industryPreferences || [],
    stagePreferences: investor?.stagePreferences || [],
    minTicketSize: investor?.minTicketSize || 0,
    maxTicketSize: investor?.maxTicketSize || 0,
    totalSlots: investor?.totalSlots || 3,
    tableNumber: investor?.tableNumber || '',
    availabilityStatus: investor?.availabilityStatus || 'present' as const
  });

  const [slotAvailability, setSlotAvailability] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    timeSlots.forEach(ts => {
      const existing = investor?.slotAvailability?.[ts.id];
      map[ts.id] = existing !== false; // default available
    });
    return map;
  });

  const [showNewIndustryInput, setShowNewIndustryInput] = useState(false);
  const [newIndustry, setNewIndustry] = useState('');

  const handleSlotAvailabilityChange = (slotId: string, checked: boolean) => {
    setSlotAvailability(prev => ({ ...prev, [slotId]: checked }));
  };

  const handleGeoFocusChange = (geo: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      geoFocus: checked 
        ? [...prev.geoFocus, geo]
        : prev.geoFocus.filter(g => g !== geo)
    }));
  };

  const handleIndustryChange = (industry: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      industryPreferences: checked
        ? [...prev.industryPreferences, industry]
        : prev.industryPreferences.filter(i => i !== industry)
    }));
  };

  const handleStageChange = (stage: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      stagePreferences: checked
        ? [...prev.stagePreferences, stage]
        : prev.stagePreferences.filter(s => s !== stage)
    }));
  };

  const handleAddNewIndustry = () => {
    if (newIndustry.trim()) {
      onAddIndustry(newIndustry.trim());
      setFormData(prev => ({
        ...prev,
        industryPreferences: [...prev.industryPreferences, newIndustry.trim()]
      }));
      setNewIndustry('');
      setShowNewIndustryInput(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firmName.trim()) {
      alert('Please enter firm name');
      return;
    }

    if (!formData.memberName.trim()) {
      alert('Please enter investor member name');
      return;
    }
    
    if (formData.geoFocus.length === 0) {
      alert('Please select at least one geographic focus');
      return;
    }
    
    if (formData.industryPreferences.length === 0) {
      alert('Please select at least one industry preference');
      return;
    }

    if (formData.stagePreferences.length === 0) {
      alert('Please select at least one funding stage preference');
      return;
    }
    
    onSave({ ...formData, slotAvailability });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {investor ? 'Edit Investor' : 'Add New Investor'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="firm-name">Firm Name *</Label>
            <Input
              id="firm-name"
              value={formData.firmName}
              onChange={(e) => setFormData(prev => ({ ...prev, firmName: e.target.value }))}
              placeholder="Enter firm name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-name">Investor Member Name *</Label>
            <Input
              id="member-name"
              value={formData.memberName}
              onChange={(e) => setFormData(prev => ({ ...prev, memberName: e.target.value }))}
              placeholder="e.g., Jane Doe"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Geographic Focus *</Label>
            <div className="grid grid-cols-2 gap-2">
              {GEO_MARKETS.map((geo) => (
                <div key={geo} className="flex items-center space-x-2">
                  <Checkbox
                    id={`geo-focus-${geo}`}
                    checked={formData.geoFocus.includes(geo)}
                    onCheckedChange={(checked) => 
                      handleGeoFocusChange(geo, checked as boolean)
                    }
                  />
                  <Label htmlFor={`geo-focus-${geo}`} className="text-sm font-normal">
                    {geo}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Industry Preferences *</Label>
            <div className="grid grid-cols-2 gap-2">
              {industries.map((industry) => (
                <div key={industry} className="flex items-center space-x-2">
                  <Checkbox
                    id={`industry-${industry}`}
                    checked={formData.industryPreferences.includes(industry)}
                    onCheckedChange={(checked) => 
                      handleIndustryChange(industry, checked as boolean)
                    }
                  />
                  <Label htmlFor={`industry-${industry}`} className="text-sm font-normal">
                    {industry}
                  </Label>
                </div>
              ))}
            </div>
            
            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowNewIndustryInput(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add new industry
              </Button>
            </div>
            
            {showNewIndustryInput && (
              <div className="flex gap-2">
                <Input
                  value={newIndustry}
                  onChange={(e) => setNewIndustry(e.target.value)}
                  placeholder="Enter new industry"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddNewIndustry()}
                />
                <Button
                  type="button"
                  onClick={handleAddNewIndustry}
                  size="sm"
                >
                  Add
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowNewIndustryInput(false);
                    setNewIndustry('');
                  }}
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Funding Stage Preferences *</Label>
            <div className="grid grid-cols-2 gap-2">
              {FUNDING_STAGES.map((stage) => (
                <div key={stage} className="flex items-center space-x-2">
                  <Checkbox
                    id={`stage-${stage}`}
                    checked={formData.stagePreferences.includes(stage)}
                    onCheckedChange={(checked) => 
                      handleStageChange(stage, checked as boolean)
                    }
                  />
                  <Label htmlFor={`stage-${stage}`} className="text-sm font-normal">
                    {stage}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min-ticket">Min Ticket Size ($)</Label>
              <Input
                id="min-ticket"
                type="number"
                value={formData.minTicketSize}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  minTicketSize: parseInt(e.target.value) || 0 
                }))}
                placeholder="Minimum investment"
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-ticket">Max Ticket Size ($)</Label>
              <Input
                id="max-ticket"
                type="number"
                value={formData.maxTicketSize}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  maxTicketSize: parseInt(e.target.value) || 0 
                }))}
                placeholder="Maximum investment"
                min="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Slot Availability</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {timeSlots.map((ts) => (
                <div key={ts.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`slot-${ts.id}`}
                    checked={slotAvailability[ts.id]}
                    onCheckedChange={(checked) => 
                      handleSlotAvailabilityChange(ts.id, checked as boolean)
                    }
                  />
                  <Label htmlFor={`slot-${ts.id}`} className="text-sm font-normal">
                    {ts.label} ({ts.startTime}–{ts.endTime})
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="total-slots">Available Meeting Slots</Label>
              <Input
                id="total-slots"
                type="number"
                value={formData.totalSlots}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  totalSlots: parseInt(e.target.value) || 3 
                }))}
                placeholder="Number of meetings"
                min="1"
                max="10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="table-number">Table Number</Label>
              <Input
                id="table-number"
                value={formData.tableNumber}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  tableNumber: e.target.value 
                }))}
                placeholder="e.g., A1, B2, Table 5"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              {investor ? 'Update Investor' : 'Add Investor'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}