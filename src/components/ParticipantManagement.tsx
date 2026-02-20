import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Edit, Plus } from "lucide-react";
import { Startup, Investor, Mentor, CorporatePartner } from "@/types";
import { useToast } from "@/hooks/use-toast";

interface ParticipantManagementProps {
  startups: Startup[];
  investors: Investor[];
  mentors: Mentor[];
  corporates: CorporatePartner[];
  onAddStartup: () => void;
  onAddInvestor: () => void;
  onAddMentor: () => void;
  onAddCorporate: () => void;
  onEditStartup: (startup: Startup) => void;
  onEditInvestor: (investor: Investor) => void;
  onEditMentor: (mentor: Mentor) => void;
  onEditCorporate: (corporate: CorporatePartner) => void;
  onDeleteStartup: (id: string) => void;
  onDeleteInvestor: (id: string) => void;
  onDeleteMentor: (id: string) => void;
  onDeleteCorporate: (id: string) => void;
}

export function ParticipantManagement({
  startups,
  investors,
  mentors,
  corporates,
  onAddStartup,
  onAddInvestor,
  onAddMentor,
  onAddCorporate,
  onEditStartup,
  onEditInvestor,
  onEditMentor,
  onEditCorporate,
  onDeleteStartup,
  onDeleteInvestor,
  onDeleteMentor,
  onDeleteCorporate
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

  const handleDeleteMentor = (id: string, name: string) => {
    if (window.confirm(`Delete ${name}? This action cannot be undone.`)) {
      onDeleteMentor(id);
      toast({
        title: "Mentor Deleted",
        description: `${name} has been removed successfully.`,
      });
    }
  };

  const handleDeleteCorporate = (id: string, name: string) => {
    if (window.confirm(`Delete ${name}? This action cannot be undone.`)) {
      onDeleteCorporate(id);
      toast({
        title: "Corporate Deleted",
        description: `${name} has been removed successfully.`,
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Startups Management */}
      <Card className="border-2 border-white bg-transparent">
        <CardHeader className="border-b-2 border-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white font-mono font-black uppercase tracking-tight">Startups ({startups.length})</CardTitle>
            <Button onClick={onAddStartup} size="sm" className="bg-[#3b82f6] text-black hover:bg-[#3b82f6]/80 font-bold border-2 border-[#3b82f6] transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]">
              <Plus className="h-4 w-4 mr-2" />
              Add Startup
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-white">
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {startups.map((startup) => (
              <div key={startup.id} className="flex items-center justify-between p-3 border-2 border-white rounded-lg bg-transparent hover:border-[#3b82f6] hover:bg-[#3b82f6]/5 transition-all">
                <div className="flex-1 min-w-0">
                  <h4 className="font-mono font-bold truncate text-white">{startup.companyName}</h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Badge variant="outline" className="text-xs border-white text-white bg-transparent">{startup.industry}</Badge>
                    <Badge variant="outline" className="text-xs border-[#3b82f6] text-[#3b82f6] bg-transparent">{startup.fundingStage}</Badge>
                    <Badge variant="outline" className="text-xs border-white text-white bg-transparent">
                      ${(startup.fundingTarget / 1000000).toFixed(1)}M
                    </Badge>
                  </div>
                  <div className="text-xs text-white/70 mt-1 truncate font-mono">
                    {startup.geoMarkets.join(", ")}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditStartup(startup)}
                    className="text-white hover:text-[#3b82f6] hover:bg-white/10"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteStartup(startup.id, startup.companyName)}
                    className="text-white/70 hover:text-white hover:bg-white/10"
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
      <Card className="border-2 border-white bg-transparent">
        <CardHeader className="border-b-2 border-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white font-mono font-black uppercase tracking-tight">Investors ({investors.length})</CardTitle>
            <Button onClick={onAddInvestor} size="sm" className="bg-[#3b82f6] text-black hover:bg-[#3b82f6]/80 font-bold border-2 border-[#3b82f6] transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]">
              <Plus className="h-4 w-4 mr-2" />
              Add Investor
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-white">
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {investors.map((investor) => (
              <div key={investor.id} className="flex items-center justify-between p-3 border-2 border-white rounded-lg bg-transparent hover:border-[#3b82f6] hover:bg-[#3b82f6]/5 transition-all">
                <div className="flex-1 min-w-0">
                  <h4 className="font-mono font-bold truncate text-white">{investor.firmName}</h4>
                  <div className="text-xs text-white/70 mt-1 truncate font-mono">
                    Investment member: {investor.memberName}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {investor.industryPreferences.map((industry) => (
                      <Badge key={industry} variant="outline" className="text-xs border-white text-white bg-transparent">{industry}</Badge>
                    ))}
                    <Badge variant="outline" className="text-xs border-[#3b82f6] text-[#3b82f6] bg-transparent">{investor.totalSlots} slots</Badge>
                  </div>
                  <div className="text-xs text-white/70 mt-1 font-mono">
                    ${(investor.minTicketSize / 1000000).toFixed(1)}M - ${(investor.maxTicketSize / 1000000).toFixed(1)}M
                  </div>
                  <div className="text-xs text-white/70 truncate font-mono">
                    {investor.geoFocus.join(", ")}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditInvestor(investor)}
                    className="text-white hover:text-[#3b82f6] hover:bg-white/10"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteInvestor(investor.id, investor.firmName)}
                    className="text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Mentors Management */}
      <Card className="border-2 border-white bg-transparent">
        <CardHeader className="border-b-2 border-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white font-mono font-black uppercase tracking-tight">Mentors ({mentors.length})</CardTitle>
            <Button onClick={onAddMentor} size="sm" className="bg-[#3b82f6] text-black hover:bg-[#3b82f6]/80 font-bold border-2 border-[#3b82f6] transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]">
              <Plus className="h-4 w-4 mr-2" />
              Add Mentor
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-white">
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {mentors.map((mentor) => (
              <div key={mentor.id} className="flex items-center justify-between p-3 border-2 border-white rounded-lg bg-transparent hover:border-[#3b82f6] hover:bg-[#3b82f6]/5 transition-all">
                <div className="flex-1 min-w-0">
                  <h4 className="font-mono font-bold truncate text-white">{mentor.fullName}</h4>
                  <div className="text-xs text-white/70 mt-1 truncate font-mono">
                    {mentor.email}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {mentor.expertiseAreas.slice(0, 3).map((area) => (
                      <Badge key={area} variant="outline" className="text-xs border-white text-white bg-transparent">{area}</Badge>
                    ))}
                    {mentor.expertiseAreas.length > 3 && (
                      <Badge variant="outline" className="text-xs border-white text-white bg-transparent">+{mentor.expertiseAreas.length - 3}</Badge>
                    )}
                    <Badge variant="outline" className="text-xs border-[#3b82f6] text-[#3b82f6] bg-transparent">{mentor.totalSlots} slots</Badge>
                  </div>
                  <div className="text-xs text-white/70 mt-1 truncate font-mono">
                    {mentor.geoFocus.join(", ")}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditMentor(mentor)}
                    className="text-white hover:text-[#3b82f6] hover:bg-white/10"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteMentor(mentor.id, mentor.fullName)}
                    className="text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Corporates Management */}
      <Card className="border-2 border-white bg-transparent">
        <CardHeader className="border-b-2 border-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white font-mono font-black uppercase tracking-tight">Corporates ({corporates.length})</CardTitle>
            <Button onClick={onAddCorporate} size="sm" className="bg-[#3b82f6] text-black hover:bg-[#3b82f6]/80 font-bold border-2 border-[#3b82f6] transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]">
              <Plus className="h-4 w-4 mr-2" />
              Add Corporate
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-white">
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {corporates.map((corporate) => (
              <div key={corporate.id} className="flex items-center justify-between p-3 border-2 border-white rounded-lg bg-transparent hover:border-[#3b82f6] hover:bg-[#3b82f6]/5 transition-all">
                <div className="flex-1 min-w-0">
                  <h4 className="font-mono font-bold truncate text-white">{corporate.firmName}</h4>
                  <div className="text-xs text-white/70 mt-1 truncate font-mono">
                    Contact: {corporate.contactName}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {corporate.partnershipTypes.slice(0, 2).map((type) => (
                      <Badge key={type} variant="outline" className="text-xs border-white text-white bg-transparent">{type}</Badge>
                    ))}
                    {corporate.partnershipTypes.length > 2 && (
                      <Badge variant="outline" className="text-xs border-white text-white bg-transparent">+{corporate.partnershipTypes.length - 2}</Badge>
                    )}
                    <Badge variant="outline" className="text-xs border-[#3b82f6] text-[#3b82f6] bg-transparent">{corporate.totalSlots} slots</Badge>
                  </div>
                  <div className="text-xs text-white/70 mt-1 truncate font-mono">
                    {corporate.geoFocus.join(", ")}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditCorporate(corporate)}
                    className="text-white hover:text-[#3b82f6] hover:bg-white/10"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteCorporate(corporate.id, corporate.firmName)}
                    className="text-white/70 hover:text-white hover:bg-white/10"
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