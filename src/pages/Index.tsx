import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { SimpleMatchingTable } from "@/components/SimpleMatchingTable";
import { ParticipantManagement } from "@/components/ParticipantManagement";
import { MeetingVisibilityTable } from "@/components/MeetingVisibilityTable";
import { TimeSlotManager } from "@/components/TimeSlotManager";
import { EditableSchedule } from "@/components/EditableSchedule";
import { StartupForm } from "@/components/StartupForm";
import { InvestorForm } from "@/components/InvestorForm";
import { CSVUpload } from "@/components/CSVUpload";
import { useToast } from "@/hooks/use-toast";
import { Startup, Investor, Match, TimeSlotConfig, INDUSTRIES } from "@/types";
import { generateMatches } from "@/utils/matchingAlgorithm";
import { exportMatchesToCSV, downloadCSV } from "@/utils/csvUtils";
import { Save } from "lucide-react";

const Index = () => {
  const { toast } = useToast();
  const [isRematching, setIsRematching] = useState(false);
  
  // Modal states
  const [showStartupForm, setShowStartupForm] = useState(false);
  const [showInvestorForm, setShowInvestorForm] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [editingStartup, setEditingStartup] = useState<Startup | null>(null);
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null);
  
  // Data states
  const [startups, setStartups] = useState<Startup[]>([
    {
      id: '1',
      companyName: 'TechFlow AI',
      geoMarkets: ['North America', 'Europe'],
      industry: 'AI/ML',
      fundingTarget: 2000000,
      fundingStage: 'Series A',
      availabilityStatus: 'present'
    },
    {
      id: '2',
      companyName: 'HealthVision',
      geoMarkets: ['North America'],
      industry: 'Healthtech',
      fundingTarget: 500000,
      fundingStage: 'Seed',
      availabilityStatus: 'present'
    },
    {
      id: '3',
      companyName: 'EduNext',
      geoMarkets: ['Europe', 'Asia-Pacific'],
      industry: 'EdTech',
      fundingTarget: 1000000,
      fundingStage: 'Series A',
      availabilityStatus: 'present'
    }
  ]);

  const [investors, setInvestors] = useState<Investor[]>([
    {
      id: '1',
      firmName: 'Venture Capital Partners',
      geoFocus: ['North America', 'Europe'],
      industryPreferences: ['AI/ML', 'SaaS'],
      stagePreferences: ['Series A', 'Series B+'],
      minTicketSize: 1000000,
      maxTicketSize: 5000000,
      totalSlots: 4,
      availabilityStatus: 'present'
    },
    {
      id: '2',
      firmName: 'Health Innovations Fund',
      geoFocus: ['North America'],
      industryPreferences: ['Healthtech'],
      stagePreferences: ['Seed', 'Series A'],
      minTicketSize: 250000,
      maxTicketSize: 2000000,
      totalSlots: 3,
      availabilityStatus: 'present'
    },
    {
      id: '3',
      firmName: 'Global Tech Ventures',
      geoFocus: ['Europe', 'Asia-Pacific'],
      industryPreferences: ['EdTech', 'E-commerce'],
      stagePreferences: ['Pre-seed', 'Seed'],
      minTicketSize: 500000,
      maxTicketSize: 3000000,
      totalSlots: 5,
      availabilityStatus: 'present'
    }
  ]);

  const [matches, setMatches] = useState<Match[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlotConfig[]>([
    { id: 'slot-1', label: 'Slot 1', startTime: '09:00', endTime: '09:20', isDone: false },
    { id: 'slot-2', label: 'Slot 2', startTime: '09:20', endTime: '09:40', isDone: false },
    { id: 'slot-3', label: 'Slot 3', startTime: '09:40', endTime: '10:00', isDone: false },
    { id: 'slot-4', label: 'Slot 4', startTime: '10:00', endTime: '10:20', isDone: false },
    { id: 'slot-5', label: 'Slot 5', startTime: '10:20', endTime: '10:40', isDone: false },
    { id: 'slot-6', label: 'Slot 6', startTime: '10:40', endTime: '11:00', isDone: false },
  ]);

  const [customIndustries, setCustomIndustries] = useState<string[]>([]);

  const allIndustries = [...INDUSTRIES, ...customIndustries];

  const hasData = startups.length > 0 && investors.length > 0;

  // Load data from localStorage on mount
  useEffect(() => {
    const savedStartups = localStorage.getItem('matchmaking-startups');
    const savedInvestors = localStorage.getItem('matchmaking-investors');
    const savedMatches = localStorage.getItem('matchmaking-matches');
    const savedTimeSlots = localStorage.getItem('matchmaking-timeslots');

    if (savedStartups) {
      try {
        setStartups(JSON.parse(savedStartups));
      } catch (e) {
        console.error('Failed to load saved startups');
      }
    }

    if (savedInvestors) {
      try {
        setInvestors(JSON.parse(savedInvestors));
      } catch (e) {
        console.error('Failed to load saved investors');
      }
    }

    if (savedMatches) {
      try {
        setMatches(JSON.parse(savedMatches));
      } catch (e) {
        console.error('Failed to load saved matches');
      }
    }

    if (savedTimeSlots) {
      try {
        setTimeSlots(JSON.parse(savedTimeSlots));
      } catch (e) {
        console.error('Failed to load saved time slots');
      }
    }
  }, []);

  const handleAddStartup = useCallback((startupData: Omit<Startup, 'id'>) => {
    if (editingStartup) {
      // Edit existing startup
      setStartups(prev => prev.map(s => 
        s.id === editingStartup.id 
          ? { ...startupData, id: editingStartup.id }
          : s
      ));
      setEditingStartup(null);
      toast({
        title: "Startup Updated",
        description: `${startupData.companyName} has been updated successfully.`,
      });
    } else {
      // Add new startup
      const newStartup: Startup = {
        ...startupData,
        id: `startup-${Date.now()}`
      };
      setStartups(prev => [...prev, newStartup]);
      toast({
        title: "Startup Added",
        description: `${startupData.companyName} has been added successfully.`,
      });
    }
    setShowStartupForm(false);
  }, [editingStartup, toast]);

  const handleAddInvestor = useCallback((investorData: Omit<Investor, 'id'>) => {
    if (editingInvestor) {
      // Edit existing investor
      setInvestors(prev => prev.map(i => 
        i.id === editingInvestor.id 
          ? { ...investorData, id: editingInvestor.id }
          : i
      ));
      setEditingInvestor(null);
      toast({
        title: "Investor Updated",
        description: `${investorData.firmName} has been updated successfully.`,
      });
    } else {
      // Add new investor
      const newInvestor: Investor = {
        ...investorData,
        id: `investor-${Date.now()}`
      };
      setInvestors(prev => [...prev, newInvestor]);
      toast({
        title: "Investor Added",
        description: `${investorData.firmName} has been added successfully.`,
      });
    }
    setShowInvestorForm(false);
  }, [editingInvestor, toast]);

  const handleStartupsImported = useCallback((importedStartups: Startup[]) => {
    setStartups(prev => [...prev, ...importedStartups]);
    setShowCSVUpload(false);
    
    toast({
      title: "Startups Imported",
      description: `${importedStartups.length} startups imported successfully.`,
    });
  }, [toast]);

  const handleInvestorsImported = useCallback((importedInvestors: Investor[]) => {
    setInvestors(prev => [...prev, ...importedInvestors]);
    setShowCSVUpload(false);
    
    toast({
      title: "Investors Imported", 
      description: `${importedInvestors.length} investors imported successfully.`,
    });
  }, [toast]);

  const handleGenerateMatches = useCallback(() => {
    if (!hasData) return;
    
    const newMatches = generateMatches(startups, investors, [], timeSlots);
    setMatches(newMatches);
    
    toast({
      title: "Matches Generated",
      description: `Created ${newMatches.length} optimal matches based on compatibility scores.`,
    });
  }, [startups, investors, hasData, timeSlots, toast]);

  const handleRematch = useCallback(async () => {
    if (!hasData) return;
    
    setIsRematching(true);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const newMatches = generateMatches(startups, investors, matches, timeSlots);
    setMatches(newMatches);
    
    toast({
      title: "Rematching Complete",
      description: "Schedule optimized while preserving completed meetings.",
    });
    
    setIsRematching(false);
  }, [startups, investors, matches, hasData, timeSlots, toast]);

  const handleExport = useCallback(() => {
    if (matches.length === 0) {
      toast({
        title: "No matches to export",
        description: "Generate matches first before exporting.",
        variant: "destructive"
      });
      return;
    }
    
    const csvContent = exportMatchesToCSV(matches, startups, investors);
    downloadCSV(csvContent, `matchmaking_schedule_${new Date().toISOString().split('T')[0]}.csv`);
    
    toast({
      title: "Export Complete",
      description: "Matchmaking schedule exported successfully.",
    });
  }, [matches, startups, investors, toast]);

  const handleToggleCompleted = useCallback((matchId: string) => {
    setMatches(prev => prev.map(match => 
      match.id === matchId 
        ? { 
            ...match, 
            completed: !match.completed,
            status: !match.completed ? 'completed' : 'upcoming'
          }
        : match
    ));
  }, []);

  const handleToggleLocked = useCallback((matchId: string) => {
    setMatches(prev => prev.map(match => 
      match.id === matchId 
        ? { ...match, locked: !match.locked }
        : match
    ));
    
    toast({
      title: "Match Lock Updated",
      description: "Match lock status has been updated.",
    });
  }, [toast]);

  const handleUpdateScore = useCallback((matchId: string, newScore: number) => {
    setMatches(prev => prev.map(match => 
      match.id === matchId 
        ? { ...match, compatibilityScore: newScore }
        : match
    ));
    
    toast({
      title: "Score Updated",
      description: `Compatibility score updated to ${newScore}%.`,
    });
  }, [toast]);

  const handleEditStartup = useCallback((startup: Startup) => {
    setEditingStartup(startup);
    setShowStartupForm(true);
  }, []);

  const handleEditInvestor = useCallback((investor: Investor) => {
    setEditingInvestor(investor);
    setShowInvestorForm(true);
  }, []);

  const handleDeleteStartup = useCallback((id: string) => {
    setStartups(prev => prev.filter(s => s.id !== id));
    // Remove related matches
    setMatches(prev => prev.filter(m => m.startupId !== id));
  }, []);

  const handleDeleteInvestor = useCallback((id: string) => {
    setInvestors(prev => prev.filter(i => i.id !== id));
    // Remove related matches
    setMatches(prev => prev.filter(m => m.investorId !== id));
  }, []);

  const handleAddIndustry = useCallback((newIndustry: string) => {
    if (newIndustry && !customIndustries.includes(newIndustry) && !INDUSTRIES.includes(newIndustry)) {
      setCustomIndustries(prev => [...prev, newIndustry]);
    }
  }, [customIndustries]);


  const handleSaveData = useCallback(() => {
    try {
      localStorage.setItem('matchmaking-startups', JSON.stringify(startups));
      localStorage.setItem('matchmaking-investors', JSON.stringify(investors));
      localStorage.setItem('matchmaking-matches', JSON.stringify(matches));
      localStorage.setItem('matchmaking-timeslots', JSON.stringify(timeSlots));
      
      toast({
        title: "Data Saved",
        description: "All startups, investors, and matches have been saved locally.",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save data. Please try again.",
        variant: "destructive"
      });
    }
  }, [startups, investors, matches, timeSlots, toast]);

  const handleUpdateMatch = useCallback((matchId: string, updates: Partial<Match>) => {
    setMatches(prev => prev.map(match => 
      match.id === matchId ? { ...match, ...updates } : match
    ));
  }, []);

  const handleUpdateAttendance = useCallback((
    type: 'startup' | 'investor', 
    id: string, 
    slotId: string, 
    attending: boolean
  ) => {
    if (type === 'startup') {
      setStartups(prev => prev.map(startup => {
        if (startup.id === id) {
          const slotAvailability = { ...startup.slotAvailability };
          slotAvailability[slotId] = attending;
          return { ...startup, slotAvailability };
        }
        return startup;
      }));
    } else {
      setInvestors(prev => prev.map(investor => {
        if (investor.id === id) {
          const slotAvailability = { ...investor.slotAvailability };
          slotAvailability[slotId] = attending;
          return { ...investor, slotAvailability };
        }
        return investor;
      }));
    }

    // Update matches to reflect attendance for the specific slot only
    setMatches(prev => prev.map(match => {
      const matchTimeSlot = timeSlots.find(ts => ts.label === match.timeSlot);
      if (matchTimeSlot && matchTimeSlot.id === slotId) {
        if (type === 'startup' && match.startupId === id) {
          return { ...match, startupAttending: attending };
        } else if (type === 'investor' && match.investorId === id) {
          return { ...match, investorAttending: attending };
        }
      }
      return match;
    }));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header
        onImportData={() => setShowCSVUpload(true)}
        onGenerateMatches={handleGenerateMatches}
        onRematch={handleRematch}
        onExport={handleExport}
        isRematching={isRematching}
        hasData={hasData}
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Matchmaking Dashboard
            </h2>
            <p className="text-muted-foreground">
              {startups.length} startups • {investors.length} investors • {matches.length} matches generated
            </p>
          </div>
          <Button onClick={handleSaveData} variant="outline">
            <Save className="h-4 w-4 mr-2" />
            Save Data
          </Button>
        </div>
        
        <Tabs defaultValue="table" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="manage">Manage</TabsTrigger>
            <TabsTrigger value="timeslots">Time Slots</TabsTrigger>
            <TabsTrigger value="visibility">Overview</TabsTrigger>
            <TabsTrigger value="table">Table View</TabsTrigger>
            <TabsTrigger value="editable">Edit Schedule</TabsTrigger>
          </TabsList>
          
          <TabsContent value="manage">
            <ParticipantManagement
              startups={startups}
              investors={investors}
              onAddStartup={() => {
                setEditingStartup(null);
                setShowStartupForm(true);
              }}
              onAddInvestor={() => {
                setEditingInvestor(null);
                setShowInvestorForm(true);
              }}
              onEditStartup={handleEditStartup}
              onEditInvestor={handleEditInvestor}
              onDeleteStartup={handleDeleteStartup}
              onDeleteInvestor={handleDeleteInvestor}
            />
          </TabsContent>

          <TabsContent value="timeslots">
            <TimeSlotManager
              timeSlots={timeSlots}
              onUpdateTimeSlots={setTimeSlots}
            />
          </TabsContent>

          <TabsContent value="visibility">
            <MeetingVisibilityTable
              startups={startups}
              investors={investors}
              matches={matches}
            />
          </TabsContent>
          
          <TabsContent value="table">
            <SimpleMatchingTable 
              matches={matches}
              startups={startups}
              investors={investors}
              onToggleCompleted={handleToggleCompleted}
              onToggleLocked={handleToggleLocked}
              onUpdateMatch={handleUpdateMatch}
            />
          </TabsContent>
          
          <TabsContent value="editable">
            <EditableSchedule
              matches={matches}
              startups={startups}
              investors={investors}
              timeSlots={timeSlots}
              onUpdateMatch={handleUpdateMatch}
              onUpdateAttendance={handleUpdateAttendance}
              onUpdateTimeSlots={setTimeSlots}
              onToggleCompleted={handleToggleCompleted}
              onToggleLocked={handleToggleLocked}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Modals */}
      <Dialog open={showStartupForm} onOpenChange={(open) => {
        setShowStartupForm(open);
        if (!open) setEditingStartup(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <StartupForm
            startup={editingStartup}
            industries={allIndustries}
            onSave={handleAddStartup}
            onAddIndustry={handleAddIndustry}
            onCancel={() => {
              setShowStartupForm(false);
              setEditingStartup(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showInvestorForm} onOpenChange={(open) => {
        setShowInvestorForm(open);
        if (!open) setEditingInvestor(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <InvestorForm
            investor={editingInvestor}
            timeSlots={timeSlots}
            industries={allIndustries}
            onSave={handleAddInvestor}
            onAddIndustry={handleAddIndustry}
            onCancel={() => {
              setShowInvestorForm(false);
              setEditingInvestor(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showCSVUpload} onOpenChange={setShowCSVUpload}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <CSVUpload
            onStartupsImported={handleStartupsImported}
            onInvestorsImported={handleInvestorsImported}
            onClose={() => setShowCSVUpload(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
