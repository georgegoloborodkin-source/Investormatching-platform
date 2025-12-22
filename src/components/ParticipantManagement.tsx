import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Edit, Plus } from "lucide-react";
import { Startup, Investor } from "@/types";
import { useToast } from "@/hooks/use-toast";

interface ParticipantManagementProps {
  startups: Startup[];
  investors: Investor[];
  onAddStartup: () => void;
  onAddInvestor: () => void;
  onEditStartup: (startup: Startup) => void;
  onEditInvestor: (investor: Investor) => void;
  onDeleteStartup: (id: string) => void;
  onDeleteInvestor: (id: string) => void;
}

export function ParticipantManagement({
  startups,
  investors,
  onAddStartup,
  onAddInvestor,
  onEditStartup,
  onEditInvestor,
  onDeleteStartup,
  onDeleteInvestor
}: ParticipantManagementProps) {
  const { toast } = useToast();

  const handleDeleteStartup = (id: string, name: string) => {
    if (window.confirm(`Delete ${name}? This action cannot be undone.`)) {
      onDeleteStartup(id);
      toast({
        title: "Startup Deleted",
        description: `${name} has been removed successfully.`,
      });
    }
  };

  const handleDeleteInvestor = (id: string, name: string) => {
    if (window.confirm(`Delete ${name}? This action cannot be undone.`)) {
      onDeleteInvestor(id);
      toast({
        title: "Investor Deleted", 
        description: `${name} has been removed successfully.`,
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Startups Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Startups ({startups.length})</CardTitle>
            <Button onClick={onAddStartup} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Startup
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {startups.map((startup) => (
              <div key={startup.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{startup.companyName}</h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Badge variant="outline" className="text-xs">{startup.industry}</Badge>
                    <Badge variant="secondary" className="text-xs">{startup.fundingStage}</Badge>
                    <Badge variant="outline" className="text-xs">
                      ${(startup.fundingTarget / 1000000).toFixed(1)}M
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {startup.geoMarkets.join(", ")}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditStartup(startup)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteStartup(startup.id, startup.companyName)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Investors Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Investors ({investors.length})</CardTitle>
            <Button onClick={onAddInvestor} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Investor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {investors.map((investor) => (
              <div key={investor.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{investor.firmName}</h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {investor.industryPreferences.map((industry) => (
                      <Badge key={industry} variant="outline" className="text-xs">{industry}</Badge>
                    ))}
                    <Badge variant="secondary" className="text-xs">{investor.totalSlots} slots</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ${(investor.minTicketSize / 1000000).toFixed(1)}M - ${(investor.maxTicketSize / 1000000).toFixed(1)}M
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {investor.geoFocus.join(", ")}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditInvestor(investor)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteInvestor(investor.id, investor.firmName)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}