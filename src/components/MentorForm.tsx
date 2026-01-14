import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Mentor, GEO_MARKETS, INDUSTRIES, EXPERTISE_AREAS } from "@/types";

interface MentorFormProps {
  mentor: Mentor | null;
  industries: string[];
  onSave: (mentor: Omit<Mentor, 'id'>) => void;
  onAddIndustry: (industry: string) => void;
  onCancel: () => void;
}

export function MentorForm({ mentor, industries, onSave, onAddIndustry, onCancel }: MentorFormProps) {
  const [formData, setFormData] = useState<Omit<Mentor, 'id'>>({
    fullName: '',
    email: '',
    linkedinUrl: '',
    geoFocus: [],
    industryPreferences: [],
    expertiseAreas: [],
    totalSlots: 3,
    availabilityStatus: 'present'
  });

  useEffect(() => {
    if (mentor) {
      setFormData({
        fullName: mentor.fullName,
        email: mentor.email,
        linkedinUrl: mentor.linkedinUrl,
        geoFocus: mentor.geoFocus,
        industryPreferences: mentor.industryPreferences,
        expertiseAreas: mentor.expertiseAreas,
        totalSlots: mentor.totalSlots,
        availabilityStatus: mentor.availabilityStatus
      });
    }
  }, [mentor]);

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

  const toggleExpertise = (expertise: string) => {
    setFormData(prev => ({
      ...prev,
      expertiseAreas: prev.expertiseAreas.includes(expertise)
        ? prev.expertiseAreas.filter(e => e !== expertise)
        : [...prev.expertiseAreas, expertise]
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <DialogHeader>
        <DialogTitle>{mentor ? 'Edit Mentor' : 'Add New Mentor'}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label htmlFor="fullName">Full Name *</Label>
          <Input
            id="fullName"
            value={formData.fullName}
            onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
            required
          />
        </div>

        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            required
          />
        </div>

        <div>
          <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
          <Input
            id="linkedinUrl"
            type="url"
            value={formData.linkedinUrl}
            onChange={(e) => setFormData(prev => ({ ...prev, linkedinUrl: e.target.value }))}
            placeholder="https://linkedin.com/in/..."
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
          <Label>Expertise Areas</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {EXPERTISE_AREAS.map((expertise) => (
              <Badge
                key={expertise}
                variant={formData.expertiseAreas.includes(expertise) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleExpertise(expertise)}
              >
                {expertise}
                {formData.expertiseAreas.includes(expertise) && <X className="ml-1 h-3 w-3" />}
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
          {mentor ? 'Update' : 'Add'} Mentor
        </Button>
      </div>
    </form>
  );
}


