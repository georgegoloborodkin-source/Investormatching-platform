import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { CorporatePartner, GEO_MARKETS, INDUSTRIES, PARTNERSHIP_TYPES, FUNDING_STAGES } from "@/types";

interface CorporateFormProps {
  corporate: CorporatePartner | null;
  industries: string[];
  onSave: (corporate: Omit<CorporatePartner, 'id'>) => void;
  onAddIndustry: (industry: string) => void;
  onCancel: () => void;
}

export function CorporateForm({ corporate, industries, onSave, onAddIndustry, onCancel }: CorporateFormProps) {
  const [formData, setFormData] = useState<Omit<CorporatePartner, 'id'>>({
    firmName: '',
    contactName: '',
    email: '',
    geoFocus: [],
    industryPreferences: [],
    partnershipTypes: [],
    stages: [],
    totalSlots: 3,
    availabilityStatus: 'present'
  });

  useEffect(() => {
    if (corporate) {
      setFormData({
        firmName: corporate.firmName,
        contactName: corporate.contactName,
        email: corporate.email,
        geoFocus: corporate.geoFocus,
        industryPreferences: corporate.industryPreferences,
        partnershipTypes: corporate.partnershipTypes,
        stages: corporate.stages,
        totalSlots: corporate.totalSlots,
        availabilityStatus: corporate.availabilityStatus
      });
    }
  }, [corporate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const toggleGeoFocus = (geo: string) => {
    setFormData(prev => ({
      ...prev,
      geoFocus: prev.geoFocus.includes(geo)
        ? prev.geoFocus.filter(g => g !== geo)
        : [...prev.geoFocus, geo]
    }));
  };

  const toggleIndustry = (industry: string) => {
    setFormData(prev => ({
      ...prev,
      industryPreferences: prev.industryPreferences.includes(industry)
        ? prev.industryPreferences.filter(i => i !== industry)
        : [...prev.industryPreferences, industry]
    }));
  };

  const togglePartnershipType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      partnershipTypes: prev.partnershipTypes.includes(type)
        ? prev.partnershipTypes.filter(t => t !== type)
        : [...prev.partnershipTypes, type]
    }));
  };

  const toggleStage = (stage: string) => {
    setFormData(prev => ({
      ...prev,
      stages: prev.stages.includes(stage)
        ? prev.stages.filter(s => s !== stage)
        : [...prev.stages, stage]
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <DialogHeader>
        <DialogTitle>{corporate ? 'Edit Corporate Partner' : 'Add New Corporate Partner'}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label htmlFor="firmName">Company Name *</Label>
          <Input
            id="firmName"
            value={formData.firmName}
            onChange={(e) => setFormData(prev => ({ ...prev, firmName: e.target.value }))}
            required
          />
        </div>

        <div>
          <Label htmlFor="contactName">Contact Name *</Label>
          <Input
            id="contactName"
            value={formData.contactName}
            onChange={(e) => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
            required
          />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          />
        </div>

        <div>
          <Label>Geographic Focus</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {GEO_MARKETS.map((geo) => (
              <Badge
                key={geo}
                variant={formData.geoFocus.includes(geo) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleGeoFocus(geo)}
              >
                {geo}
                {formData.geoFocus.includes(geo) && <X className="ml-1 h-3 w-3" />}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <Label>Industry Preferences</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {industries.map((industry) => (
              <Badge
                key={industry}
                variant={formData.industryPreferences.includes(industry) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleIndustry(industry)}
              >
                {industry}
                {formData.industryPreferences.includes(industry) && <X className="ml-1 h-3 w-3" />}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <Label>Partnership Types</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {PARTNERSHIP_TYPES.map((type) => (
              <Badge
                key={type}
                variant={formData.partnershipTypes.includes(type) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => togglePartnershipType(type)}
              >
                {type}
                {formData.partnershipTypes.includes(type) && <X className="ml-1 h-3 w-3" />}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <Label>Startup Stages of Interest</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {FUNDING_STAGES.map((stage) => (
              <Badge
                key={stage}
                variant={formData.stages.includes(stage) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleStage(stage)}
              >
                {stage}
                {formData.stages.includes(stage) && <X className="ml-1 h-3 w-3" />}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="totalSlots">Total Meeting Slots</Label>
          <Input
            id="totalSlots"
            type="number"
            min="0"
            value={formData.totalSlots}
            onChange={(e) => setFormData(prev => ({ ...prev, totalSlots: parseInt(e.target.value) || 0 }))}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {corporate ? 'Update' : 'Add'} Corporate
        </Button>
      </div>
    </form>
  );
}


