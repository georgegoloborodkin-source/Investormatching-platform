import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, Plus } from "lucide-react";
import { Startup, GEO_MARKETS, FUNDING_STAGES } from "@/types";

interface StartupFormProps {
  startup?: Startup;
  industries: string[];
  onSave: (startup: Omit<Startup, 'id'>) => void;
  onAddIndustry: (industry: string) => void;
  onCancel: () => void;
}

export function StartupForm({ startup, industries, onSave, onAddIndustry, onCancel }: StartupFormProps) {
  const [formData, setFormData] = useState({
    companyName: startup?.companyName || '',
    geoMarkets: startup?.geoMarkets || [],
    industry: startup?.industry || '',
    fundingTarget: startup?.fundingTarget || 0,
    fundingStage: startup?.fundingStage || '',
  });

  const [showNewIndustryInput, setShowNewIndustryInput] = useState(false);
  const [newIndustry, setNewIndustry] = useState('');

  const handleGeoMarketChange = (market: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      geoMarkets: checked 
        ? [...prev.geoMarkets, market]
        : prev.geoMarkets.filter(m => m !== market)
    }));
  };

  const handleAddNewIndustry = () => {
    if (newIndustry.trim()) {
      onAddIndustry(newIndustry.trim());
      setFormData(prev => ({ ...prev, industry: newIndustry.trim() }));
      setNewIndustry('');
      setShowNewIndustryInput(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.companyName || !formData.industry || !formData.fundingStage) {
      return;
    }

    onSave({
      ...formData,
      availabilityStatus: 'present'
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {startup ? 'Edit Startup' : 'Add New Startup'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company-name">Company Name *</Label>
            <Input
              id="company-name"
              value={formData.companyName}
              onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
              placeholder="Enter company name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Geographic Markets *</Label>
            <div className="grid grid-cols-2 gap-2">
              {GEO_MARKETS.map((market) => (
                <div key={market} className="flex items-center space-x-2">
                  <Checkbox
                    id={`geo-${market}`}
                    checked={formData.geoMarkets.includes(market)}
                    onCheckedChange={(checked) => 
                      handleGeoMarketChange(market, checked as boolean)
                    }
                  />
                  <Label htmlFor={`geo-${market}`} className="text-sm font-normal">
                    {market}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry">Industry *</Label>
            <Select 
              value={formData.industry} 
              onValueChange={(value) => {
                if (value === 'add-new') {
                  setShowNewIndustryInput(true);
                } else {
                  setFormData(prev => ({ ...prev, industry: value }));
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                {industries.map((industry) => (
                  <SelectItem key={industry} value={industry}>
                    {industry}
                  </SelectItem>
                ))}
                <SelectItem value="add-new" className="text-primary">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add new industry
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            
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
            <Label htmlFor="funding-target">Funding Target ($)</Label>
            <Input
              id="funding-target"
              type="number"
              value={formData.fundingTarget}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                fundingTarget: parseInt(e.target.value) || 0 
              }))}
              placeholder="Enter funding target"
              min="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="funding-stage">Funding Stage *</Label>
            <Select 
              value={formData.fundingStage} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, fundingStage: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select funding stage" />
              </SelectTrigger>
              <SelectContent>
                {FUNDING_STAGES.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {stage}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              {startup ? 'Update Startup' : 'Add Startup'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}