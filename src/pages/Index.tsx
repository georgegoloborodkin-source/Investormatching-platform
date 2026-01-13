import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { SimpleMatchingTable } from "@/components/SimpleMatchingTable";
import { ParticipantManagement } from "@/components/ParticipantManagement";
import { MeetingVisibilityTable } from "@/components/MeetingVisibilityTable";
import { EditableSchedule } from "@/components/EditableSchedule";
import { StartupForm } from "@/components/StartupForm";
import { InvestorForm } from "@/components/InvestorForm";
import { MentorForm } from "@/components/MentorForm";
import { CorporateForm } from "@/components/CorporateForm";
import { CSVUpload } from "@/components/CSVUpload";
import { useToast } from "@/hooks/use-toast";
import { Startup, Investor, Mentor, CorporatePartner, Match, TimeSlotConfig, INDUSTRIES } from "@/types";
import { generateMatches } from "@/utils/matchingAlgorithm";
import { exportMatchesToCSV, downloadCSV } from "@/utils/csvUtils";
import { CoverageReport } from "@/components/CoverageReport";
import { Save } from "lucide-react";

const Index = () => {
  const { toast } = useToast();
  const [isRematching, setIsRematching] = useState(false);

  const dedupeMatchesOnLoad = useCallback((raw: Match[]) => {
    const seen = new Set<string>();
    const seenFirm = new Set<string>();
    return raw.filter((m) => {
      const key = `${m.startupId}::${m.investorId}`;
      if (seen.has(key)) return false;
      const firm = m.investorName ? m.investorName.split('(')[0].trim().toLowerCase() : "";
      const startupName = (m.startupName || "").trim().toLowerCase();
      const firmKey = `${startupName}::${firm}`;
      if (seenFirm.has(firmKey)) return false;
      seen.add(key);
      seenFirm.add(firmKey);
      return true;
    });
  }, []);
  
  // Modal states
  const [showStartupForm, setShowStartupForm] = useState(false);
  const [showInvestorForm, setShowInvestorForm] = useState(false);
  const [showMentorForm, setShowMentorForm] = useState(false);
  const [showCorporateForm, setShowCorporateForm] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [editingStartup, setEditingStartup] = useState<Startup | null>(null);
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null);
  const [editingMentor, setEditingMentor] = useState<Mentor | null>(null);
  const [editingCorporate, setEditingCorporate] = useState<CorporatePartner | null>(null);
  
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
      memberName: 'Jane Doe',
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
      memberName: 'John Smith',
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
      memberName: 'Amina Khan',
      geoFocus: ['Europe', 'Asia-Pacific'],
      industryPreferences: ['EdTech', 'E-commerce'],
      stagePreferences: ['Pre-seed', 'Seed'],
      minTicketSize: 500000,
      maxTicketSize: 3000000,
      totalSlots: 5,
      availabilityStatus: 'present'
    }
  ]);

  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [corporates, setCorporates] = useState<CorporatePartner[]>([]);

  // Helper function to generate time slots from 9:00 to 18:00 (20-minute intervals)
  const generateDefaultTimeSlots = (): TimeSlotConfig[] => {
    const slots: TimeSlotConfig[] = [];
    let hour = 9;
    let minute = 0;
    let slotNumber = 1;

    while (hour < 18 || (hour === 18 && minute === 0)) {
      const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      // Calculate end time (20 minutes later)
      let endHour = hour;
      let endMinute = minute + 20;
      if (endMinute >= 60) {
        endHour += 1;
        endMinute -= 60;
      }
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

      slots.push({
        id: `slot-${slotNumber}`,
        label: `Slot ${slotNumber}`,
        startTime,
        endTime,
        isDone: false,
      });

      // Move to next slot
      minute += 20;
      if (minute >= 60) {
        hour += 1;
        minute -= 60;
      }
      slotNumber++;
    }

    return slots;
  };

  const normalizeTimeSlots = (value: unknown): TimeSlotConfig[] => {
    if (!Array.isArray(value)) return generateDefaultTimeSlots();
    const cleaned = value
      .map((slot, idx) => {
        if (!slot) return null;
        const id = typeof slot.id === "string" ? slot.id : `slot-${idx + 1}`;
        const label = typeof slot.label === "string" ? slot.label : `Slot ${idx + 1}`;
        const startTime = typeof slot.startTime === "string" ? slot.startTime : undefined;
        const endTime = typeof slot.endTime === "string" ? slot.endTime : undefined;
        const isDone = !!(slot as any).isDone;
        if (!startTime || !endTime) return null;
        return { id, label, startTime, endTime, isDone };
      })
      .filter(Boolean) as TimeSlotConfig[];
    return cleaned.length > 0 ? cleaned : generateDefaultTimeSlots();
  };

  const [matches, setMatches] = useState<Match[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlotConfig[]>(generateDefaultTimeSlots());

  const [customIndustries, setCustomIndustries] = useState<string[]>([]);
  // Filters removed: always include attending participants only; member filter handled inside Edit Schedule.
  const [activeTab, setActiveTab] = useState<string>("table");
  const safeActiveTab = ["manage", "visibility", "table", "editable"].includes(activeTab)
    ? activeTab
    : "table";
  const [dataLoaded, setDataLoaded] = useState(true);

  const allIndustries = [...INDUSTRIES, ...customIndustries];

  // We can generate if we have startups and at least one target (investor/mentor/corporate)
  const hasData = startups.length > 0 && (investors.length > 0 || mentors.length > 0 || corporates.length > 0);

  // Load data from localStorage on mount
  useEffect(() => {
    const savedStartups = localStorage.getItem('matchmaking-startups');
    const savedInvestors = localStorage.getItem('matchmaking-investors');
    const savedMentors = localStorage.getItem('matchmaking-mentors');
    const savedCorporates = localStorage.getItem('matchmaking-corporates');
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

    if (savedMentors) {
      try {
        setMentors(JSON.parse(savedMentors));
      } catch (e) {
        console.error('Failed to load saved mentors');
      }
    }

    if (savedCorporates) {
      try {
        setCorporates(JSON.parse(savedCorporates));
      } catch (e) {
        console.error('Failed to load saved corporates');
      }
    }

    if (savedMatches) {
      try {
        const parsed = JSON.parse(savedMatches);
        const deduped = Array.isArray(parsed) ? dedupeMatchesOnLoad(parsed) : [];
        setMatches(deduped);
      } catch (e) {
        console.error('Failed to load saved matches');
      }
    }

    if (savedTimeSlots) {
      try {
        const parsed = JSON.parse(savedTimeSlots);
        setTimeSlots(normalizeTimeSlots(parsed));
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

  const handleAddMentor = useCallback((mentorData: Omit<Mentor, 'id'>) => {
    if (editingMentor) {
      setMentors(prev => prev.map(m => 
        m.id === editingMentor.id 
          ? { ...mentorData, id: editingMentor.id }
          : m
      ));
      setEditingMentor(null);
      toast({
        title: "Mentor Updated",
        description: `${mentorData.fullName} has been updated successfully.`,
      });
    } else {
      const newMentor: Mentor = {
        ...mentorData,
        id: `mentor-${Date.now()}`
      };
      setMentors(prev => [...prev, newMentor]);
      toast({
        title: "Mentor Added",
        description: `${mentorData.fullName} has been added successfully.`,
      });
    }
    setShowMentorForm(false);
  }, [editingMentor, toast]);

  const handleAddCorporate = useCallback((corporateData: Omit<CorporatePartner, 'id'>) => {
    if (editingCorporate) {
      setCorporates(prev => prev.map(c => 
        c.id === editingCorporate.id 
          ? { ...corporateData, id: editingCorporate.id }
          : c
      ));
      setEditingCorporate(null);
      toast({
        title: "Corporate Updated",
        description: `${corporateData.firmName} has been updated successfully.`,
      });
    } else {
      const newCorporate: CorporatePartner = {
        ...corporateData,
        id: `corporate-${Date.now()}`
      };
      setCorporates(prev => [...prev, newCorporate]);
      toast({
        title: "Corporate Added",
        description: `${corporateData.firmName} has been added successfully.`,
      });
    }
    setShowCorporateForm(false);
  }, [editingCorporate, toast]);

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

  const handleMentorsImported = useCallback((importedMentors: Mentor[]) => {
    setMentors(prev => [...prev, ...importedMentors]);
    setShowCSVUpload(false);
    
    toast({
      title: "Mentors Imported", 
      description: `${importedMentors.length} mentors imported successfully.`,
    });
  }, [toast]);

  const handleCorporatesImported = useCallback((importedCorporates: CorporatePartner[]) => {
    setCorporates(prev => [...prev, ...importedCorporates]);
    setShowCSVUpload(false);
    
    toast({
      title: "Corporates Imported", 
      description: `${importedCorporates.length} corporates imported successfully.`,
    });
  }, [toast]);

  const handleGenerateMatches = useCallback(() => {
    // Check if we have data
    if (!hasData) {
      toast({
        title: "Cannot Generate Matches",
        description: "Please add at least one startup and one target (investor, mentor, or corporate) before generating matches.",
        variant: "destructive"
      });
      return;
    }

    // Normalize and filter participants (default availability = present, default slots = 3)
    const normStartups = startups.map(s => ({
      ...s,
      availabilityStatus: s.availabilityStatus || 'present',
    }));
    const normInvestors = investors.map(i => ({
      ...i,
      availabilityStatus: i.availabilityStatus || 'present',
      totalSlots: i.totalSlots ?? 3,
    }));
    const normMentors = mentors.map(m => ({
      ...m,
      availabilityStatus: m.availabilityStatus || 'present',
      totalSlots: m.totalSlots ?? 3,
    }));
    const normCorporates = corporates.map(c => ({
      ...c,
      availabilityStatus: c.availabilityStatus || 'present',
      totalSlots: c.totalSlots ?? 3,
    }));

    // Check for available participants
    const availableStartups = normStartups.filter(s => s.availabilityStatus === 'present');
    const availableInvestors = normInvestors.filter(i => i.availabilityStatus === 'present');
    const availableMentors = normMentors.filter(m => m.availabilityStatus === 'present');
    const availableCorporates = normCorporates.filter(c => c.availabilityStatus === 'present');

    if (availableStartups.length === 0) {
      toast({
        title: "No Available Startups",
        description: "All startups are marked as 'not attending'. Please update their availability status.",
        variant: "destructive"
      });
      return;
    }

    if (availableInvestors.length + availableMentors.length + availableCorporates.length === 0) {
      toast({
        title: "No Available Targets",
        description: "All investors/mentors/corporates are marked as 'not attending'. Please update their availability status.",
        variant: "destructive"
      });
      return;
    }

    // Check if targets have slots configured (investors/mentors/corporates)
    const investorsWithSlots = availableInvestors.filter(inv => inv.totalSlots > 0);
    const mentorsWithSlots = availableMentors.filter(m => m.totalSlots > 0);
    const corporatesWithSlots = availableCorporates.filter(c => c.totalSlots > 0);
    if (investorsWithSlots.length + mentorsWithSlots.length + corporatesWithSlots.length === 0) {
      toast({
        title: "No Target Slots Available",
        description: "All investors/mentors/corporates have 0 total slots. Please set total slots.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('Generating matches with:', {
        startups: availableStartups.length,
        investors: availableInvestors.length,
        mentors: availableMentors.length,
        corporates: availableCorporates.length,
        timeSlots: timeSlots.length
      });

      const rawMatches = generateMatches(normStartups, normInvestors, [], timeSlots, {
        mentors: normMentors,
        corporates: normCorporates
      });
      // If we somehow got zero mentor/corporate matches but have those participants, retry once.
      const hasMentorCorpTargets = normMentors.length > 0 || normCorporates.length > 0;
      const hasMentorCorpMatches = rawMatches.some(m => m.targetType === 'mentor' || m.targetType === 'corporate');
      const finalRawMatches = !hasMentorCorpMatches && hasMentorCorpTargets
        ? generateMatches(normStartups, normInvestors, [], timeSlots, { mentors: normMentors, corporates: normCorporates })
        : rawMatches;
      // Safety net: ensure no duplicates by IDs and also by visible names (prevents duplicate-looking rows
      // when the same startup is imported twice with different IDs).
      const seen = new Set<string>();
      const seenFirm = new Set<string>();
      const seenNamePair = new Set<string>();
      const newMatches = finalRawMatches.filter(m => {
        const targetId = m.targetId || m.investorId || '';
        const targetName = m.targetName || m.investorName || '';
        const key = `${m.startupId}::${targetId}`;
        if (seen.has(key)) return false;
        const firmKey = `${m.startupId}::${(targetName || '').toLowerCase().trim()}`;
        if (seenFirm.has(firmKey)) return false;
        const nameKey = `${(m.startupName || '').toLowerCase().trim()}::${(targetName || '').toLowerCase().trim()}`;
        if (seenNamePair.has(nameKey)) return false;
        seen.add(key);
        seenFirm.add(firmKey);
        seenNamePair.add(nameKey);
        return true;
      });
      
      console.log('Generated matches:', newMatches.length);

      if (newMatches.length === 0) {
        toast({
          title: "No Matches Generated",
          description: "Could not generate matches. Check that investors have available slots and time slots are configured.",
          variant: "destructive"
        });
        return;
      }

      setMatches(newMatches);
      
      toast({
        title: "Matches Generated Successfully",
        description: `Created ${newMatches.length} optimal matches based on compatibility scores.`,
      });
    } catch (error) {
      console.error('Error generating matches:', error);
      toast({
        title: "Error Generating Matches",
        description: error instanceof Error ? error.message : "An unexpected error occurred. Please check the console for details.",
        variant: "destructive"
      });
    }
  }, [startups, investors, hasData, timeSlots, toast]);

  const handleRematch = useCallback(async () => {
    if (!hasData) return;
    
    setIsRematching(true);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Normalize participants before rematching
    const normStartups = startups.map(s => ({ ...s, availabilityStatus: s.availabilityStatus || 'present' }));
    const normInvestors = investors.map(i => ({ ...i, availabilityStatus: i.availabilityStatus || 'present', totalSlots: i.totalSlots ?? 3 }));
    const normMentors = mentors.map(m => ({ ...m, availabilityStatus: m.availabilityStatus || 'present', totalSlots: m.totalSlots ?? 3 }));
    const normCorporates = corporates.map(c => ({ ...c, availabilityStatus: c.availabilityStatus || 'present', totalSlots: c.totalSlots ?? 3 }));

    let rawMatches = generateMatches(normStartups, normInvestors, matches, timeSlots, {
      mentors: normMentors,
      corporates: normCorporates
    });
    // Retry once if mentors/corporates exist but none were scheduled
    const hasMentorCorpTargets = normMentors.length > 0 || normCorporates.length > 0;
    const hasMentorCorpMatches = rawMatches.some(m => m.targetType === 'mentor' || m.targetType === 'corporate');
    if (!hasMentorCorpMatches && hasMentorCorpTargets) {
      rawMatches = generateMatches(normStartups, normInvestors, matches, timeSlots, {
        mentors: normMentors,
        corporates: normCorporates
      });
    }
    const seen = new Set<string>();
    const seenFirm = new Set<string>();
    const seenNamePair = new Set<string>();
    const newMatches = rawMatches.filter(m => {
      const targetId = m.targetId || m.investorId || '';
      const targetName = m.targetName || m.investorName || '';
      const key = `${m.startupId}::${targetId}`;
      if (seen.has(key)) return false;
      const firmKey = `${m.startupId}::${(targetName || '').toLowerCase().trim()}`;
      if (seenFirm.has(firmKey)) return false;
      const nameKey = `${(m.startupName || '').toLowerCase().trim()}::${(targetName || '').toLowerCase().trim()}`;
      if (seenNamePair.has(nameKey)) return false;
      seen.add(key);
      seenFirm.add(firmKey);
      seenNamePair.add(nameKey);
      return true;
    });
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

  const handleEditMentor = useCallback((mentor: Mentor) => {
    setEditingMentor(mentor);
    setShowMentorForm(true);
  }, []);

  const handleEditCorporate = useCallback((corporate: CorporatePartner) => {
    setEditingCorporate(corporate);
    setShowCorporateForm(true);
  }, []);

  const handleDeleteStartup = useCallback((id: string) => {
    setStartups(prev => prev.filter(s => s.id !== id));
    // Remove related matches
    setMatches(prev => prev.filter(m => m.startupId !== id));
  }, []);

  const handleDeleteInvestor = useCallback((id: string) => {
    setInvestors(prev => prev.filter(i => i.id !== id));
    // Remove related matches
    setMatches(prev => prev.filter(m => (m.targetId || m.investorId) === id));
  }, []);

  const handleDeleteMentor = useCallback((id: string) => {
    setMentors(prev => prev.filter(m => m.id !== id));
    // Remove related matches
    setMatches(prev => prev.filter(m => m.targetId !== id));
  }, []);

  const handleDeleteCorporate = useCallback((id: string) => {
    setCorporates(prev => prev.filter(c => c.id !== id));
    // Remove related matches
    setMatches(prev => prev.filter(m => m.targetId !== id));
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
      localStorage.setItem('matchmaking-mentors', JSON.stringify(mentors));
      localStorage.setItem('matchmaking-corporates', JSON.stringify(corporates));
      localStorage.setItem('matchmaking-matches', JSON.stringify(matches));
      localStorage.setItem('matchmaking-timeslots', JSON.stringify(timeSlots));
      
      toast({
        title: "Data Saved",
        description: "All participants and matches have been saved locally.",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save data. Please try again.",
        variant: "destructive"
      });
    }
  }, [startups, investors, mentors, corporates, matches, timeSlots, toast]);

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
              {startups.length} startups • {investors.length} investors • {mentors.length} mentors • {corporates.length} corporates • {matches.length} matches
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <Link to="/cis">
              <Button variant="outline">Switch to CIS prototype</Button>
            </Link>
            <Button onClick={handleSaveData} variant="outline">
              <Save className="h-4 w-4 mr-2" />
              Save Data
            </Button>
          </div>
        </div>
        
        <Tabs value={safeActiveTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="manage">Manage</TabsTrigger>
            <TabsTrigger value="visibility">Overview</TabsTrigger>
            <TabsTrigger value="table">Table View</TabsTrigger>
            <TabsTrigger value="editable">Edit Schedule</TabsTrigger>
          </TabsList>
          
          <TabsContent value="manage">
            <ParticipantManagement
              startups={startups}
              investors={investors}
              mentors={mentors}
              corporates={corporates}
              onAddStartup={() => {
                setEditingStartup(null);
                setShowStartupForm(true);
              }}
              onAddInvestor={() => {
                setEditingInvestor(null);
                setShowInvestorForm(true);
              }}
              onAddMentor={() => {
                setEditingMentor(null);
                setShowMentorForm(true);
              }}
              onAddCorporate={() => {
                setEditingCorporate(null);
                setShowCorporateForm(true);
              }}
              onEditStartup={handleEditStartup}
              onEditInvestor={handleEditInvestor}
              onEditMentor={handleEditMentor}
              onEditCorporate={handleEditCorporate}
              onDeleteStartup={handleDeleteStartup}
              onDeleteInvestor={handleDeleteInvestor}
              onDeleteMentor={handleDeleteMentor}
              onDeleteCorporate={handleDeleteCorporate}
            />
          </TabsContent>

          <TabsContent value="visibility">
            <div className="space-y-6">
              <CoverageReport 
                startups={startups} 
                investors={investors} 
                mentors={mentors}
                corporates={corporates}
                matches={matches} 
              />
            <MeetingVisibilityTable
              startups={startups}
              investors={investors}
              mentors={mentors}
              corporates={corporates}
              matches={matches}
            />
            </div>
          </TabsContent>
          
          <TabsContent value="table">
            <SimpleMatchingTable 
              matches={matches}
              startups={startups}
              investors={investors}
              mentors={mentors}
              corporates={corporates}
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

      <Dialog open={showMentorForm} onOpenChange={(open) => {
        setShowMentorForm(open);
        if (!open) setEditingMentor(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <MentorForm
            mentor={editingMentor}
            industries={allIndustries}
            onSave={handleAddMentor}
            onAddIndustry={handleAddIndustry}
            onCancel={() => {
              setShowMentorForm(false);
              setEditingMentor(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showCorporateForm} onOpenChange={(open) => {
        setShowCorporateForm(open);
        if (!open) setEditingCorporate(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <CorporateForm
            corporate={editingCorporate}
            industries={allIndustries}
            onSave={handleAddCorporate}
            onAddIndustry={handleAddIndustry}
            onCancel={() => {
              setShowCorporateForm(false);
              setEditingCorporate(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showCSVUpload} onOpenChange={setShowCSVUpload}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <CSVUpload
            onStartupsImported={handleStartupsImported}
            onInvestorsImported={handleInvestorsImported}
            onMentorsImported={handleMentorsImported}
            onCorporatesImported={handleCorporatesImported}
            onClose={() => setShowCSVUpload(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
