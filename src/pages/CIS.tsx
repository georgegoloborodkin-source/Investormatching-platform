import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Brain,
  FileText,
  ClipboardList,
  Upload,
  Loader2,
  Download,
  Trash2,
  TrendingUp,
  Users,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Sparkles,
  Folder,
  Link2,
  BarChart3,
  PieChart,
  Eye,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  calculateDecisionStats,
  exportDecisionsToCSV,
  type Decision,
} from "@/utils/claudeConverter";
import { calculateDecisionEngineAnalytics } from "@/utils/decisionAnalytics";
import type { DocumentRecord, SourceRecord, UserProfile } from "@/types";
import { TeamInvitationForm } from "@/components/TeamInvitationForm";
import { TeamMembersList } from "@/components/TeamMembersList";
import { SyncStatus } from "@/components/SyncStatus";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import {
  ensureActiveEventForOrg,
  ensureOrganizationForUser,
  getDecisionsByEvent,
  getDocumentsByEvent,
  getSourcesByEvent,
  insertDecision,
  insertDocument,
  insertSource,
  updateDecision,
  deleteDecision,
  deleteSource,
  getDocumentById,
} from "@/utils/supabaseHelpers";
import { convertFileWithAI, convertWithAI, askClaudeAnswerStream, embedQuery, type AIConversionResponse } from "@/utils/aiConverter";
import { getClickUpLists, ingestClickUpList, ingestGoogleDrive } from "@/utils/ingestionClient";
import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// TYPES
// ============================================================================

type ScopeItem = { id: string; label: string; checked: boolean; type: "portfolio" | "deal" | "thread" | "global" };
type Message = { id: string; author: "user" | "assistant"; text: string; threadId: string; isStreaming?: boolean };
type Thread = { id: string; title: string; parentId?: string };
type KnowledgeObject = {
  id: string;
  type: "Company" | "Person" | "Risk" | "Decision" | "Outcome";
  title: string;
  text: string;
  source: string;
  linked: string[];
};

declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}

// ============================================================================
// INITIAL DATA
// ============================================================================

const initialScopes: ScopeItem[] = [
  { id: "my-docs", label: "My docs", checked: true, type: "portfolio" },
  { id: "team-docs", label: "Team docs", checked: true, type: "global" },
  { id: "threads", label: "Saved Threads", checked: false, type: "thread" },
];

const initialThreads: Thread[] = [];
const initialMessages: Message[] = [];
const LOCAL_CHAT_CACHE_KEY = "ventureos_chat_cache";

type LocalChatMessage = {
  id: string;
  threadId: string;
  author: "assistant" | "user";
  text: string;
  ts: string;
};
const initialKOs: KnowledgeObject[] = [];

let googlePickerReady = false;
let googlePickerPromise: Promise<void> | null = null;

function loadGooglePicker(): Promise<void> {
  if (googlePickerReady) return Promise.resolve();
  if (googlePickerPromise) return googlePickerPromise;
  googlePickerPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = () => {
      if (!window.gapi) {
        reject(new Error("Google API failed to load."));
        return;
      }
      window.gapi.load("picker", {
        callback: () => {
          googlePickerReady = true;
          resolve();
        },
        onerror: () => reject(new Error("Google Picker failed to load.")),
      });
    };
    script.onerror = () => reject(new Error("Google API script failed to load."));
    document.body.appendChild(script);
  });
  return googlePickerPromise;
}

// ============================================================================
// THREAD TREE COMPONENT
// ============================================================================

function ThreadTree({ threads, active, onSelect }: { threads: Thread[]; active: string; onSelect: (id: string) => void }) {
  const renderThread = (t: Thread, level = 0) => {
    return (
      <div
        key={t.id}
        className={`flex items-center gap-2 p-2 rounded-md cursor-pointer border-2 border-white hover:border-[#FFED00] hover:bg-[#FFED00]/5 transition-colors bg-transparent ${
          active === t.id ? "border-[#FFED00] bg-[#FFED00]/10" : ""
        }`}
        style={{ paddingLeft: `${12 + level * 16}px` }}
        onClick={() => onSelect(t.id)}
      >
        <span className="text-xs text-white/70 font-mono">
          {level === 0 ? "▸" : "└"}
        </span>
        <span className={`text-sm ${active === t.id ? "font-semibold" : ""}`}>{t.title}</span>
      </div>
    );
  };
  const root = threads.filter((t) => !t.parentId);
  const children = (id: string) => threads.filter((t) => t.parentId === id);
  const walk = (t: Thread, level: number): JSX.Element[] => {
    const arr = [renderThread(t, level)];
    children(t.id).forEach((c) => arr.push(...walk(c, level + 1)));
    return arr;
  };
  return <div className="space-y-1">{root.flatMap((t) => walk(t, 0))}</div>;
}

function mapDecisionRow(row: any): Decision {
  return {
    id: row.id,
    timestamp: row.created_at,
    actor: row.actor_name,
    actionType: row.action_type,
    startupName: row.startup_name,
    context: row.context || {},
    confidenceScore: row.confidence_score ?? 0,
    outcome: row.outcome ?? undefined,
    notes: row.notes ?? undefined,
    documentId: row.document_id ?? undefined,
  };
}

// ============================================================================
// DOCUMENT CONVERTER TAB
// ============================================================================

function DocumentConverterTab({
  onDecisionDraft,
  onOpenDecisionLog,
  onAutoLogDecision,
}: {
  onDecisionDraft: (draft: { startupName: string; sector?: string; stage?: string }) => void;
  onOpenDecisionLog: () => void;
  onAutoLogDecision: (input: {
    draft: { startupName: string; sector?: string; stage?: string };
    conversion: AIConversionResponse;
    sourceType: "upload" | "paste" | "api";
    fileName: string | null;
    file: File | null;
    rawContent?: string | null;
    eventIdOverride?: string | null;
  }) => Promise<void>;
}) {
  const { toast } = useToast();
  const [documentText, setDocumentText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AIConversionResponse | null>(null);
  const MAX_PASTE_CHARS = 24000;

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setResult(null);
    try {
      const conversion = await convertFileWithAI(file);
      setResult(conversion);
      toast({ title: "Conversion complete", description: `Detected ${conversion.detectedType || "data"}` });

      const draft = conversion.startups?.[0]
        ? {
            startupName: conversion.startups[0].companyName || "Unknown Company",
            sector: conversion.startups[0].industry || undefined,
            stage: conversion.startups[0].fundingStage || undefined,
          }
        : null;
      if (draft) {
        await onAutoLogDecision({
          draft,
          conversion,
          sourceType: "upload",
          fileName: file.name || null,
          file,
        });
        toast({ title: "Decision logged", description: "Auto-created from extraction." });
      }
    } catch (error) {
      toast({
        title: "Conversion failed",
        description: error instanceof Error ? error.message : "File conversion failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, onAutoLogDecision]);

  const handleExtract = useCallback(async () => {
    if (!documentText.trim()) {
      toast({ title: "No content", description: "Please paste or upload document text", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setResult(null);

    try {
      let input = documentText;
      if (input.length > MAX_PASTE_CHARS) {
        input = input.slice(0, MAX_PASTE_CHARS);
        toast({
          title: "Content trimmed",
          description: "Pasted text was too long; we trimmed it to fit the converter limit.",
        });
      }

      const conversion = await convertWithAI(input);
      setResult(conversion);
      toast({
        title: "Extraction complete",
        description: `Detected ${conversion.detectedType || "data"}`,
      });

      const draft = conversion.startups?.[0]
        ? {
            startupName: conversion.startups[0].companyName || "Unknown Company",
            sector: conversion.startups[0].industry || undefined,
            stage: conversion.startups[0].fundingStage || undefined,
          }
        : null;
      if (conversion.errors?.length && !draft) {
        toast({
          title: "Extraction warning",
          description: conversion.errors[0],
          variant: "destructive",
        });
      }

      if (draft) {
        await onAutoLogDecision({
          draft,
          conversion,
          sourceType: "paste",
          fileName: null,
          file: null,
        });
        toast({ title: "Decision logged", description: "Auto-created from extraction." });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Extraction failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [documentText, toast, onAutoLogDecision]);

  const downloadJSON = useCallback(() => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversion-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const primaryStartup = result?.startups?.[0];
  const quickLogEnabled = !!primaryStartup;

  const handleQuickLog = () => {
    if (!primaryStartup) return;
    onDecisionDraft({
      startupName: primaryStartup.companyName || "Unknown Company",
      sector: primaryStartup.industry || undefined,
      stage: primaryStartup.fundingStage || undefined,
    });
    onOpenDecisionLog();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Input */}
      <div className="space-y-4">
        <Card className="border-2 border-white bg-transparent">
          <CardHeader className="border-b-2 border-white">
            <CardTitle className="flex items-center gap-2 text-white font-mono font-black uppercase tracking-tight">
              <Upload className="h-5 w-5 text-[#FFED00]" />
              Document Input
            </CardTitle>
            <CardDescription className="text-white/70 font-mono">
              Paste pitch deck text or upload a document for AI extraction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-white">
            <div>
              <Label className="text-white font-mono font-bold">Upload File</Label>
              <Input
                type="file"
                accept=".txt,.md,.pdf,.docx,.xlsx,.xls,.csv,.json"
                onChange={handleFileUpload}
                className="cursor-pointer border-2 border-white bg-transparent text-white file:border-white file:bg-transparent file:text-white"
              />
            </div>

            <div>
              <Label htmlFor="doc-text" className="text-white font-mono font-bold">Document Text</Label>
              <Textarea
                id="doc-text"
                placeholder="Paste pitch deck content, investment memo, or any company document here..."
                value={documentText}
                onChange={(e) => setDocumentText(e.target.value)}
                className="min-h-[300px] font-mono text-sm border-2 border-white bg-transparent text-white placeholder:text-white/50"
              />
              <p className="text-xs text-white/70 font-mono mt-1">
                {documentText.length} characters (~{Math.ceil(documentText.length / 4)} tokens)
              </p>
            </div>

            <Button
              onClick={handleExtract}
              disabled={isLoading || !documentText.trim()}
              className="w-full bg-[#FFED00] text-black hover:bg-[#FFED00]/80 font-bold border-2 border-[#FFED00] transition-all hover:shadow-[0_0_20px_rgba(255,237,0,0.5)] disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting with Claude...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Extract & Detect
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Cost Info */}
        <Card className="border-2 border-white bg-transparent">
          <CardContent className="pt-4 text-white">
            <div className="flex items-start gap-3">
              <DollarSign className="h-5 w-5 text-[#FFED00] mt-0.5" />
              <div className="text-sm font-mono">
                <p className="font-bold text-white">Cost Transparency</p>
                <p className="text-white/70">
                  Claude 3.5 Sonnet: ~$0.009 per 15-page deck<br/>
                  500 decks/month = ~$4.50 total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right: Results */}
      <div className="space-y-4">
        {result ? (
          <>
            <Card className="border-2 border-white bg-transparent">
              <CardHeader className="border-b-2 border-white">
                <CardTitle className="flex items-center justify-between text-white">
                  <span className="flex items-center gap-2 font-mono font-black uppercase tracking-tight">
                    <CheckCircle className="h-5 w-5 text-[#FFED00]" />
                    Conversion Result
                  </span>
                  {result && (
                    <Button size="sm" variant="outline" onClick={downloadJSON} className="border-2 border-white bg-transparent text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] font-bold">
                      <Download className="h-4 w-4 mr-1" />
                      JSON
                    </Button>
                  )}
                </CardTitle>
                <CardDescription className="text-white/70 font-mono">Detected: {result.detectedType || "unknown"}</CardDescription>
              </CardHeader>
              <CardContent className="text-white">
                <div className="space-y-4">
                  {primaryStartup ? (
                    <div className="p-3 border-2 border-white rounded-lg space-y-2 bg-transparent hover:border-[#FFED00] transition-all">
                      <div className="flex items-center justify-between">
                        <h3 className="font-mono font-black text-lg text-white">{primaryStartup.companyName}</h3>
                        {primaryStartup.fundingStage && <Badge variant="outline" className="border-white text-white bg-transparent font-mono">{primaryStartup.fundingStage}</Badge>}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {primaryStartup.industry && <Badge variant="outline" className="border-[#FFED00] text-[#FFED00] bg-transparent font-mono">{primaryStartup.industry}</Badge>}
                        {primaryStartup.geoMarkets?.length > 0 && (
                          <Badge variant="outline" className="border-white text-white bg-transparent font-mono">{primaryStartup.geoMarkets.join(", ")}</Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-white/70 font-mono">
                      No startup detected yet. Upload a pitch deck or paste content.
                    </div>
                  )}

                  {(result.errors?.length || result.warnings?.length) && (
                    <div className="border-2 border-white rounded-md p-3 text-xs space-y-2 bg-transparent">
                      {result.errors?.length ? (
                        <div>
                          <div className="font-mono font-bold text-white">Errors</div>
                          <ul className="list-disc list-inside text-white/70 font-mono">
                            {result.errors.slice(0, 3).map((err) => (
                              <li key={err}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {result.warnings?.length ? (
                        <div>
                          <div className="font-mono font-bold text-white">Warnings</div>
                          <ul className="list-disc list-inside text-white/70 font-mono">
                            {result.warnings.slice(0, 3).map((warn) => (
                              <li key={warn}>{warn}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {quickLogEnabled && (
                    <Button onClick={handleQuickLog} className="w-full border-2 border-white bg-transparent text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] font-bold" variant="outline">
                      <ClipboardList className="h-4 w-4 mr-2" />
                      Open in Decision Log
                    </Button>
                  )}

                  <details className="text-sm font-mono">
                    <summary className="cursor-pointer text-white/70 hover:text-white">
                      View full JSON
                    </summary>
                    <pre className="mt-2 p-3 border-2 border-white rounded-lg overflow-auto max-h-[300px] text-xs bg-transparent text-white">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </details>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="h-full min-h-[400px] flex items-center justify-center border-2 border-white bg-transparent">
            <CardContent className="text-center text-white/70 font-mono">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50 text-white/50" />
              <p className="font-bold">Paste document text and click Extract</p>
              <p className="text-sm mt-2">Results will appear here</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// DECISION LOGGER TAB
// ============================================================================

function DecisionLoggerTab({
  decisions,
  setDecisions,
  activeEventId,
  actorDefault,
  draftDecision,
  onDraftConsumed,
  draftDocumentId,
  onDraftDocumentConsumed,
  documents,
  onOpenDocument,
  onOpenConverter,
  currentUserId,
}: {
  decisions: Decision[];
  setDecisions: React.Dispatch<React.SetStateAction<Decision[]>>;
  activeEventId: string | null;
  actorDefault: string;
  draftDecision: { startupName: string; sector?: string; stage?: string } | null;
  onDraftConsumed: () => void;
  draftDocumentId: string | null;
  onDraftDocumentConsumed: () => void;
  documents: Array<{ id: string; title: string | null; storage_path: string | null }>;
  onOpenDocument: (documentId: string) => void;
  onOpenConverter: () => void;
  currentUserId: string | null;
}) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [viewingDecision, setViewingDecision] = useState<Decision | null>(null);

  // Form state
  const [actor, setActor] = useState(() => {
    if (typeof window !== "undefined" && actorDefault) {
      const saved = localStorage.getItem("last_actor");
      return saved || actorDefault;
    }
    return actorDefault;
  });
  const [actionType, setActionType] = useState<Decision["actionType"]>("meeting");
  const [startupName, setStartupName] = useState("");
  const [sector, setSector] = useState<string>("none");
  const [stage, setStage] = useState<string>("none");
  const [geo, setGeo] = useState<string>("none");
  const [geoCustom, setGeoCustom] = useState("");
  const [confidence, setConfidence] = useState([70]);
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionOutcome, setDecisionOutcome] = useState<Decision["outcome"]>("pending");
  const [attachedDocumentId, setAttachedDocumentId] = useState<string>("none");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("all");

  const filteredDecisions = useMemo(() => {
    if (selectedDocumentId === "all") return decisions;
    return decisions.filter((d) => d.documentId === selectedDocumentId);
  }, [decisions, selectedDocumentId]);

  const stats = useMemo(() => calculateDecisionStats(filteredDecisions), [filteredDecisions]);

  useEffect(() => {
    if (actorDefault && !actor) {
      setActor(actorDefault);
    }
  }, [actorDefault, actor]);

  useEffect(() => {
    if (!draftDecision) return;
    setStartupName(draftDecision.startupName);
    setSector(draftDecision.sector || "none");
    setStage(draftDecision.stage || "none");
    setShowForm(true);
    onDraftConsumed();
  }, [draftDecision, onDraftConsumed]);

  useEffect(() => {
    if (!draftDocumentId) return;
    setAttachedDocumentId(draftDocumentId);
    setShowForm(true);
    onDraftDocumentConsumed();
  }, [draftDocumentId, onDraftDocumentConsumed]);

  const handleSaveDecision = useCallback(async () => {
    if (!activeEventId) {
      toast({ title: "No active event", description: "Please refresh and try again.", variant: "destructive" });
      return;
    }
    if (!actor.trim() || !startupName.trim()) {
      toast({ title: "Missing fields", description: "Actor and Startup name are required", variant: "destructive" });
      return;
    }
    if (startupName.trim().length > 200) {
      toast({ title: "Invalid input", description: "Startup name must be less than 200 characters", variant: "destructive" });
      return;
    }
    if (actor.trim().length > 100) {
      toast({ title: "Invalid input", description: "Actor name must be less than 100 characters", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    const normalizedGeo = geo === "custom" ? geoCustom.trim() : geo;
    try {
      const { data, error } = await insertDecision(activeEventId, {
        actor_id: currentUserId, // Use actual user ID when available
        actor_name: actor.trim(),
        action_type: actionType,
        startup_name: startupName.trim(),
        context: {
          sector: sector !== "none" ? sector : undefined,
          stage: stage !== "none" ? stage : undefined,
          geo: normalizedGeo && normalizedGeo !== "none" ? normalizedGeo : undefined,
        },
        confidence_score: confidence[0],
        outcome: decisionOutcome || "pending",
        notes: decisionReason.trim() || null,
        document_id: attachedDocumentId === "none" ? null : attachedDocumentId,
      });

      if (error || !data) {
        toast({ 
          title: "Save failed", 
          description: error?.message || "Failed to save decision. Please try again.", 
          variant: "destructive" 
        });
        return;
      }

      // Save actor to localStorage for persistence
      if (typeof window !== "undefined") {
        localStorage.setItem("last_actor", actor.trim());
      }

      setDecisions(prev => [mapDecisionRow(data), ...prev]);
      toast({ title: "Decision logged", description: `Logged ${actionType} for ${startupName}` });

      // Reset form
      setStartupName("");
      setSector("none");
      setStage("none");
      setGeo("none");
      setGeoCustom("");
      setConfidence([70]);
      setDecisionReason("");
      setDecisionOutcome("pending");
      setAttachedDocumentId("none");
      setShowForm(false);
    } catch (err) {
      toast({ 
        title: "Unexpected error", 
        description: "An unexpected error occurred. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    activeEventId,
    actor,
    actionType,
    startupName,
    sector,
    stage,
    geo,
    confidence,
    decisionOutcome,
    decisionReason,
    attachedDocumentId,
    toast,
    setDecisions,
  ]);

  const handleDeleteDecision = useCallback(async (id: string) => {
    setIsDeleting(id);
    try {
      const { error } = await deleteDecision(id);
      if (error) {
        toast({ 
          title: "Delete failed", 
          description: error.message || "Failed to delete decision. Please try again.", 
          variant: "destructive" 
        });
        return;
      }
      setDecisions(prev => prev.filter(d => d.id !== id));
      toast({ title: "Deleted", description: "Decision removed" });
      setDeleteConfirmId(null);
    } catch (err) {
      toast({ 
        title: "Unexpected error", 
        description: "An unexpected error occurred. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsDeleting(null);
    }
  }, [toast, setDecisions]);

  const handleUpdateOutcome = useCallback(async (id: string, outcome: Decision["outcome"]) => {
    setIsUpdating(id);
    // Optimistic update
    setDecisions(prev =>
      prev.map(d => (d.id === id ? { ...d, outcome } : d))
    );
    try {
      const { error } = await updateDecision(id, { outcome });
      if (error) {
        // Revert on error
        setDecisions(prev =>
          prev.map(d => {
            if (d.id === id) {
              const originalDecision = decisions.find(od => od.id === id);
              return originalDecision || d;
            }
            return d;
          })
        );
        toast({ 
          title: "Update failed", 
          description: error.message || "Failed to update outcome. Please try again.", 
          variant: "destructive" 
        });
        return;
      }
      toast({ title: "Updated", description: "Outcome updated successfully" });
    } catch (err) {
      // Revert on error
      setDecisions(prev =>
        prev.map(d => {
          if (d.id === id) {
            const originalDecision = decisions.find(od => od.id === id);
            return originalDecision || d;
          }
          return d;
        })
      );
      toast({ 
        title: "Unexpected error", 
        description: "An unexpected error occurred. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsUpdating(null);
    }
  }, [toast, setDecisions, decisions]);

  const handleExport = useCallback(() => {
    const csv = exportDecisionsToCSV(decisions);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `decisions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `Downloaded ${decisions.length} decisions as CSV` });
  }, [decisions, toast]);

  const documentOptions = [
    { id: "all", label: "All documents" },
    ...documents.filter((doc) => !!doc.id).map((doc) => ({ id: doc.id, label: doc.title || "Untitled document" })),
  ];

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-2 border-white bg-transparent">
          <CardContent className="pt-4 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 border-2 border-white rounded-lg bg-transparent">
                <ClipboardList className="h-5 w-5 text-[#FFED00]" />
              </div>
              <div>
                <p className="text-2xl font-mono font-black">{stats.totalDecisions}</p>
                <p className="text-xs text-white/70 font-mono uppercase tracking-wider">Total Decisions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-white bg-transparent">
          <CardContent className="pt-4 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 border-2 border-[#FFED00] rounded-lg bg-transparent">
                <TrendingUp className="h-5 w-5 text-[#FFED00]" />
              </div>
              <div>
                <p className="text-2xl font-mono font-black">{stats.averageConfidence}%</p>
                <p className="text-xs text-white/70 font-mono uppercase tracking-wider">Avg Confidence</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-white bg-transparent">
          <CardContent className="pt-4 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 border-2 border-white rounded-lg bg-transparent">
                <Target className="h-5 w-5 text-[#FFED00]" />
              </div>
              <div>
                <p className="text-2xl font-mono font-black">{stats.byOutcome.positive || 0}</p>
                <p className="text-xs text-white/70 font-mono uppercase tracking-wider">Positive Outcomes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-white bg-transparent">
          <CardContent className="pt-4 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 border-2 border-white rounded-lg bg-transparent">
                <Users className="h-5 w-5 text-[#FFED00]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.topActors.length}</p>
                <p className="text-xs text-white/70 font-mono uppercase tracking-wider">Active Actors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 items-center">
        <Button onClick={() => setShowForm(!showForm)} className="bg-[#FFED00] text-black hover:bg-[#FFED00]/80 font-bold border-2 border-[#FFED00] transition-all hover:shadow-[0_0_20px_rgba(255,237,0,0.5)]">
          {showForm ? "Cancel" : "Log New Decision"}
        </Button>
        {decisions.length > 0 && (
          <Button variant="outline" onClick={handleExport} className="border-2 border-white bg-transparent text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] font-bold">
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        )}
        <Select value={selectedDocumentId} onValueChange={setSelectedDocumentId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filter by document" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All documents</SelectItem>
            {documents.filter((doc) => !!doc.id).map((doc) => (
              <SelectItem key={doc.id} value={doc.id}>
                {doc.title || doc.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* New Decision Form */}
      {showForm && (
        <Card className="border-2 border-white bg-transparent">
          <CardHeader className="border-b-2 border-white">
            <CardTitle className="text-white font-mono font-black uppercase tracking-tight">Log New Decision</CardTitle>
            <CardDescription className="text-white/70 font-mono">Record a decision for pattern analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-white font-mono font-bold">Actor (Who made the decision) *</Label>
                <Input
                  placeholder="e.g., Partner A, John Smith"
                  value={actor}
                  onChange={(e) => setActor(e.target.value)}
                  className="border-2 border-white bg-transparent text-white placeholder:text-white/50"
                />
              </div>
              <div>
                <Label className="text-white font-mono font-bold">Action Type *</Label>
                <Select value={actionType} onValueChange={(v) => setActionType(v as Decision["actionType"])}>
                  <SelectTrigger className="border-2 border-white bg-transparent text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#050505] border-2 border-white">
                    <SelectItem value="intro" className="text-white">Intro</SelectItem>
                    <SelectItem value="meeting" className="text-white">Meeting</SelectItem>
                    <SelectItem value="follow_up" className="text-white">Follow Up</SelectItem>
                    <SelectItem value="due_diligence" className="text-white">Due Diligence</SelectItem>
                    <SelectItem value="pass" className="text-white">Pass</SelectItem>
                    <SelectItem value="invest" className="text-white">Invest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white font-mono font-bold">Startup Name *</Label>
                <Input
                  placeholder="e.g., Company X"
                  value={startupName}
                  onChange={(e) => setStartupName(e.target.value)}
                  className="border-2 border-white bg-transparent text-white placeholder:text-white/50"
                />
              </div>
              <div>
                <Label className="text-white font-mono font-bold">Outcome</Label>
                <Select
                  value={decisionOutcome || "pending"}
                  onValueChange={(v) => setDecisionOutcome(v as Decision["outcome"])}
                >
                  <SelectTrigger className="border-2 border-white bg-transparent text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#050505] border-2 border-white">
                    <SelectItem value="pending" className="text-white">Pending</SelectItem>
                    <SelectItem value="positive" className="text-white">Positive</SelectItem>
                    <SelectItem value="negative" className="text-white">Negative</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white font-mono font-bold">Sector</Label>
                <Select value={sector} onValueChange={setSector}>
                  <SelectTrigger className="border-2 border-white bg-transparent text-white">
                    <SelectValue placeholder="Select sector" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#050505] border-2 border-white">
                    <SelectItem value="none" className="text-white">None</SelectItem>
                    <SelectItem value="FinTech" className="text-white">FinTech</SelectItem>
                    <SelectItem value="HealthTech" className="text-white">HealthTech</SelectItem>
                    <SelectItem value="SaaS" className="text-white">SaaS</SelectItem>
                    <SelectItem value="AI / ML" className="text-white">AI / ML</SelectItem>
                    <SelectItem value="E-commerce" className="text-white">E-commerce</SelectItem>
                    <SelectItem value="EdTech" className="text-white">EdTech</SelectItem>
                    <SelectItem value="PropTech" className="text-white">PropTech</SelectItem>
                    <SelectItem value="AgriTech" className="text-white">AgriTech</SelectItem>
                    <SelectItem value="CleanTech" className="text-white">CleanTech</SelectItem>
                    <SelectItem value="Gaming" className="text-white">Gaming</SelectItem>
                    <SelectItem value="Media / Content" className="text-white">Media / Content</SelectItem>
                    <SelectItem value="Logistics" className="text-white">Logistics</SelectItem>
                    <SelectItem value="Food & Beverage" className="text-white">Food & Beverage</SelectItem>
                    <SelectItem value="Travel & Tourism" className="text-white">Travel & Tourism</SelectItem>
                    <SelectItem value="HRTech" className="text-white">HRTech</SelectItem>
                    <SelectItem value="LegalTech" className="text-white">LegalTech</SelectItem>
                    <SelectItem value="InsurTech" className="text-white">InsurTech</SelectItem>
                    <SelectItem value="Space Infrastructure" className="text-white">Space Infrastructure</SelectItem>
                    <SelectItem value="Other" className="text-white">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white font-mono font-bold">Stage</Label>
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger className="border-2 border-white bg-transparent text-white">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#050505] border-2 border-white">
                    <SelectItem value="none" className="text-white">None</SelectItem>
                    <SelectItem value="Pre-Seed" className="text-white">Pre-Seed</SelectItem>
                    <SelectItem value="Seed" className="text-white">Seed</SelectItem>
                    <SelectItem value="Series A" className="text-white">Series A</SelectItem>
                    <SelectItem value="Series B" className="text-white">Series B</SelectItem>
                    <SelectItem value="Series C" className="text-white">Series C</SelectItem>
                    <SelectItem value="Series D+" className="text-white">Series D+</SelectItem>
                    <SelectItem value="Growth" className="text-white">Growth</SelectItem>
                    <SelectItem value="Bridge" className="text-white">Bridge</SelectItem>
                    <SelectItem value="Convertible Note" className="text-white">Convertible Note</SelectItem>
                    <SelectItem value="SAFE" className="text-white">SAFE</SelectItem>
                    <SelectItem value="Other" className="text-white">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white font-mono font-bold">Geography</Label>
                <Select value={geo} onValueChange={setGeo}>
                  <SelectTrigger className="border-2 border-white bg-transparent text-white">
                    <SelectValue placeholder="Select geography" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#050505] border-2 border-white">
                    <SelectItem value="none" className="text-white">None</SelectItem>
                    <SelectItem value="Singapore" className="text-white">Singapore</SelectItem>
                    <SelectItem value="Indonesia" className="text-white">Indonesia</SelectItem>
                    <SelectItem value="Malaysia" className="text-white">Malaysia</SelectItem>
                    <SelectItem value="Thailand" className="text-white">Thailand</SelectItem>
                    <SelectItem value="Vietnam" className="text-white">Vietnam</SelectItem>
                    <SelectItem value="Philippines" className="text-white">Philippines</SelectItem>
                    <SelectItem value="India" className="text-white">India</SelectItem>
                    <SelectItem value="China" className="text-white">China</SelectItem>
                    <SelectItem value="Hong Kong" className="text-white">Hong Kong</SelectItem>
                    <SelectItem value="Taiwan" className="text-white">Taiwan</SelectItem>
                    <SelectItem value="South Korea" className="text-white">South Korea</SelectItem>
                    <SelectItem value="Japan" className="text-white">Japan</SelectItem>
                    <SelectItem value="Australia" className="text-white">Australia</SelectItem>
                    <SelectItem value="New Zealand" className="text-white">New Zealand</SelectItem>
                    <SelectItem value="United States" className="text-white">United States</SelectItem>
                    <SelectItem value="United Kingdom" className="text-white">United Kingdom</SelectItem>
                    <SelectItem value="Europe" className="text-white">Europe</SelectItem>
                    <SelectItem value="Middle East" className="text-white">Middle East</SelectItem>
                    <SelectItem value="Africa" className="text-white">Africa</SelectItem>
                    <SelectItem value="Latin America" className="text-white">Latin America</SelectItem>
                    <SelectItem value="Other" className="text-white">Other</SelectItem>
                    <SelectItem value="custom" className="text-white">Add new...</SelectItem>
                  </SelectContent>
                </Select>
                {geo === "custom" && (
                  <Input
                    className="mt-2"
                    placeholder="Type a country or region"
                    value={geoCustom}
                    onChange={(e) => setGeoCustom(e.target.value)}
                  />
                )}
              </div>
            </div>

            <div>
              <Label>Confidence Score: {confidence[0]}%</Label>
              <Slider
                value={confidence}
                onValueChange={setConfidence}
                min={0}
                max={100}
                step={5}
                className="mt-2"
              />
              <p className="text-xs text-white/70 font-mono mt-1">
                How confident are you in this decision?
              </p>
            </div>

            <div>
              <Label>Reason</Label>
              <Textarea
                placeholder="Why this decision? Market size, traction, risks..."
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto] items-end">
              <div>
                <Label className="text-white font-mono font-bold">Attach Source Document</Label>
                <Select value={attachedDocumentId} onValueChange={setAttachedDocumentId}>
                  <SelectTrigger className="border-2 border-white bg-transparent text-white">
                    <SelectValue placeholder="Choose a document (optional)" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#050505] border-2 border-white">
                    <SelectItem value="none" className="text-white">No document</SelectItem>
                    {documents.filter((doc) => !!doc.id).map((doc) => (
                      <SelectItem key={doc.id} value={doc.id} className="text-white">
                        {doc.title || "Untitled document"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={onOpenConverter} className="border-2 border-white bg-transparent text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] font-bold">
                Upload new
              </Button>
            </div>

            <Button onClick={handleSaveDecision} className="w-full bg-[#FFED00] text-black hover:bg-[#FFED00]/80 font-bold border-2 border-[#FFED00] transition-all hover:shadow-[0_0_20px_rgba(255,237,0,0.5)] disabled:opacity-50" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Decision"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Decision History */}
      <Card className="border-2 border-white bg-transparent">
        <CardHeader className="border-b-2 border-white">
          <CardTitle className="text-white font-mono font-black uppercase tracking-tight">Decision History</CardTitle>
          <CardDescription className="text-white/70 font-mono">
            {filteredDecisions.length} decisions shown • Click outcome to update
          </CardDescription>
        </CardHeader>
        <CardContent className="text-white">
          <div className="mb-4">
            <Label className="text-xs text-white/70 font-mono font-bold">Filter by document</Label>
            <Select value={selectedDocumentId} onValueChange={setSelectedDocumentId}>
              <SelectTrigger className="mt-1 border-2 border-white bg-transparent text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#050505] border-2 border-white">
                {documentOptions.map((doc) => (
                  <SelectItem key={doc.id} value={doc.id} className="text-white">
                    {doc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filteredDecisions.length === 0 ? (
            <div className="text-center py-8 text-white/70 font-mono">
              <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50 text-white/50" />
              <p className="font-bold">No decisions logged yet</p>
              <p className="text-sm">Start logging decisions to build your pattern database</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-auto">
              {filteredDecisions.slice().reverse().map((d) => {
                const doc = documents.find((doc) => doc.id === d.documentId);
                return (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-3 border-2 border-white rounded-lg hover:bg-[#FFED00]/5 hover:border-[#FFED00] transition-colors bg-transparent"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs border-white text-white bg-transparent font-mono">
                      {d.actionType}
                    </Badge>
                    <div>
                      <p className="font-mono font-bold text-white">{d.startupName}</p>
                      <p className="text-xs text-white/70 font-mono">
                        {d.actor} • {new Date(d.timestamp).toLocaleDateString()}
                        {d.context.sector && ` • ${d.context.sector}`}
                      </p>
                      {doc && (
                        <p className="text-xs text-white/70 font-mono">
                          Source: {doc.title || "Document"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/70 font-mono">{d.confidenceScore}%</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setViewingDecision(d)}
                      className="border-2 border-white bg-transparent text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] font-bold"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    {doc?.storage_path && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenDocument(doc.id)}
                        className="border-2 border-white bg-transparent text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] font-bold"
                      >
                        View source
                      </Button>
                    )}
                    <Select
                      value={d.outcome || "pending"}
                      onValueChange={(v) => handleUpdateOutcome(d.id, v as Decision["outcome"])}
                      disabled={isUpdating === d.id}
                    >
                      <SelectTrigger className="w-[100px] h-8 border-2 border-white bg-transparent text-white" disabled={isUpdating === d.id}>
                        <SelectValue />
                        {isUpdating === d.id && <Loader2 className="h-3 w-3 ml-1 animate-spin" />}
                      </SelectTrigger>
                      <SelectContent className="bg-[#050505] border-2 border-white">
                        <SelectItem value="pending" className="text-white">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Pending
                            <span className="text-xs text-white/50 ml-1 font-mono">(No outcome yet)</span>
                          </span>
                        </SelectItem>
                        <SelectItem value="positive" className="text-white">
                          <span className="flex items-center gap-1 text-[#FFED00]">
                            <CheckCircle className="h-3 w-3" /> Positive
                            <span className="text-xs text-white/50 ml-1 font-mono">(Success)</span>
                          </span>
                        </SelectItem>
                        <SelectItem value="negative" className="text-white">
                          <span className="flex items-center gap-1 text-white/70">
                            <AlertTriangle className="h-3 w-3" /> Negative
                            <span className="text-xs text-white/50 ml-1 font-mono">(Passed/Declined)</span>
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                      onClick={() => setDeleteConfirmId(d.id)}
                      disabled={isDeleting === d.id}
                    >
                      {isDeleting === d.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )})}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision View Dialog */}
      <Dialog open={!!viewingDecision} onOpenChange={(open) => !open && setViewingDecision(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Decision Details</DialogTitle>
            <DialogDescription>
              Full information about this decision
            </DialogDescription>
          </DialogHeader>
          {viewingDecision && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-white/70 font-mono font-bold">Startup Name</Label>
                  <p className="font-mono font-bold text-white">{viewingDecision.startupName}</p>
                </div>
                <div>
                  <Label className="text-xs text-white/70 font-mono font-bold">Actor</Label>
                  <p className="font-mono font-bold text-white">{viewingDecision.actor}</p>
                </div>
                <div>
                  <Label className="text-xs text-white/70 font-mono font-bold">Action Type</Label>
                  <Badge variant="outline" className="border-white text-white bg-transparent font-mono">{viewingDecision.actionType}</Badge>
                </div>
                <div>
                  <Label className="text-xs text-white/70 font-mono font-bold">Confidence Score</Label>
                  <p className="font-mono font-bold text-white">{viewingDecision.confidenceScore}%</p>
                </div>
                <div>
                  <Label className="text-xs text-white/70 font-mono font-bold">Outcome</Label>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline"
                      className={
                        viewingDecision.outcome === "positive" ? "border-[#FFED00] text-[#FFED00] bg-transparent font-mono" :
                        viewingDecision.outcome === "negative" ? "border-white/50 text-white/50 bg-transparent font-mono" :
                        "border-white text-white bg-transparent font-mono"
                      }
                    >
                      {viewingDecision.outcome || "Pending"}
                    </Badge>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-white/70 cursor-help font-mono">ℹ️</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-[#050505] border-2 border-white text-white">
                          <p className="text-xs font-mono">
                            <strong>Pending:</strong> Decision is still in progress, no outcome yet<br/>
                            <strong>Positive:</strong> Decision led to a positive result (e.g., investment, partnership)<br/>
                            <strong>Negative:</strong> Decision led to a negative result (e.g., passed, declined)
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-white/70 font-mono font-bold">Date</Label>
                  <p className="font-mono font-bold text-white">{new Date(viewingDecision.timestamp).toLocaleString()}</p>
                </div>
              </div>

              {viewingDecision.context && (
                <div className="space-y-2">
                  <Label className="text-xs text-white/70 font-mono font-bold">Context</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {viewingDecision.context.sector && viewingDecision.context.sector !== "none" && (
                      <div>
                        <span className="text-xs text-white/70 font-mono">Sector:</span>
                        <p className="font-mono font-bold text-white">{viewingDecision.context.sector}</p>
                      </div>
                    )}
                    {viewingDecision.context.stage && viewingDecision.context.stage !== "none" && (
                      <div>
                        <span className="text-xs text-white/70 font-mono">Stage:</span>
                        <p className="font-mono font-bold text-white">{viewingDecision.context.stage}</p>
                      </div>
                    )}
                    {viewingDecision.context.geo && viewingDecision.context.geo !== "none" && (
                      <div>
                        <span className="text-xs text-white/70 font-mono">Geography:</span>
                        <p className="font-mono font-bold text-white">{viewingDecision.context.geo}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs text-white/70 font-mono font-bold">Reason / Notes</Label>
                {viewingDecision.notes ? (
                  <p className="mt-1 text-sm whitespace-pre-wrap text-white font-mono">{viewingDecision.notes}</p>
                ) : (
                  <p className="mt-1 text-sm text-white/50 italic font-mono">No reason or notes provided</p>
                )}
              </div>

              {viewingDecision.documentId && (
                <div>
                  <Label className="text-xs text-white/70 font-mono font-bold">Attached Document</Label>
                  {(() => {
                    const attachedDoc = documents.find((doc) => doc.id === viewingDecision.documentId);
                    return attachedDoc ? (
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-sm font-medium">{attachedDoc.title || "Untitled document"}</p>
                        {attachedDoc.storage_path && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              onOpenDocument(attachedDoc.id);
                              setViewingDecision(null);
                            }}
                          >
                            Open
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-white/70 font-mono">Document not found</p>
                    );
                  })()}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-white/30">
                <Button variant="outline" onClick={() => setViewingDecision(null)} className="border-2 border-white bg-transparent text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] font-bold">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Top Actors */}
      {stats.topActors.length > 0 && (
        <Card className="border-2 border-white bg-transparent">
          <CardHeader className="border-b-2 border-white">
            <CardTitle className="text-white font-mono font-black uppercase tracking-tight">Top Decision Makers</CardTitle>
          </CardHeader>
          <CardContent className="text-white">
            <div className="space-y-2">
              {stats.topActors.map((a, i) => (
                <div key={a.actor} className="flex items-center justify-between p-2 border-2 border-white rounded hover:border-[#FFED00] hover:bg-[#FFED00]/5 transition-all bg-transparent">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-bold text-white/70">#{i + 1}</span>
                    <span className="font-mono font-bold text-white">{a.actor}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-mono">
                    <span className="text-white/70">{a.count} decisions</span>
                    <Badge variant="outline" className={a.winRate > 50 ? "border-[#FFED00] text-[#FFED00] bg-transparent font-mono" : "border-white text-white bg-transparent font-mono"}>
                      {a.winRate}% win rate
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Decision?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the decision record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDeleteDecision(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// SOURCES TAB
// ============================================================================

function SourcesTab({
  sources,
  documents,
  onCreateSource,
  onDeleteSource,
  getGoogleAccessToken,
  onAutoLogDecision,
  onDocumentSaved,
  activeEventId,
  ensureActiveEventId,
  currentUserId,
  indexDocumentEmbeddings,
}: {
  sources: SourceRecord[];
  documents: Array<{
    id: string;
    title: string | null;
    storage_path: string | null;
    uploader_name?: string | null;
    uploader_email?: string | null;
  }>;
  onCreateSource: (
    payload: {
      title: string | null;
      source_type: SourceRecord["source_type"];
      external_url: string | null;
      storage_path?: string | null;
      tags: string[] | null;
      notes: string | null;
      status: SourceRecord["status"];
    },
    eventIdOverride?: string | null
  ) => Promise<void>;
  onDeleteSource: (sourceId: string) => Promise<void>;
  getGoogleAccessToken: () => Promise<string | null>;
  onAutoLogDecision: (input: {
    draft: { startupName: string; sector?: string; stage?: string };
    conversion: AIConversionResponse;
    sourceType: "upload" | "paste" | "api";
    fileName: string | null;
    file: File | null;
    rawContent?: string | null;
    eventIdOverride?: string | null;
  }) => Promise<void>;
  onDocumentSaved: (doc: { id: string; title: string | null; storage_path: string | null }) => void;
  activeEventId: string | null;
  ensureActiveEventId: () => Promise<string | null>;
  currentUserId: string | null;
  indexDocumentEmbeddings: (documentId: string, rawContent?: string | null) => Promise<void>;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<SourceRecord["source_type"]>("syndicate");
  const [externalUrl, setExternalUrl] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [clickUpListId, setClickUpListId] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("clickup_list_id") || "";
  });
  const [clickUpTeamId, setClickUpTeamId] = useState("");
  const [clickUpLists, setClickUpLists] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [driveUrl, setDriveUrl] = useState("");
  const [isImportingClickUp, setIsImportingClickUp] = useState(false);
  const [isImportingDrive, setIsImportingDrive] = useState(false);
  const [isUploadingLocal, setIsUploadingLocal] = useState(false);
  const [autoExtract, setAutoExtract] = useState(true);
  const MAX_IMPORT_CHARS = 24000;
  const MAX_PDF_PAGES = 6;
  const canImport = Boolean(activeEventId);
  const googleApiKey = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined;
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  
  // Debug: log env vars (remove in production)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('Google API Key present:', !!googleApiKey);
      console.log('Google Client ID present:', !!googleClientId);
    }
  }, [googleApiKey, googleClientId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const trimmed = clickUpListId.trim();
    if (trimmed) {
      localStorage.setItem("clickup_list_id", trimmed);
    }
  }, [clickUpListId]);

  const handleAdd = useCallback(async () => {
    if (!title.trim() && !externalUrl.trim()) {
      toast({
        title: "Missing details",
        description: "Add a title or a URL to create a source.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    try {
      await onCreateSource({
        title: title.trim() || null,
        source_type: sourceType,
        external_url: externalUrl.trim() || null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        notes: notes.trim() || null,
        status: "active",
      });
      setTitle("");
      setExternalUrl("");
      setTags("");
      setNotes("");
    } catch (error) {
      toast({
        title: "Create failed",
        description: error instanceof Error ? error.message : "Could not create source.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [externalUrl, onCreateSource, sourceType, tags, title, notes, toast]);

  const handleImportClickUp = useCallback(async () => {
    const eventId = activeEventId || (await ensureActiveEventId());
    if (!eventId) {
      toast({
        title: "No active event",
        description: "Create or activate an event before importing.",
        variant: "destructive",
      });
      return;
    }
    if (!clickUpListId.trim()) {
      toast({
        title: "Missing list ID",
        description: "Enter a ClickUp list ID to import tasks.",
        variant: "destructive",
      });
      return;
    }
    setIsImportingClickUp(true);
    try {
      const response = await ingestClickUpList(clickUpListId.trim(), true);
      let created = 0;
      for (const task of response.tasks || []) {
        const tagList = ["clickup", task.status || ""]
          .concat(task.assignees || [])
          .map((t) => t.trim())
          .filter(Boolean);
        await onCreateSource({
          title: task.name || "ClickUp task",
          source_type: "syndicate",
          external_url: task.url || null,
          tags: tagList.length ? tagList : null,
        notes: null,
          status: "active",
        }, eventId);
        created += 1;
      }
      toast({ title: "Import complete", description: `Imported ${created} ClickUp tasks.` });
      setClickUpListId("");
    } catch (error) {
      toast({
        title: "ClickUp import failed",
        description: error instanceof Error ? error.message : "Could not import ClickUp tasks.",
        variant: "destructive",
      });
    } finally {
      setIsImportingClickUp(false);
    }
  }, [activeEventId, clickUpListId, ensureActiveEventId, onCreateSource, toast]);

  const handleLoadClickUpLists = useCallback(async () => {
    if (!clickUpTeamId.trim()) {
      toast({
        title: "Missing team ID",
        description: "Enter a ClickUp team ID to load lists.",
        variant: "destructive",
      });
      return;
    }
    setIsLoadingLists(true);
    try {
      const response = await getClickUpLists(clickUpTeamId.trim());
      setClickUpLists(response.lists || []);
      if (response.lists?.length) {
        setSelectedListId(response.lists[0].id);
        setClickUpListId(response.lists[0].id);
      }
    } catch (error) {
      toast({
        title: "Load lists failed",
        description: error instanceof Error ? error.message : "Could not load ClickUp lists.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLists(false);
    }
  }, [clickUpTeamId, toast]);

  const readFileText = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.readAsText(file);
    });

  const isTextFile = (file: File) => {
    const name = file.name.toLowerCase();
    return (
      file.type.startsWith("text/") ||
      name.endsWith(".txt") ||
      name.endsWith(".md") ||
      name.endsWith(".csv") ||
      name.endsWith(".json")
    );
  };

  const extractPdfTextClientSide = async (file: File) => {
    const loadPdfJs = () =>
      new Promise<any>((resolve, reject) => {
        if ((window as any).pdfjsLib) {
          resolve((window as any).pdfjsLib);
          return;
        }
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        script.async = true;
        script.onload = () => resolve((window as any).pdfjsLib);
        script.onerror = () => reject(new Error("Failed to load PDF.js"));
        document.head.appendChild(script);
      });

    const pdfjs: any = await loadPdfJs();
    pdfjs.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    // Avoid worker/CORS issues in production by disabling the worker
    pdfjs.disableWorker = true;
    const buffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;
    const pageLimit = Math.min(pdf.numPages, MAX_PDF_PAGES);
    let text = "";
    for (let i = 1; i <= pageLimit; i += 1) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = (content.items as Array<{ str?: string }>)
        .map((item) => item.str || "")
        .join(" ");
      text += `\n--- Page ${i} ---\n${strings}`;
    }
    return text.trim();
  };

  const handleLocalUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (!files.length) return;

      const eventId = activeEventId || (await ensureActiveEventId());
      if (!eventId) {
        toast({
          title: "No active event",
          description: "Create or activate an event before uploading.",
          variant: "destructive",
        });
        return;
      }

      setIsUploadingLocal(true);
      try {
        let successCount = 0;

        for (const file of files) {
          // Better sanitization: replace spaces and special chars, keep extension
          const ext = file.name.includes(".") ? file.name.substring(file.name.lastIndexOf(".")) : "";
          const baseName = file.name.replace(ext, "").replace(/[^a-zA-Z0-9._-]/g, "_") || "document";
          const safeName = `${baseName}${ext}`;
          const timestamp = Date.now();
          const path = `${eventId}/${timestamp}-${safeName}`;

          // Try to extract content first (for PDFs and other files)
          let rawContent: string | null = null;
          let extractedJson: Record<string, any> = {};
          let detectedType: string | null = file.type || "file";

          if (isTextFile(file)) {
            // Read text files directly
            try {
              const text = await readFileText(file);
              rawContent = text.length > MAX_IMPORT_CHARS ? `${text.slice(0, MAX_IMPORT_CHARS)}…` : text;
            } catch (err) {
              console.error("Error reading text file:", err);
              rawContent = null;
            }
          } else {
            // For non-text files, try converter API (PDF/DOCX/XLSX/etc.)
            try {
              const conversion = await convertFileWithAI(file);
              rawContent = conversion.raw_content ?? null;
              extractedJson = conversion as unknown as Record<string, any>;
              detectedType = conversion.detectedType || detectedType;
            } catch (err) {
              console.error("Error converting file:", err);
              // Continue without content - will store file reference
            }

            // If PDF and still no text, try client-side fallback
            if (!rawContent && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
              try {
                rawContent = await extractPdfTextClientSide(file);
              } catch (err) {
                console.error("Client-side PDF extraction failed:", err);
              }
            }
            if (!rawContent) {
              toast({
                title: "No text extracted",
                description:
                  "We couldn't extract text from this file. If it's a PDF, redeploy the converter with CORS_ALLOW_ORIGINS or try a text-based file.",
                variant: "destructive",
              });
            }
          }

          // Try to upload to storage (optional - don't fail if this fails)
          let storagePath: string | null = null;
          try {
            const { error: uploadError } = await supabase.storage
              .from("cis-documents")
              .upload(path, file, { upsert: true });
            if (!uploadError) {
              storagePath = path;
            } else {
              console.warn("Storage upload failed (non-fatal):", uploadError.message);
              // Continue without storage - document will still be saved
            }
          } catch (storageErr) {
            console.warn("Storage upload error (non-fatal):", storageErr);
            // Continue without storage
          }

          // Extract a better title from file name (remove extension, clean up)
          const getDocumentTitle = (fileName: string | null): string => {
            if (!fileName) return "Uploaded document";
            // Remove file extension
            const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
            // Remove random IDs like "document-1tWiD79w" -> "document"
            const cleaned = nameWithoutExt.replace(/-\w{8,}$/, "").trim();
            // If it's just "document" or empty, use a better default
            if (!cleaned || cleaned.toLowerCase() === "document") {
              return "Uploaded document";
            }
            return cleaned;
          };

          // Save document record (even if storage upload failed)
          const { data: doc, error: docError } = await insertDocument(eventId, {
            title: getDocumentTitle(file.name),
            source_type: "upload",
            file_name: file.name || null,
            storage_path: storagePath,
            detected_type: detectedType,
            extracted_json: extractedJson,
            raw_content: rawContent,
            created_by: currentUserId || null,
          });

          if (docError || !doc) {
            toast({
              title: "Document save failed",
              description: docError?.message || `Could not save ${file.name}`,
              variant: "destructive",
            });
            continue;
          }

          const docRecord = doc as { id?: string; title?: string | null; storage_path?: string | null } | null;
          if (!docRecord?.id) {
            toast({
              title: "Document save failed",
              description: `Could not save ${file.name} - no ID returned`,
              variant: "destructive",
            });
            continue;
          }

          onDocumentSaved({
            id: docRecord.id,
            title: docRecord.title || null,
            storage_path: docRecord.storage_path || null,
          });

          // Create a source entry for the uploaded file
          try {
            // Use the same cleaned title logic
            const getDocumentTitle = (fileName: string | null): string => {
              if (!fileName) return "Uploaded document";
              const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
              const cleaned = nameWithoutExt.replace(/-\w{8,}$/, "").trim();
              if (!cleaned || cleaned.toLowerCase() === "document") {
                return "Uploaded document";
              }
              return cleaned;
            };
            await onCreateSource({
              title: getDocumentTitle(file.name),
              source_type: "notes",
              external_url: null,
              storage_path: storagePath,
              tags: ["local-upload", detectedType || "file"],
              notes: rawContent ? `Content extracted: ${rawContent.length} characters` : null,
              status: "active",
            }, eventId);
          } catch (sourceErr) {
            console.error("Error creating source:", sourceErr);
            // Non-fatal - document is saved, source creation can fail
          }

          // Index embeddings if we have content
          if (rawContent && docRecord.id) {
            try {
              await indexDocumentEmbeddings(docRecord.id, rawContent);
            } catch (embedErr) {
              console.error("Error indexing embeddings:", embedErr);
              // Non-fatal - document is saved
            }
          }

          successCount += 1;
        }

        if (successCount > 0) {
          toast({
            title: "Upload complete",
            description: `Uploaded ${successCount} file${successCount > 1 ? "s" : ""}.`,
          });
        }
      } catch (err) {
        toast({
          title: "Upload error",
          description: err instanceof Error ? err.message : "An unexpected error occurred.",
          variant: "destructive",
        });
      } finally {
        setIsUploadingLocal(false);
        e.target.value = "";
      }
    },
    [activeEventId, currentUserId, ensureActiveEventId, indexDocumentEmbeddings, onDocumentSaved, toast]
  );

  const importDriveUrl = useCallback(async (url: string) => {
    const eventId = activeEventId || (await ensureActiveEventId());
    if (!eventId) {
      toast({
        title: "No active event",
        description: "Create or activate an event before importing.",
        variant: "destructive",
      });
      return;
    }
    if (!url.trim()) {
      toast({
        title: "Missing Drive link",
        description: "Paste or choose a Google Drive file to import.",
        variant: "destructive",
      });
      return;
    }
    setIsImportingDrive(true);
    try {
      const accessToken = await getGoogleAccessToken();
      if (!accessToken) {
        toast({
          title: "Google Drive access needed",
          description: "Please sign in again with Google Drive access enabled.",
          variant: "destructive",
        });
        return;
      }
      const result = await ingestGoogleDrive(url.trim(), accessToken);
      console.log("Drive import result:", { title: result.title, hasContent: !!result.content, hasRaw: !!result.raw_content });
      
      // Extract better title from Google Drive
      const extractTitleFromGoogleDrive = (title: string | null | undefined, content: string | null | undefined, url: string): string => {
        // First, try to extract from content (look for first heading or title)
        if (content) {
          // Look for markdown-style headings
          const headingMatch = content.match(/^#+\s+(.+)$/m);
          if (headingMatch && headingMatch[1]) {
            const extracted = headingMatch[1].trim();
            if (extracted.length > 3 && extracted.length < 100) {
              return extracted;
            }
          }
          // Look for first line that looks like a title (capitalized, short)
          const lines = content.split('\n').filter(l => l.trim().length > 0);
          for (const line of lines.slice(0, 5)) {
            const trimmed = line.trim();
            if (trimmed.length > 5 && trimmed.length < 80 && /^[A-Z]/.test(trimmed)) {
              // Check if it's not just a sentence
              if (!trimmed.includes('.') || trimmed.split('.').length <= 2) {
                return trimmed;
              }
            }
          }
        }
        
        // Try to extract from URL (Google Docs URLs sometimes have the doc name)
        const urlMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (urlMatch) {
          // Can't get name from ID, but we can try the title
        }
        
        // Clean up the provided title
        if (title) {
          const nameWithoutExt = title.replace(/\.[^/.]+$/, "");
          const cleaned = nameWithoutExt
            .replace(/-\w{8,}$/, "") // Remove random IDs
            .replace(/^notes\s+/i, "") // Remove "notes" prefix
            .replace(/^google\s+drive\s+document$/i, "") // Remove generic text
            .trim();
          if (cleaned && cleaned.toLowerCase() !== "document" && cleaned.length > 3) {
            return cleaned;
          }
        }
        
        // Fallback: try to use URL to suggest a name
        return "Google Drive Document";
      };
      
      const cleanedTitle = extractTitleFromGoogleDrive(
        result.title,
        result.raw_content || result.content,
        url.trim()
      );
      
      await onCreateSource({
        title: cleanedTitle,
        source_type: "notes",
        external_url: url.trim(),
        tags: ["google-drive"],
        notes: null,
        status: "active",
      }, eventId);
      toast({ title: "Drive import complete", description: "Source saved to your library." });

      const rawContent = result.raw_content || result.content;
      let autoLogged = false;
      let conversionResult: AIConversionResponse | null = null;
      if (autoExtract && rawContent) {
        const content = rawContent.length > MAX_IMPORT_CHARS ? rawContent.slice(0, MAX_IMPORT_CHARS) : rawContent;
        conversionResult = await convertWithAI(content);
        const primary = conversionResult.startups?.[0];
        if (primary?.companyName) {
          await onAutoLogDecision({
            draft: {
              startupName: primary.companyName || "Unknown Company",
              sector: primary.industry || undefined,
              stage: primary.fundingStage || undefined,
            },
            conversion: conversionResult,
            sourceType: "api",
            fileName: result.title || null,
            file: null,
            rawContent, // Store the raw content from Google Drive
            eventIdOverride: eventId,
          });
          autoLogged = true;
          toast({ title: "Decision logged", description: "Auto-created from Drive extraction." });
        } else if (conversionResult.errors?.length) {
          toast({ title: "Extraction warning", description: conversionResult.errors[0], variant: "destructive" });
        } else {
          toast({ title: "No startup detected", description: "Extraction completed, but no company was found." });
        }
      }

      if (!rawContent) {
        toast({
          title: "Drive import note",
          description: "Drive returned no text content. Saving the source without raw text.",
        });
      }

      // Always create a document, even if auto-logged (document might be created by onAutoLogDecision)
      // But if auto-logged didn't create one, create it here
      if (!autoLogged) {
        try {
          // Clean title for document too
          const cleanTitle = (title: string | null | undefined): string => {
            if (!title) return "Google Drive document";
            const nameWithoutExt = title.replace(/\.[^/.]+$/, "");
            const cleaned = nameWithoutExt.replace(/-\w{8,}$/, "").replace(/^notes\s+/i, "").trim();
            if (!cleaned || cleaned.toLowerCase() === "document") {
              return "Google Drive document";
            }
            return cleaned;
          };
          
          const { data: doc, error: docError } = await insertDocument(eventId, {
            title: cleanedTitle,
            source_type: "api",
            file_name: result.title || cleanedTitle || null,
            storage_path: null,
            detected_type: conversionResult?.detectedType || null,
            extracted_json: (conversionResult || {}) as Record<string, any>,
            raw_content: rawContent || null,
            created_by: currentUserId || null,
          });
          const docRecord = doc as { id?: string; title?: string | null; storage_path?: string | null } | null;
          if (docError) {
            console.error("Document insert error:", docError);
            toast({
              title: "Document save failed",
              description: docError.message || JSON.stringify(docError),
              variant: "destructive",
            });
          } else if (!docRecord?.id) {
            console.error("Document insert returned no ID:", doc);
            toast({
              title: "Document save failed",
              description: "Insert succeeded but no document ID returned.",
              variant: "destructive",
            });
          } else {
            onDocumentSaved({
              id: docRecord.id,
              title: docRecord.title || null,
              storage_path: docRecord.storage_path || null,
            });
            toast({ title: "Document saved", description: "Raw content stored in Documents." });
            await indexDocumentEmbeddings(docRecord.id, rawContent || null);
          }
        } catch (err) {
          console.error("Exception during document insert:", err);
          toast({
            title: "Document save error",
            description: err instanceof Error ? err.message : "Unexpected error saving document.",
            variant: "destructive",
          });
        }
      }

      setDriveUrl("");
    } catch (error) {
      toast({
        title: "Drive import failed",
        description: error instanceof Error ? error.message : "Could not import Google Drive file.",
        variant: "destructive",
      });
    } finally {
      setIsImportingDrive(false);
    }
  }, [activeEventId, autoExtract, currentUserId, ensureActiveEventId, getGoogleAccessToken, onAutoLogDecision, onCreateSource, onDocumentSaved, toast]);

  const handleImportDrive = useCallback(async () => {
    await importDriveUrl(driveUrl.trim());
  }, [driveUrl, importDriveUrl]);

  const openDrivePicker = useCallback(async () => {
    if (!googleApiKey || !googleClientId) {
      toast({
        title: "Google Picker not configured",
        description: "Set VITE_GOOGLE_API_KEY and VITE_GOOGLE_CLIENT_ID to use Drive picker.",
        variant: "destructive",
      });
      return;
    }
    const accessToken = await getGoogleAccessToken();
    if (!accessToken) {
      toast({
        title: "Google Drive access needed",
        description: "Please sign in again with Google Drive access enabled.",
        variant: "destructive",
      });
      return;
    }
    try {
      await loadGooglePicker();
      const view = new window.google.picker.DocsView()
        .setIncludeFolders(false)
        .setSelectFolderEnabled(false)
        .setMimeTypes(
          "application/vnd.google-apps.document,application/vnd.google-apps.spreadsheet,application/vnd.google-apps.presentation"
        );
      const picker = new window.google.picker.PickerBuilder()
        .setDeveloperKey(googleApiKey)
        .setOAuthToken(accessToken)
        .addView(view)
        .setCallback((data: any) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const doc = data.docs?.[0];
            const pickedUrl = doc?.url;
            if (pickedUrl) {
              setDriveUrl(pickedUrl);
              importDriveUrl(pickedUrl);
            }
          }
        })
        .build();
      picker.setVisible(true);
    } catch (error) {
      toast({
        title: "Drive picker failed",
        description: error instanceof Error ? error.message : "Could not open Drive picker.",
        variant: "destructive",
      });
    }
  }, [getGoogleAccessToken, googleApiKey, googleClientId, importDriveUrl, toast]);

  return (
    <div className="space-y-6">
      {!canImport && (
        <Card className="border-2 border-white bg-transparent">
          <CardContent className="pt-4 text-sm text-white/70 font-mono">
            Loading your active event... Imports will be available in a moment.
          </CardContent>
        </Card>
      )}
      <Card className="border-2 border-white bg-transparent">
        <CardHeader className="border-b-2 border-white">
          <CardTitle className="text-white font-mono font-black uppercase tracking-tight">ClickUp Import</CardTitle>
          <CardDescription className="text-white/70 font-mono">Pull syndicate tasks directly from a ClickUp list.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-white font-mono font-bold">ClickUp Team ID</Label>
              <Input
                value={clickUpTeamId}
                onChange={(e) => setClickUpTeamId(e.target.value)}
                placeholder="e.g., 1234567"
                className="border-2 border-white bg-transparent text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <Label className="text-white font-mono font-bold">Available Lists</Label>
              <Select
                value={selectedListId}
                onValueChange={(value) => {
                  setSelectedListId(value);
                  setClickUpListId(value);
                }}
              >
                <SelectTrigger className="border-2 border-white bg-transparent text-white">
                  <SelectValue placeholder="Select a list" />
                </SelectTrigger>
                <SelectContent className="bg-[#050505] border-2 border-white">
                  {clickUpLists.filter((list) => list.id && list.id.trim().length > 0).length === 0 ? (
                    <SelectItem value="no-lists" disabled className="text-white/50">
                      No lists loaded
                    </SelectItem>
                  ) : (
                    clickUpLists
                      .filter((list) => list.id && list.id.trim().length > 0)
                      .map((list) => (
                      <SelectItem key={list.id} value={list.id} className="text-white">
                        {list.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleLoadClickUpLists} disabled={isLoadingLists} className="w-full border-2 border-white bg-transparent text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] font-bold disabled:opacity-50" variant="outline">
                {isLoadingLists ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Folder className="h-4 w-4 mr-2" />}
                Load Lists
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label className="text-white font-mono font-bold">ClickUp List ID (manual)</Label>
              <Input
                value={clickUpListId}
                onChange={(e) => setClickUpListId(e.target.value)}
                placeholder="e.g., 90120481234"
                className="border-2 border-white bg-transparent text-white placeholder:text-white/50"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleImportClickUp} disabled={isImportingClickUp} className="w-full bg-[#FFED00] text-black hover:bg-[#FFED00]/80 font-bold border-2 border-[#FFED00] transition-all hover:shadow-[0_0_20px_rgba(255,237,0,0.5)] disabled:opacity-50">
                {isImportingClickUp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Import ClickUp
              </Button>
            </div>
          </div>
          <p className="text-xs text-white/70 font-mono">
            Uses server-side token. Ask admin to set CLICKUP_API_TOKEN in the converter service.
          </p>
        </CardContent>
      </Card>

      <Card className="border-2 border-white bg-transparent">
        <CardHeader className="border-b-2 border-white">
          <CardTitle className="text-white font-mono font-black uppercase tracking-tight">Local Upload</CardTitle>
          <CardDescription className="text-white/70 font-mono">Upload files from your computer into Sources.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="file"
            multiple
            disabled={!canImport || isUploadingLocal}
            onChange={handleLocalUpload}
            accept=".txt,.md,.csv,.json,.pdf,.docx,.xlsx,.xls"
          />
          <p className="text-xs text-white/70 font-mono">
            Text files (.txt, .md, .csv, .json) are indexed for search. Other files are stored and can be referenced later.
          </p>
        </CardContent>
      </Card>

      <Card className="border-2 border-white bg-transparent">
        <CardHeader className="border-b-2 border-white">
          <CardTitle className="text-white font-mono font-black uppercase tracking-tight">Google Drive Import</CardTitle>
          <CardDescription className="text-white/70 font-mono">Paste a Google Docs/Slides/Sheets link to register it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label className="text-white font-mono font-bold">Drive URL</Label>
              <Input
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                placeholder="https://docs.google.com/document/d/..."
                className="border-2 border-white bg-transparent text-white placeholder:text-white/50"
              />
            </div>
            <div className="flex items-end">
              <div className="flex w-full flex-col gap-2">
                <Button onClick={openDrivePicker} variant="outline" className="w-full border-2 border-white bg-transparent text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] font-bold">
                  <Folder className="h-4 w-4 mr-2" />
                  Choose from Drive
                </Button>
                <Button onClick={handleImportDrive} disabled={isImportingDrive} className="w-full bg-[#FFED00] text-black hover:bg-[#FFED00]/80 font-bold border-2 border-[#FFED00] transition-all hover:shadow-[0_0_20px_rgba(255,237,0,0.5)] disabled:opacity-50">
                  {isImportingDrive ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Import Drive
                </Button>
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-white/70 font-mono">
            <Checkbox checked={autoExtract} onCheckedChange={(val) => setAutoExtract(val === true)} className="border-white data-[state=checked]:bg-[#FFED00] data-[state=checked]:border-[#FFED00]" />
            Auto-extract and log decision after import
          </label>
          <p className="text-xs text-white/70 font-mono">
            Uses your Google Drive OAuth token. If access fails, sign out and sign in again.
          </p>
        </CardContent>
      </Card>

      <Card className="border-2 border-white bg-transparent">
        <CardHeader className="border-b-2 border-white">
          <CardTitle className="text-white font-mono font-black uppercase tracking-tight">Source Library</CardTitle>
          <CardDescription className="text-white/70 font-mono">Track syndicates, company decks, and notes in one place.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-white font-mono font-bold">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Syndicate: Astor Ventures"
                className="border-2 border-white bg-transparent text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <Label className="text-white font-mono font-bold">Source Type</Label>
              <Select value={sourceType} onValueChange={(value) => setSourceType(value as SourceRecord["source_type"])}>
                <SelectTrigger className="border-2 border-white bg-transparent text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#050505] border-2 border-white">
                  <SelectItem value="syndicate" className="text-white">Syndicate</SelectItem>
                  <SelectItem value="company" className="text-white">Company</SelectItem>
                  <SelectItem value="deck" className="text-white">Deck</SelectItem>
                  <SelectItem value="notes" className="text-white">Notes</SelectItem>
                  <SelectItem value="other" className="text-white">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white font-mono font-bold">External URL (optional)</Label>
              <Input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://docs.google.com/..."
                className="border-2 border-white bg-transparent text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <Label className="text-white font-mono font-bold">Tags (comma separated)</Label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="SEA, fintech, seed"
                className="border-2 border-white bg-transparent text-white placeholder:text-white/50"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-white font-mono font-bold">Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add context, key points, or reminders..."
                className="border-2 border-white bg-transparent text-white placeholder:text-white/50 font-mono"
              />
            </div>
          </div>
          <Button onClick={handleAdd} disabled={isSaving} className="bg-[#FFED00] text-black hover:bg-[#FFED00]/80 font-bold border-2 border-[#FFED00] transition-all hover:shadow-[0_0_20px_rgba(255,237,0,0.5)] disabled:opacity-50">
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Add Source
          </Button>
        </CardContent>
      </Card>

      <Card className="border-2 border-white bg-transparent">
        <CardHeader className="border-b-2 border-white">
          <CardTitle className="text-white font-mono font-black uppercase tracking-tight">Tracked Sources</CardTitle>
          <CardDescription className="text-white/70 font-mono">{sources.length} items</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-white">
          {sources.length === 0 ? (
            <div className="text-sm text-white/70 font-mono">No sources yet. Add your first syndicate or company source.</div>
          ) : (
            sources.map((source) => (
              <div key={source.id} className="flex items-center justify-between gap-3 border-2 border-white rounded-md p-3 hover:border-[#FFED00] hover:bg-[#FFED00]/5 transition-all bg-transparent">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-white text-white bg-transparent font-mono">{source.source_type}</Badge>
                    {source.status !== "active" && <Badge variant="outline" className="border-white/50 text-white/50 bg-transparent font-mono">{source.status}</Badge>}
                  </div>
                  <div className="font-mono font-bold text-white">{source.title || "Untitled source"}</div>
                  {source.external_url && (
                    <div className="text-xs text-white/70 font-mono truncate max-w-[420px]">{source.external_url}</div>
                  )}
                  {(() => {
                    // Find document for this source to show uploader
                    const relatedDoc = documents.find((d: any) => 
                      d.storage_path === source.storage_path || 
                      d.title === source.title
                    );
                    if (relatedDoc && (relatedDoc.uploader_email || relatedDoc.uploader_name)) {
                      return (
                        <div className="text-xs text-white/70 font-mono">
                          Uploaded by: {relatedDoc.uploader_name || relatedDoc.uploader_email}
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {source.notes && (
                    <div className="text-sm text-white/70 font-mono whitespace-pre-wrap">{source.notes}</div>
                  )}
                  {source.tags && source.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {source.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs border-white text-white bg-transparent font-mono">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {source.external_url && (
                    <Button variant="outline" size="sm" asChild className="border-2 border-white bg-transparent text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] font-bold">
                      <a href={source.external_url} target="_blank" rel="noreferrer">
                        <Link2 className="h-4 w-4 mr-1" />
                        Open
                      </a>
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => onDeleteSource(source.id)} className="text-white/70 hover:text-white hover:bg-white/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// DASHBOARD TAB
// ============================================================================

function DashboardTab({
  decisions,
  documents,
  sources,
}: {
  decisions: Decision[];
  documents: Array<{ id: string; title: string | null; storage_path: string | null }>;
  sources: SourceRecord[];
}) {
  const stats = useMemo(() => calculateDecisionStats(decisions), [decisions]);
  const latestDecision = decisions[0];
  const latestDocument = documents[0];
  const latestSource = sources[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-2 border-white bg-transparent">
          <CardContent className="pt-4 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 border-2 border-white rounded-lg bg-transparent">
                <ClipboardList className="h-5 w-5 text-[#FFED00]" />
              </div>
              <div>
                <p className="text-2xl font-mono font-black">{stats.totalDecisions}</p>
                <p className="text-xs text-white/70 font-mono uppercase tracking-wider">Decisions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-white bg-transparent">
          <CardContent className="pt-4 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 border-2 border-white rounded-lg bg-transparent">
                <FileText className="h-5 w-5 text-[#FFED00]" />
              </div>
              <div>
                <p className="text-2xl font-mono font-black">{documents.length}</p>
                <p className="text-xs text-white/70 font-mono uppercase tracking-wider">Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-white bg-transparent">
          <CardContent className="pt-4 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 border-2 border-white rounded-lg bg-transparent">
                <Folder className="h-5 w-5 text-[#FFED00]" />
              </div>
              <div>
                <p className="text-2xl font-mono font-black">{sources.length}</p>
                <p className="text-xs text-white/70 font-mono uppercase tracking-wider">Sources</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-white bg-transparent">
          <CardContent className="pt-4 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 border-2 border-[#FFED00] rounded-lg bg-transparent">
                <TrendingUp className="h-5 w-5 text-[#FFED00]" />
              </div>
              <div>
                <p className="text-2xl font-mono font-black">{stats.byOutcome.positive || 0}</p>
                <p className="text-xs text-white/70 font-mono uppercase tracking-wider">Positive</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-2 border-white bg-transparent">
          <CardHeader className="border-b-2 border-white">
            <CardTitle className="text-base text-white font-mono font-black uppercase tracking-tight">Latest Decision</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-white/70 font-mono">
            {latestDecision ? (
              <div className="space-y-1">
                <div className="font-mono font-bold text-white">{latestDecision.startupName}</div>
                <div className="font-mono">{latestDecision.actionType} {latestDecision.outcome ? `(${latestDecision.outcome})` : ""}</div>
                {latestDecision.notes && <div className="font-mono">{latestDecision.notes}</div>}
              </div>
            ) : (
              "No decisions yet."
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-white bg-transparent">
          <CardHeader className="border-b-2 border-white">
            <CardTitle className="text-base text-white font-mono font-black uppercase tracking-tight">Latest Document</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-white/70 font-mono">
            {latestDocument ? (
              <div className="space-y-1">
                <div className="font-mono font-bold text-white">
                  {latestDocument.title || "Untitled document"}
                </div>
                <div className="text-xs font-mono">Stored in CIS documents</div>
              </div>
            ) : (
              "No documents yet."
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-white bg-transparent">
          <CardHeader className="border-b-2 border-white">
            <CardTitle className="text-base text-white font-mono font-black uppercase tracking-tight">Latest Source</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-white/70 font-mono">
            {latestSource ? (
              <div className="space-y-1">
                <div className="font-mono font-bold text-white">{latestSource.title || "Untitled source"}</div>
                <div className="text-xs font-mono">{latestSource.source_type}</div>
              </div>
            ) : (
              "No sources yet."
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// ONBOARDING TAB
// ============================================================================

function OnboardingTab({
  profile,
  sources,
  documents,
  decisions,
  onNavigate,
}: {
  profile: UserProfile | null;
  sources: SourceRecord[];
  documents: Array<{ id: string; title: string | null; storage_path: string | null }>;
  decisions: Decision[];
  onNavigate: (tab: string) => void;
}) {
  const orgLinked = Boolean(profile?.organization_id);
  const hasSources = sources.length > 0;
  const hasDocuments = documents.length > 0;
  const hasDecisions = decisions.length > 0;

  const steps = [
    {
      title: "Fund profile & access",
      status: orgLinked,
      description: "Confirm organization is linked and team access is scoped to your fund.",
      action: () => onNavigate("overview"),
      actionLabel: "View Org Overview",
    },
    {
      title: "Sync fund sources",
      status: hasSources,
      description: "Connect ClickUp or Google Drive, or upload files into Sources.",
      action: () => onNavigate("sources"),
      actionLabel: "Open Sources",
    },
    {
      title: "Index key documents",
      status: hasDocuments,
      description: "Upload IC notes, memos, LPAs, portfolio updates, and meeting notes.",
      action: () => onNavigate("sources"),
      actionLabel: "Add Documents",
    },
    {
      title: "Log decisions",
      status: hasDecisions,
      description: "Record investment decisions with confidence, stage, and rationale.",
      action: () => onNavigate("decisions"),
      actionLabel: "Open Decision Logger",
    },
    {
      title: "Review analytics",
      status: decisions.length >= 5,
      description: "Unlock Decision Engine analytics with at least 5 decisions.",
      action: () => onNavigate("dashboard"),
      actionLabel: "Open Decision Engine",
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-2 border-white bg-transparent">
        <CardHeader className="border-b-2 border-white">
          <CardTitle className="flex items-center gap-2 text-white font-mono font-black uppercase tracking-tight">
            <Sparkles className="h-5 w-5 text-[#FFED00]" />
            Tier 2 VC Fund Onboarding
          </CardTitle>
          <CardDescription className="text-white/70 font-mono">
            Recommended onboarding flow for VC teams. Complete the steps below to unlock full
            intelligence and analytics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-white">
          {steps.map((step) => (
            <div key={step.title} className="flex items-start justify-between gap-4 border-2 border-white rounded-md p-4 bg-transparent hover:border-[#FFED00] hover:bg-[#FFED00]/5 transition-all">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {step.status ? (
                    <CheckCircle className="h-4 w-4 text-[#FFED00]" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-white/50" />
                  )}
                  <span className="font-mono font-bold text-white">{step.title}</span>
                  <Badge variant="outline" className={step.status ? "border-[#FFED00] text-[#FFED00] bg-transparent font-mono text-xs" : "border-white/50 text-white/50 bg-transparent font-mono text-xs"}>
                    {step.status ? "Complete" : "Pending"}
                  </Badge>
                </div>
                <p className="text-sm text-white/70 font-mono">{step.description}</p>
              </div>
              <Button variant="outline" size="sm" onClick={step.action} className="border-2 border-white bg-transparent text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] font-bold">
                {step.actionLabel}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {(profile?.role === "managing_partner" || profile?.role === "organizer") && (
        <>
          <TeamInvitationForm />
          {profile?.organization_id && <TeamMembersList />}
          {profile?.organization_id && <SyncStatus />}
        </>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-2 border-white bg-transparent">
          <CardHeader className="border-b-2 border-white">
            <CardTitle className="text-base text-white font-mono font-black uppercase tracking-tight">Recommended Fund Data</CardTitle>
            <CardDescription className="text-white/70 font-mono">Prioritize these sources for strong answers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-white/70 font-mono">
            <ul className="list-disc pl-4 space-y-1">
              <li>IC memos, diligence notes, and investment theses</li>
              <li>Portfolio updates, KPIs, and board decks</li>
              <li>LPAs, fund overview, and mandate documents</li>
              <li>Partner meeting notes and email summaries</li>
              <li>CRM exports, deal flow logs, and pipeline snapshots</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-2 border-white bg-transparent">
          <CardHeader className="border-b-2 border-white">
            <CardTitle className="text-base text-white font-mono font-black uppercase tracking-tight">Sync Guidance</CardTitle>
            <CardDescription className="text-white/70 font-mono">Fastest path to a live knowledge base.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-white/70 font-mono">
            <div className="space-y-1">
              <div className="font-mono font-bold text-white">Google Drive</div>
              <p>Import key docs directly from Drive to keep investment materials current.</p>
            </div>
            <div className="space-y-1">
              <div className="font-mono font-bold text-white">ClickUp</div>
              <p>Sync pipeline tasks and IC checklists for real-time deal visibility.</p>
            </div>
            <div className="space-y-1">
              <div className="font-mono font-bold text-white">Manual Uploads</div>
              <p>Upload PDFs, spreadsheets, and memos for immediate indexing.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// DECISION ENGINE DASHBOARD TAB
// ============================================================================

function DecisionEngineDashboardTab({ decisions }: { decisions: Decision[] }) {
  const [selectedSector, setSelectedSector] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedPartner, setSelectedPartner] = useState<string>("all");

  // Filter decisions based on selected filters
  const filteredDecisions = useMemo(() => {
    return decisions.filter((d) => {
      if (selectedSector !== "all" && d.context?.sector !== selectedSector) return false;
      if (selectedStage !== "all" && d.context?.stage !== selectedStage) return false;
      if (selectedPartner !== "all" && d.actor !== selectedPartner) return false;
      return true;
    });
  }, [decisions, selectedSector, selectedStage, selectedPartner]);

  const analytics = useMemo(() => calculateDecisionEngineAnalytics(filteredDecisions), [filteredDecisions]);
  const hasEnoughData = filteredDecisions.length >= 5;

  const partnerOutcomeSeries = useMemo(
    () =>
      analytics.partnerStats.map((p) => ({
        partner: p.partner,
        positive: p.positiveOutcomes,
        negative: p.negativeOutcomes,
        pending: p.pendingOutcomes,
        avgDecisionVelocity: p.avgDecisionVelocity,
      })),
    [analytics.partnerStats]
  );

  const actionConversionSeries = useMemo(
    () =>
      analytics.actionTypeStats.map((a) => ({
        action: a.action,
        conversionRate: a.total ? Math.round((a.positive / a.total) * 100) : 0,
        total: a.total,
      })),
    [analytics.actionTypeStats]
  );

  const confidenceRateSeries = useMemo(
    () =>
      analytics.confidenceBuckets.map((b) => ({
        range: b.range,
        positiveRate: b.count ? Math.round((b.positive / b.count) * 100) : 0,
        total: b.count,
      })),
    [analytics.confidenceBuckets]
  );

  // Get unique values for filters
  const sectors = useMemo(() => {
    const unique = new Set(
      decisions
        .map((d) => d.context?.sector)
        .filter((value): value is string => !!value && value.trim().length > 0)
        .map((value) => value.trim())
    );
    return Array.from(unique).sort();
  }, [decisions]);

  const stages = useMemo(() => {
    const unique = new Set(
      decisions
        .map((d) => d.context?.stage)
        .filter((value): value is string => !!value && value.trim().length > 0)
        .map((value) => value.trim())
    );
    return Array.from(unique).sort();
  }, [decisions]);

  const partners = useMemo(() => {
    const unique = new Set(
      decisions
        .map((d) => d.actor)
        .filter((value): value is string => !!value && value.trim().length > 0)
        .map((value) => value.trim())
    );
    return Array.from(unique).sort();
  }, [decisions]);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border-2 border-white bg-transparent">
        <CardHeader className="border-b-2 border-white">
          <CardTitle className="text-white font-mono font-black uppercase tracking-tight">Filters</CardTitle>
          <CardDescription className="text-white/70 font-mono">Filter decisions by sector, stage, or partner</CardDescription>
        </CardHeader>
        <CardContent className="text-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-white font-mono font-bold">Sector</Label>
              <Select value={selectedSector} onValueChange={setSelectedSector}>
                <SelectTrigger className="border-2 border-white bg-transparent text-white">
                  <SelectValue placeholder="All sectors" />
                </SelectTrigger>
                <SelectContent className="bg-[#050505] border-2 border-white">
                  <SelectItem value="all" className="text-white">All sectors</SelectItem>
                  {sectors.map((sector) => (
                    <SelectItem key={sector} value={sector} className="text-white">
                      {sector}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white font-mono font-bold">Stage</Label>
              <Select value={selectedStage} onValueChange={setSelectedStage}>
                <SelectTrigger className="border-2 border-white bg-transparent text-white">
                  <SelectValue placeholder="All stages" />
                </SelectTrigger>
                <SelectContent className="bg-[#050505] border-2 border-white">
                  <SelectItem value="all" className="text-white">All stages</SelectItem>
                  {stages.map((stage) => (
                    <SelectItem key={stage} value={stage} className="text-white">
                      {stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white font-mono font-bold">Partner</Label>
              <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                <SelectTrigger className="border-2 border-white bg-transparent text-white">
                  <SelectValue placeholder="All partners" />
                </SelectTrigger>
                <SelectContent className="bg-[#050505] border-2 border-white">
                  <SelectItem value="all" className="text-white">All partners</SelectItem>
                  {partners.map((partner) => (
                    <SelectItem key={partner} value={partner} className="text-white">
                      {partner}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(selectedSector !== "all" || selectedStage !== "all" || selectedPartner !== "all") && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedSector("all");
                  setSelectedStage("all");
                  setSelectedPartner("all");
                }}
                className="border-2 border-white bg-transparent text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] font-bold"
              >
                Clear filters ({filteredDecisions.length} decisions)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-2 border-white bg-transparent">
          <CardContent className="pt-4 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 border-2 border-white rounded-lg bg-transparent">
                <Target className="h-5 w-5 text-[#FFED00]" />
              </div>
              <div>
                <p className="text-2xl font-mono font-black">{analytics.totalDecisions}</p>
                <p className="text-xs text-white/70 font-mono uppercase tracking-wider">Decisions Logged</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-white bg-transparent">
          <CardContent className="pt-4 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 border-2 border-[#FFED00] rounded-lg bg-transparent">
                <TrendingUp className="h-5 w-5 text-[#FFED00]" />
              </div>
              <div>
                <p className="text-2xl font-mono font-black">{analytics.positiveRate}%</p>
                <p className="text-xs text-white/70 font-mono uppercase tracking-wider">Positive Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-white bg-transparent">
          <CardContent className="pt-4 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 border-2 border-white rounded-lg bg-transparent">
                <BarChart3 className="h-5 w-5 text-[#FFED00]" />
              </div>
              <div className="flex-1">
                <p className="text-2xl font-mono font-black">{analytics.avgConfidence}%</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-xs text-white/70 font-mono cursor-help">
                        Avg Confidence
                        <span className="ml-1">ℹ️</span>
                      </p>
                    </TooltipTrigger>
                    <TooltipContent className="bg-[#050505] border-2 border-white text-white">
                      <p className="max-w-xs font-mono">
                        Average confidence score (0-100) you assigned when logging decisions.
                        <br />
                        Higher = more certain about the decision.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-white bg-transparent">
          <CardContent className="pt-4 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 border-2 border-white rounded-lg bg-transparent">
                <Clock className="h-5 w-5 text-[#FFED00]" />
              </div>
              <div>
                <p className="text-2xl font-mono font-black">{analytics.avgDecisionVelocity}</p>
                <p className="text-xs text-white/70 font-mono uppercase tracking-wider">Avg Velocity (days)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {hasEnoughData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-2 border-white bg-transparent">
            <CardContent className="pt-4 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 border-2 border-white rounded-lg bg-transparent">
                  <Clock className="h-5 w-5 text-[#FFED00]" />
                </div>
                <div>
                  <p className="text-2xl font-mono font-black">{analytics.recencyStats.last7}</p>
                  <p className="text-xs text-white/70 font-mono uppercase tracking-wider">Decisions (7d)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-2 border-white bg-transparent">
            <CardContent className="pt-4 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 border-2 border-white rounded-lg bg-transparent">
                  <TrendingUp className="h-5 w-5 text-[#FFED00]" />
                </div>
                <div>
                  <p className="text-2xl font-mono font-black">{analytics.recencyStats.last30}</p>
                  <p className="text-xs text-white/70 font-mono uppercase tracking-wider">Decisions (30d)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-2 border-white bg-transparent">
            <CardContent className="pt-4 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 border-2 border-white rounded-lg bg-transparent">
                  <BarChart3 className="h-5 w-5 text-[#FFED00]" />
                </div>
                <div>
                  <p className="text-2xl font-mono font-black">{analytics.recencyStats.last90}</p>
                  <p className="text-xs text-white/70 font-mono uppercase tracking-wider">Decisions (90d)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-2 border-white bg-transparent">
            <CardContent className="pt-4 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 border-2 border-white rounded-lg bg-transparent">
                  <TrendingUp className="h-5 w-5 text-[#FFED00]" />
                </div>
                <div>
                  <p className="text-2xl font-mono font-black">{analytics.recencyStats.momentumPct}%</p>
                  <p className="text-xs text-white/70 font-mono uppercase tracking-wider">30d Momentum</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!hasEnoughData ? (
        <Card className="border-2 border-white bg-transparent">
          <CardContent className="pt-6 text-white">
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-white/50 mx-auto mb-4" />
              <p className="text-lg font-mono font-bold mb-2">Not Enough Data</p>
              <p className="text-sm text-white/70 font-mono">
                You need at least 5 decisions to see analytics. Start logging decisions to unlock insights.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Sector Performance */}
          {analytics.sectorStats.length > 0 && (
            <Card className="border-2 border-white bg-transparent">
              <CardHeader className="border-b-2 border-white">
                <CardTitle className="flex items-center gap-2 text-white font-mono font-black uppercase tracking-tight">
                  <BarChart3 className="h-5 w-5 text-[#FFED00]" />
                  Sector Performance
                </CardTitle>
                <CardDescription className="text-white/70 font-mono">Decision breakdown by sector</CardDescription>
              </CardHeader>
              <CardContent className="text-white">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.sectorStats.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF" opacity={0.2} />
                    <XAxis dataKey="sector" angle={-45} textAnchor="end" height={100} stroke="#FFFFFF" />
                    <YAxis stroke="#FFFFFF" />
                    <RechartsTooltip contentStyle={{ backgroundColor: "#050505", border: "2px solid #FFFFFF", color: "#FFFFFF" }} />
                    <Legend wrapperStyle={{ color: "#FFFFFF" }} />
                    <Bar dataKey="positive" fill="#FFED00" name="Positive" />
                    <Bar dataKey="negative" fill="#FFFFFF" name="Negative" />
                    <Bar dataKey="pending" fill="#FFFFFF" name="Pending" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Stage Performance */}
          {analytics.stageStats.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-2 border-white bg-transparent">
                <CardHeader className="border-b-2 border-white">
                  <CardTitle className="flex items-center gap-2 text-white font-mono font-black uppercase tracking-tight">
                    <PieChart className="h-5 w-5 text-[#FFED00]" />
                    Stage Distribution
                  </CardTitle>
                  <CardDescription className="text-white/70 font-mono">Decisions by funding stage</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsPieChart>
                      <Pie
                        data={analytics.stageStats.map((s) => ({
                          name: s.stage,
                          value: s.total,
                        }))}
                        cx="50%"
                        cy="50%"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {analytics.stageStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ backgroundColor: "#050505", border: "2px solid #FFFFFF", color: "#FFFFFF" }} />
                      <Legend wrapperStyle={{ color: "#FFFFFF" }} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-2 border-white bg-transparent">
                <CardHeader className="border-b-2 border-white">
                  <CardTitle className="flex items-center gap-2 text-white font-mono font-black uppercase tracking-tight">
                    <BarChart3 className="h-5 w-5 text-[#FFED00]" />
                    Stage Conversion Rates
                  </CardTitle>
                  <CardDescription className="text-white/70 font-mono">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">
                            Positive rate by stage
                            <span className="ml-1">ℹ️</span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="bg-[#050505] border-2 border-white text-white">
                          <p className="max-w-xs font-mono">
                            Conversion Rate = (Positive Decisions / Total Decisions) × 100%
                            <br />
                            Shows what % of decisions in each stage resulted in positive outcomes.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-white">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={analytics.stageStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF" opacity={0.2} />
                      <XAxis dataKey="stage" stroke="#FFFFFF" />
                      <YAxis stroke="#FFFFFF" />
                      <RechartsTooltip contentStyle={{ backgroundColor: "#050505", border: "2px solid #FFFFFF", color: "#FFFFFF" }} />
                      <Legend wrapperStyle={{ color: "#FFFFFF" }} />
                      <Bar dataKey="conversionRate" fill="#FFED00" name="Conversion Rate %" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Partner Performance */}
          {analytics.partnerStats.length > 0 && (
            <Card className="border-2 border-white bg-transparent">
              <CardHeader className="border-b-2 border-white">
                <CardTitle className="flex items-center gap-2 text-white font-mono font-black uppercase tracking-tight">
                  <Users className="h-5 w-5 text-[#FFED00]" />
                  Partner Performance
                </CardTitle>
                <CardDescription className="text-white/70 font-mono">Decision metrics by partner</CardDescription>
              </CardHeader>
              <CardContent className="text-white">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.partnerStats.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF" opacity={0.2} />
                    <XAxis dataKey="partner" angle={-45} textAnchor="end" height={100} stroke="#FFFFFF" />
                    <YAxis yAxisId="left" stroke="#FFFFFF" />
                    <YAxis yAxisId="right" orientation="right" stroke="#FFFFFF" />
                    <RechartsTooltip contentStyle={{ backgroundColor: "#050505", border: "2px solid #FFFFFF", color: "#FFFFFF" }} />
                    <Legend wrapperStyle={{ color: "#FFFFFF" }} />
                    <Bar yAxisId="left" dataKey="totalDecisions" fill="#FFED00" name="Total Decisions" />
                    <Bar yAxisId="right" dataKey="winRate" fill="#FFFFFF" name="Win Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Partner Outcome Mix */}
          {partnerOutcomeSeries.length > 0 && (
            <Card className="border-2 border-white bg-transparent">
              <CardHeader className="border-b-2 border-white">
                <CardTitle className="flex items-center gap-2 text-white font-mono font-black uppercase tracking-tight">
                  <BarChart3 className="h-5 w-5 text-[#FFED00]" />
                  Partner Outcome Mix
                </CardTitle>
                <CardDescription className="text-white/70 font-mono">Outcome breakdown by partner (top 10)</CardDescription>
              </CardHeader>
              <CardContent className="text-white">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={partnerOutcomeSeries.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF" opacity={0.2} />
                    <XAxis dataKey="partner" angle={-25} textAnchor="end" height={70} stroke="#FFFFFF" />
                    <YAxis stroke="#FFFFFF" />
                    <RechartsTooltip contentStyle={{ backgroundColor: "#050505", border: "2px solid #FFFFFF", color: "#FFFFFF" }} />
                    <Legend wrapperStyle={{ color: "#FFFFFF" }} />
                    <Bar dataKey="positive" stackId="a" fill="#FFED00" name="Positive" />
                    <Bar dataKey="negative" stackId="a" fill="#FFFFFF" name="Negative" />
                    <Bar dataKey="pending" stackId="a" fill="#FFFFFF" name="Pending" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Decision Velocity by Partner */}
          {partnerOutcomeSeries.length > 0 && (
            <Card className="border-2 border-white bg-transparent">
              <CardHeader className="border-b-2 border-white">
                <CardTitle className="flex items-center gap-2 text-white font-mono font-black uppercase tracking-tight">
                  <Clock className="h-5 w-5 text-[#FFED00]" />
                  Decision Velocity by Partner
                </CardTitle>
                <CardDescription className="text-white/70 font-mono">Average decision cycle length (days)</CardDescription>
              </CardHeader>
              <CardContent className="text-white">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={partnerOutcomeSeries.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF" opacity={0.2} />
                    <XAxis dataKey="partner" angle={-25} textAnchor="end" height={70} stroke="#FFFFFF" />
                    <YAxis stroke="#FFFFFF" />
                    <RechartsTooltip contentStyle={{ backgroundColor: "#050505", border: "2px solid #FFFFFF", color: "#FFFFFF" }} />
                    <Legend wrapperStyle={{ color: "#FFFFFF" }} />
                    <Bar dataKey="avgDecisionVelocity" fill="#FFED00" name="Avg Days" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Outcome & Confidence */}
          {analytics.outcomeStats.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-2 border-white bg-transparent">
                <CardHeader className="border-b-2 border-white">
                  <CardTitle className="flex items-center gap-2 text-white font-mono font-black uppercase tracking-tight">
                    <PieChart className="h-5 w-5 text-[#FFED00]" />
                    Outcome Mix
                  </CardTitle>
                  <CardDescription className="text-white/70 font-mono">Overall outcome distribution</CardDescription>
                </CardHeader>
                <CardContent className="text-white">
                  <ResponsiveContainer width="100%" height={260}>
                    <RechartsPieChart>
                      <Pie
                        data={analytics.outcomeStats.map((o) => ({
                          name: o.outcome,
                          value: o.total,
                        }))}
                        cx="50%"
                        cy="50%"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={90}
                        fill="#FFED00"
                        dataKey="value"
                      >
                        {analytics.outcomeStats.map((entry, index) => (
                          <Cell key={`outcome-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ backgroundColor: "#050505", border: "2px solid #FFFFFF", color: "#FFFFFF" }} />
                      <Legend wrapperStyle={{ color: "#FFFFFF" }} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-2 border-white bg-transparent">
                <CardHeader className="border-b-2 border-white">
                  <CardTitle className="flex items-center gap-2 text-white font-mono font-black uppercase tracking-tight">
                    <BarChart3 className="h-5 w-5 text-[#FFED00]" />
                    Confidence by Outcome
                  </CardTitle>
                  <CardDescription className="text-white/70 font-mono">Average confidence score per outcome</CardDescription>
                </CardHeader>
                <CardContent className="text-white">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={analytics.outcomeStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF" opacity={0.2} />
                      <XAxis dataKey="outcome" stroke="#FFFFFF" />
                      <YAxis stroke="#FFFFFF" />
                      <RechartsTooltip contentStyle={{ backgroundColor: "#050505", border: "2px solid #FFFFFF", color: "#FFFFFF" }} />
                      <Legend wrapperStyle={{ color: "#FFFFFF" }} />
                      <Bar dataKey="avgConfidence" fill="#FFED00" name="Avg Confidence %" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Confidence Distribution */}
          {analytics.confidenceBuckets.length > 0 && (
            <Card className="border-2 border-white bg-transparent">
              <CardHeader className="border-b-2 border-white">
                <CardTitle className="flex items-center gap-2 text-white font-mono font-black uppercase tracking-tight">
                  <BarChart3 className="h-5 w-5 text-[#FFED00]" />
                  Confidence Distribution
                </CardTitle>
                <CardDescription className="text-white/70 font-mono">Decision volume by confidence band</CardDescription>
              </CardHeader>
              <CardContent className="text-white">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analytics.confidenceBuckets}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF" opacity={0.2} />
                    <XAxis dataKey="range" stroke="#FFFFFF" />
                    <YAxis stroke="#FFFFFF" />
                    <RechartsTooltip contentStyle={{ backgroundColor: "#050505", border: "2px solid #FFFFFF", color: "#FFFFFF" }} />
                    <Legend wrapperStyle={{ color: "#FFFFFF" }} />
                    <Bar dataKey="positive" stackId="a" fill="#FFED00" name="Positive" />
                    <Bar dataKey="negative" stackId="a" fill="#FFFFFF" name="Negative" />
                    <Bar dataKey="pending" stackId="a" fill="#FFFFFF" name="Pending" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Decision Age Distribution */}
          {analytics.ageBuckets.length > 0 && (
            <Card className="border-2 border-white bg-transparent">
              <CardHeader className="border-b-2 border-white">
                <CardTitle className="flex items-center gap-2 text-white font-mono font-black uppercase tracking-tight">
                  <BarChart3 className="h-5 w-5 text-[#FFED00]" />
                  Decision Age Distribution
                </CardTitle>
                <CardDescription className="text-white/70 font-mono">Volume and outcome mix by decision age</CardDescription>
              </CardHeader>
              <CardContent className="text-white">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analytics.ageBuckets}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF" opacity={0.2} />
                    <XAxis dataKey="range" stroke="#FFFFFF" />
                    <YAxis stroke="#FFFFFF" />
                    <RechartsTooltip contentStyle={{ backgroundColor: "#050505", border: "2px solid #FFFFFF", color: "#FFFFFF" }} />
                    <Legend wrapperStyle={{ color: "#FFFFFF" }} />
                    <Bar dataKey="positive" stackId="a" fill="#FFED00" name="Positive" />
                    <Bar dataKey="negative" stackId="a" fill="#FFFFFF" name="Negative" />
                    <Bar dataKey="pending" stackId="a" fill="#FFFFFF" name="Pending" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Outcome by Stage */}
          {analytics.outcomeByStage.length > 0 && (
            <Card className="border-2 border-white bg-transparent">
              <CardHeader className="border-b-2 border-white">
                <CardTitle className="flex items-center gap-2 text-white font-mono font-black uppercase tracking-tight">
                  <BarChart3 className="h-5 w-5 text-[#FFED00]" />
                  Outcome by Stage
                </CardTitle>
                <CardDescription className="text-white/70 font-mono">Stage-level outcome mix</CardDescription>
              </CardHeader>
              <CardContent className="text-white">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analytics.outcomeByStage}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF" opacity={0.2} />
                    <XAxis dataKey="stage" angle={-20} textAnchor="end" height={70} stroke="#FFFFFF" />
                    <YAxis stroke="#FFFFFF" />
                    <RechartsTooltip contentStyle={{ backgroundColor: "#050505", border: "2px solid #FFFFFF", color: "#FFFFFF" }} />
                    <Legend wrapperStyle={{ color: "#FFFFFF" }} />
                    <Bar dataKey="positive" stackId="a" fill="#FFED00" name="Positive" />
                    <Bar dataKey="negative" stackId="a" fill="#FFFFFF" name="Negative" />
                    <Bar dataKey="pending" stackId="a" fill="#FFFFFF" name="Pending" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Geo Focus */}
          {analytics.geoStats.length > 0 && (
            <Card className="border-2 border-white bg-transparent">
              <CardHeader className="border-b-2 border-white">
                <CardTitle className="flex items-center gap-2 text-white font-mono font-black uppercase tracking-tight">
                  <BarChart3 className="h-5 w-5 text-[#FFED00]" />
                  Geo Focus
                </CardTitle>
                <CardDescription className="text-white/70 font-mono">Decision volume by geography</CardDescription>
              </CardHeader>
              <CardContent className="text-white">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analytics.geoStats.slice(0, 12)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF" opacity={0.2} />
                    <XAxis dataKey="geo" angle={-25} textAnchor="end" height={70} stroke="#FFFFFF" />
                    <YAxis stroke="#FFFFFF" />
                    <RechartsTooltip contentStyle={{ backgroundColor: "#050505", border: "2px solid #FFFFFF", color: "#FFFFFF" }} />
                    <Legend wrapperStyle={{ color: "#FFFFFF" }} />
                    <Bar dataKey="total" fill="#FFED00" name="Total Decisions" />
                    <Bar dataKey="avgConfidence" fill="#FFFFFF" name="Avg Confidence" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Time Series */}
          {analytics.timeSeries.length > 0 && (
            <Card className="border-2 border-white bg-transparent">
              <CardHeader className="border-b-2 border-white">
                <CardTitle className="flex items-center gap-2 text-white font-mono font-black uppercase tracking-tight">
                  <TrendingUp className="h-5 w-5 text-[#FFED00]" />
                  Decision Trends Over Time
                </CardTitle>
                <CardDescription className="text-white/70 font-mono">Monthly decision volume and outcomes</CardDescription>
              </CardHeader>
              <CardContent className="text-white">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF" opacity={0.2} />
                    <XAxis dataKey="date" stroke="#FFFFFF" />
                    <YAxis stroke="#FFFFFF" />
                    <RechartsTooltip contentStyle={{ backgroundColor: "#050505", border: "2px solid #FFFFFF", color: "#FFFFFF" }} />
                    <Legend wrapperStyle={{ color: "#FFFFFF" }} />
                    <Line type="monotone" dataKey="decisions" stroke="#FFED00" name="Total Decisions" />
                    <Line type="monotone" dataKey="positive" stroke="#FFFFFF" name="Positive" />
                    <Line type="monotone" dataKey="negative" stroke="#FFFFFF" name="Negative" />
                    <Line type="monotone" dataKey="pending" stroke="#FFFFFF" name="Pending" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Action Type Mix */}
          {analytics.actionTypeStats.length > 0 && (
            <Card className="border-2 border-white bg-transparent">
              <CardHeader className="border-b-2 border-white">
                <CardTitle className="flex items-center gap-2 text-white font-mono font-black uppercase tracking-tight">
                  <BarChart3 className="h-5 w-5 text-[#FFED00]" />
                  Action Type Mix
                </CardTitle>
                <CardDescription className="text-white/70 font-mono">Outcomes by decision action</CardDescription>
              </CardHeader>
              <CardContent className="text-white">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.actionTypeStats.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF" opacity={0.2} />
                    <XAxis dataKey="action" angle={-25} textAnchor="end" height={70} stroke="#FFFFFF" />
                    <YAxis stroke="#FFFFFF" />
                    <RechartsTooltip contentStyle={{ backgroundColor: "#050505", border: "2px solid #FFFFFF", color: "#FFFFFF" }} />
                    <Legend wrapperStyle={{ color: "#FFFFFF" }} />
                    <Bar dataKey="positive" stackId="a" fill="#FFED00" name="Positive" />
                    <Bar dataKey="negative" stackId="a" fill="#FFFFFF" name="Negative" />
                    <Bar dataKey="pending" stackId="a" fill="#FFFFFF" name="Pending" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Action Type Conversion Rate */}
          {actionConversionSeries.length > 0 && (
            <Card className="border-2 border-white bg-transparent">
              <CardHeader className="border-b-2 border-white">
                <CardTitle className="flex items-center gap-2 text-white font-mono font-black uppercase tracking-tight">
                  <BarChart3 className="h-5 w-5 text-[#FFED00]" />
                  Action Type Conversion Rate
                </CardTitle>
                <CardDescription className="text-white/70 font-mono">Positive rate by action type</CardDescription>
              </CardHeader>
              <CardContent className="text-white">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={actionConversionSeries.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF" opacity={0.2} />
                    <XAxis dataKey="action" angle={-25} textAnchor="end" height={70} stroke="#FFFFFF" />
                    <YAxis stroke="#FFFFFF" />
                    <RechartsTooltip contentStyle={{ backgroundColor: "#050505", border: "2px solid #FFFFFF", color: "#FFFFFF" }} />
                    <Legend wrapperStyle={{ color: "#FFFFFF" }} />
                    <Bar dataKey="conversionRate" fill="#FFED00" name="Positive Rate %" />
                    <Bar dataKey="total" fill="#FFFFFF" name="Decisions" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Partner Win Rate */}
          {analytics.partnerStats.length > 0 && (
            <Card className="border-2 border-white bg-transparent">
              <CardHeader className="border-b-2 border-white">
                <CardTitle className="flex items-center gap-2 text-white font-mono font-black uppercase tracking-tight">
                  <BarChart3 className="h-5 w-5 text-[#FFED00]" />
                  Partner Win Rate
                </CardTitle>
                <CardDescription className="text-white/70 font-mono">Win rate by partner (top 10 by volume)</CardDescription>
              </CardHeader>
              <CardContent className="text-white">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={analytics.partnerStats.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF" opacity={0.2} />
                    <XAxis dataKey="partner" angle={-25} textAnchor="end" height={70} stroke="#FFFFFF" />
                    <YAxis stroke="#FFFFFF" />
                    <RechartsTooltip contentStyle={{ backgroundColor: "#050505", border: "2px solid #FFFFFF", color: "#FFFFFF" }} />
                    <Legend wrapperStyle={{ color: "#FFFFFF" }} />
                    <Bar dataKey="winRate" fill="#FFED00" name="Win Rate %" />
                    <Bar dataKey="totalDecisions" fill="#FFFFFF" name="Decisions" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Decision Velocity */}
          {analytics.decisionVelocity.length > 0 && (
            <Card className="border-2 border-white bg-transparent">
              <CardHeader className="border-b-2 border-white">
                <CardTitle className="flex items-center gap-2 text-white font-mono font-black uppercase tracking-tight">
                  <Clock className="h-5 w-5 text-[#FFED00]" />
                  Decision Velocity Trend
                </CardTitle>
                <CardDescription className="text-white/70 font-mono">Average decision time over time</CardDescription>
              </CardHeader>
              <CardContent className="text-white">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={analytics.decisionVelocity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF" opacity={0.2} />
                    <XAxis dataKey="date" stroke="#FFFFFF" />
                    <YAxis stroke="#FFFFFF" />
                    <RechartsTooltip contentStyle={{ backgroundColor: "#050505", border: "2px solid #FFFFFF", color: "#FFFFFF" }} />
                    <Legend wrapperStyle={{ color: "#FFFFFF" }} />
                    <Line type="monotone" dataKey="avgDays" stroke="#FFED00" name="Avg Days" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Outcome Rate Trend */}
          {analytics.outcomeRateSeries.length > 0 && (
            <Card className="border-2 border-white bg-transparent">
              <CardHeader className="border-b-2 border-white">
                <CardTitle className="flex items-center gap-2 text-white font-mono font-black uppercase tracking-tight">
                  <TrendingUp className="h-5 w-5 text-[#FFED00]" />
                  Positive Rate Trend
                </CardTitle>
                <CardDescription className="text-white/70 font-mono">Monthly positive rate across decisions</CardDescription>
              </CardHeader>
              <CardContent className="text-white">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={analytics.outcomeRateSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF" opacity={0.2} />
                    <XAxis dataKey="date" stroke="#FFFFFF" />
                    <YAxis stroke="#FFFFFF" />
                    <RechartsTooltip contentStyle={{ backgroundColor: "#050505", border: "2px solid #FFFFFF", color: "#FFFFFF" }} />
                    <Legend wrapperStyle={{ color: "#FFFFFF" }} />
                    <Line type="monotone" dataKey="positiveRate" stroke="#FFED00" name="Positive Rate %" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Cumulative Decisions */}
          {analytics.cumulativeSeries.length > 0 && (
            <Card className="border-2 border-white bg-transparent">
              <CardHeader className="border-b-2 border-white">
                <CardTitle className="flex items-center gap-2 text-white font-mono font-black uppercase tracking-tight">
                  <TrendingUp className="h-5 w-5 text-[#FFED00]" />
                  Cumulative Decisions
                </CardTitle>
                <CardDescription className="text-white/70 font-mono">Total decisions over time</CardDescription>
              </CardHeader>
              <CardContent className="text-white">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={analytics.cumulativeSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF" opacity={0.2} />
                    <XAxis dataKey="date" stroke="#FFFFFF" />
                    <YAxis stroke="#FFFFFF" />
                    <RechartsTooltip contentStyle={{ backgroundColor: "#050505", border: "2px solid #FFFFFF", color: "#FFFFFF" }} />
                    <Legend wrapperStyle={{ color: "#FFFFFF" }} />
                    <Line type="monotone" dataKey="cumulativeDecisions" stroke="#FFED00" name="Cumulative Decisions" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Confidence vs Positive Rate */}
          {confidenceRateSeries.length > 0 && (
            <Card className="border-2 border-white bg-transparent">
              <CardHeader className="border-b-2 border-white">
                <CardTitle className="flex items-center gap-2 text-white font-mono font-black uppercase tracking-tight">
                  <TrendingUp className="h-5 w-5 text-[#FFED00]" />
                  Confidence vs Positive Rate
                </CardTitle>
                <CardDescription className="text-white/70 font-mono">How confidence bands correlate with outcomes</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={confidenceRateSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF" opacity={0.2} />
                    <XAxis dataKey="range" stroke="#FFFFFF" />
                    <YAxis stroke="#FFFFFF" />
                    <RechartsTooltip contentStyle={{ backgroundColor: "#050505", border: "2px solid #FFFFFF", color: "#FFFFFF" }} />
                    <Legend wrapperStyle={{ color: "#FFFFFF" }} />
                    <Line type="monotone" dataKey="positiveRate" stroke="#FFED00" name="Positive Rate %" />
                    <Line type="monotone" dataKey="total" stroke="#FFFFFF" name="Decisions" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Top Startups */}
          {analytics.startupStats.length > 0 && (
            <Card className="border-2 border-white bg-transparent">
              <CardHeader className="border-b-2 border-white">
                <CardTitle className="text-white font-mono font-black uppercase tracking-tight">Top Startups by Decision Volume</CardTitle>
                <CardDescription className="text-white/70 font-mono">Most discussed companies and outcomes</CardDescription>
              </CardHeader>
              <CardContent className="text-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm font-mono">
                    <thead>
                      <tr className="border-b-2 border-white">
                        <th className="text-left p-2 text-white font-bold">Startup</th>
                        <th className="text-right p-2 text-white font-bold">Total</th>
                        <th className="text-right p-2 text-white font-bold">Positive</th>
                        <th className="text-right p-2 text-white font-bold">Negative</th>
                        <th className="text-right p-2 text-white font-bold">Pending</th>
                        <th className="text-right p-2 text-white font-bold">Avg Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.startupStats.slice(0, 10).map((startup) => (
                        <tr key={startup.startupName} className="border-b border-white/30 hover:bg-[#FFED00]/5">
                          <td className="p-2 font-bold text-white">{startup.startupName}</td>
                          <td className="text-right p-2 text-white">{startup.total}</td>
                          <td className="text-right p-2 text-[#FFED00]">{startup.positive}</td>
                          <td className="text-right p-2 text-white/50">{startup.negative}</td>
                          <td className="text-right p-2 text-white/70">{startup.pending}</td>
                          <td className="text-right p-2 text-white">{startup.avgConfidence}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sector Conversion Rates Table */}
          {analytics.sectorStats.length > 0 && (
            <Card className="border-2 border-white bg-transparent">
              <CardHeader className="border-b-2 border-white">
                <CardTitle className="text-white font-mono font-black uppercase tracking-tight">Sector Conversion Rates</CardTitle>
                <CardDescription className="text-white/70 font-mono">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">
                          Detailed sector performance metrics
                          <span className="ml-1">ℹ️</span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="bg-[#050505] border-2 border-white text-white">
                        <p className="max-w-xs font-mono">
                          Conversion Rate = (Positive Decisions / Total Decisions) × 100%
                          <br />
                          Shows what % of decisions in each sector resulted in positive outcomes.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardDescription>
              </CardHeader>
              <CardContent className="text-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm font-mono">
                    <thead>
                      <tr className="border-b-2 border-white">
                        <th className="text-left p-2 text-white font-bold">Sector</th>
                        <th className="text-right p-2 text-white font-bold">Total</th>
                        <th className="text-right p-2 text-white font-bold">Positive</th>
                        <th className="text-right p-2 text-white font-bold">Negative</th>
                        <th className="text-right p-2 text-white font-bold">Pending</th>
                        <th className="text-right p-2 text-white font-bold">Conversion %</th>
                        <th className="text-right p-2 text-white font-bold">Avg Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.sectorStats.map((sector) => (
                        <tr key={sector.sector} className="border-b border-white/30 hover:bg-[#FFED00]/5">
                          <td className="p-2 font-bold text-white">{sector.sector}</td>
                          <td className="text-right p-2 text-white">{sector.total}</td>
                          <td className="text-right p-2 text-[#FFED00]">{sector.positive}</td>
                          <td className="text-right p-2 text-white/50">{sector.negative}</td>
                          <td className="text-right p-2 text-white/70">{sector.pending}</td>
                          <td className="text-right p-2 font-bold text-white">{sector.conversionRate}%</td>
                          <td className="text-right p-2 text-white">{sector.avgConfidence}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// MAIN CIS COMPONENT
// ============================================================================

export default function CIS() {
  const { user, profile, signOut } = useAuth();
  const { toast } = useToast();
  const [scopes, setScopes] = useState<ScopeItem[]>(initialScopes);
  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [activeThread, setActiveThread] = useState<string>(initialThreads[0]?.id ?? "");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [chatIsLoading, setChatIsLoading] = useState(false);
  const [semanticMode, setSemanticMode] = useState(false);
  const [isClaudeLoading, setIsClaudeLoading] = useState(false);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [costLog, setCostLog] = useState<
    Array<{
      ts: string;
      question: string;
      estInputTokens: number;
      estOutputTokens: number;
      estCostUsd: number;
    }>
  >([]);
  const [lastEvidence, setLastEvidence] = useState<{
    question: string;
    docs: Array<{
      id: string;
      title: string | null;
      file_name: string | null;
      raw_content: string | null;
      extracted_json?: Record<string, any> | null;
      created_at: string;
      storage_path: string | null;
    }>;
    decisions: Decision[];
  } | null>(null);
  const [lastEvidenceThreadId, setLastEvidenceThreadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("chat");
  const embeddingsDisabledRef = useRef(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper function to scroll chat container to bottom
  const scrollChatToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, []);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [documents, setDocuments] = useState<Array<{ id: string; title: string | null; storage_path: string | null }>>([]);

  const readLocalChatCache = useCallback((): LocalChatMessage[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(LOCAL_CHAT_CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  const writeLocalChatCache = useCallback((items: LocalChatMessage[]) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LOCAL_CHAT_CACHE_KEY, JSON.stringify(items));
  }, []);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [draftDecision, setDraftDecision] = useState<{
    startupName: string;
    sector?: string;
    stage?: string;
  } | null>(null);
  const [draftDocumentId, setDraftDocumentId] = useState<string | null>(null);
  const [viewingDocument, setViewingDocument] = useState<{
    id: string;
    title: string | null;
    raw_content: string | null;
    extracted_json: Record<string, any> | null;
    file_name: string | null;
    storage_path: string | null;
  } | null>(null);

  const handleOpenDocument = useCallback(
    async (documentId: string) => {
      const { data: doc, error } = await getDocumentById(documentId);
      if (error || !doc) {
        toast({
          title: "Document not found",
          description: "Could not load document details.",
          variant: "destructive",
        });
        return;
      }
      const docData = doc as any;
      setViewingDocument({
        id: docData.id,
        title: docData.title,
        raw_content: docData.raw_content || null,
        extracted_json: docData.extracted_json || null,
        file_name: docData.file_name || null,
        storage_path: docData.storage_path || null,
      });
    },
    [toast]
  );

  const handleLogDecisionFromDocument = useCallback(() => {
    if (!viewingDocument) return;
    setDraftDecision({
      startupName: viewingDocument.title || viewingDocument.file_name || "Decision from document",
    });
    setDraftDocumentId(viewingDocument.id);
    setViewingDocument(null);
    setActiveTab("decisions");
  }, [viewingDocument]);

  const handleCreateSource = useCallback(
    async (
      payload: {
        title: string | null;
        source_type: SourceRecord["source_type"];
        external_url: string | null;
        storage_path?: string | null;
        tags: string[] | null;
        notes: string | null;
        status: SourceRecord["status"];
      },
      eventIdOverride?: string | null
    ) => {
      const eventId = eventIdOverride ?? activeEventId;
      if (!eventId) {
        throw new Error("No active event available.");
      }
      const userId = user?.id || profile?.id || null;
      const { data, error } = await insertSource(eventId, {
        ...payload,
        storage_path: payload.storage_path || null,
        created_by: userId,
      });
      if (error || !data) {
        throw new Error("Supabase rejected the source.");
      }
      setSources((prev) => [data as SourceRecord, ...prev]);
    },
    [activeEventId, profile, user]
  );

  const ensureActiveEventId = useCallback(async () => {
    if (!profile) {
      console.error("ensureActiveEventId: No profile");
      return null;
    }
    const { data: orgData, error: orgError } = await ensureOrganizationForUser(profile);
    if (orgError || !orgData?.organization) {
      console.error("ensureActiveEventId: Organization error:", orgError);
      toast({
        title: "Organization missing",
        description: orgError?.message || "We could not load your organization.",
        variant: "destructive",
      });
      return null;
    }
    const { data: event, error: eventError } = await ensureActiveEventForOrg(orgData.organization.id);
    if (eventError) {
      console.error("ensureActiveEventId: Event creation error:", eventError);
      toast({
        title: "Event creation failed",
        description: eventError.message || "Could not create an active event. Please refresh.",
        variant: "destructive",
      });
      return null;
    }
    if (!event) {
      console.error("ensureActiveEventId: No event returned");
      toast({
        title: "No active event",
        description: "Could not create an active event. Please refresh.",
        variant: "destructive",
      });
      return null;
    }
    setActiveEventId(event.id);
    return event.id;
  }, [profile, toast]);

  const handleDeleteSource = useCallback(async (sourceId: string) => {
    const { error } = await deleteSource(sourceId);
    if (error) {
      return;
    }
    setSources((prev) => prev.filter((source) => source.id !== sourceId));
  }, []);

  // Load chat history on initial mount and when switching threads
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!profile) return;
      const eventId = activeEventId || (await ensureActiveEventId());
      if (!eventId) return;
      
      const mergeLocalMessages = (threadId: string, loadedMessages: Message[]) => {
        const cache = readLocalChatCache();
        if (!cache.length) return loadedMessages;
        const otherThreads = cache.filter((m) => m.threadId !== threadId);
        const threadCache = cache.filter((m) => m.threadId === threadId);
        const existingKeys = new Set(loadedMessages.map((m) => `${m.author}|${m.text}`));
        const merged = [...loadedMessages];
        const remaining: LocalChatMessage[] = [];
        for (const localMsg of threadCache) {
          const key = `${localMsg.author}|${localMsg.text}`;
          if (!existingKeys.has(key)) {
            merged.push({
              id: localMsg.id,
              author: localMsg.author,
              text: localMsg.text,
              threadId: localMsg.threadId,
            });
            remaining.push(localMsg);
          }
        }
        writeLocalChatCache([...otherThreads, ...remaining]);
        return merged;
      };

      try {
        const { data: threadRows } = await supabase
          .from("chat_threads")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true });
        const { data: messageRows } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true });

        if (threadRows?.length) {
          const mappedThreads = threadRows.map((t: any) => ({
            id: t.id,
            title: t.title,
            parentId: t.parent_id || undefined,
          }));
          setThreads(mappedThreads);
          
          // Determine which thread to use: activeThread if set, otherwise first thread
          let targetThreadId = activeThread || mappedThreads[0]?.id;
          
          // On initial load, set activeThread to first thread if not set
          if (isInitialLoad && !activeThread && mappedThreads[0]?.id) {
            targetThreadId = mappedThreads[0].id;
            setActiveThread(targetThreadId);
            setIsInitialLoad(false);
          }
          
          // Load messages for the target thread
          if (targetThreadId && messageRows?.length) {
            const threadMessages = messageRows
              .filter((m: any) => m.thread_id === targetThreadId)
              .map((m: any) => ({
                id: m.id,
                author: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
                text: m.content,
                threadId: m.thread_id,
              }));
            setMessages(mergeLocalMessages(targetThreadId, threadMessages));
          } else if (messageRows?.length && !targetThreadId) {
            // If no thread matches, load all messages (shouldn't happen, but fallback)
            const mappedMessages = messageRows.map((m: any) => ({
              id: m.id,
              author: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
              text: m.content,
              threadId: m.thread_id,
            }));
            setMessages(mappedMessages);
          } else {
            // No messages found for this thread - clear messages array
            if (targetThreadId) {
              setMessages(mergeLocalMessages(targetThreadId, []));
            } else {
              setMessages([]);
            }
          }
        } else if (messageRows?.length) {
          // If no threads but messages exist, load all messages
          const mappedMessages = messageRows.map((m: any) => ({
            id: m.id,
            author: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
            text: m.content,
            threadId: m.thread_id,
          }));
          setMessages(mappedMessages);
        } else {
          // No threads and no messages - ensure empty state
          setMessages([]);
        }
        setChatLoaded(true);
        if (isInitialLoad) {
          setIsInitialLoad(false);
        }
      } catch (error) {
        console.error("Failed to load chat history:", error);
        setChatLoaded(true); // Set to true even on error to prevent retries
        setIsInitialLoad(false);
      }
    };

    void loadChatHistory();
  }, [profile, activeEventId, activeThread, ensureActiveEventId, isInitialLoad, readLocalChatCache, writeLocalChatCache]);

  const getGoogleAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.provider_token || null;
  }, []);

  const handleAutoLogDecision = useCallback(
    async (input: {
      draft: { startupName: string; sector?: string; stage?: string };
      conversion: AIConversionResponse;
      sourceType: "upload" | "paste" | "api";
      fileName: string | null;
      file: File | null;
      rawContent?: string | null;
      eventIdOverride?: string | null;
    }) => {
      const eventId = input.eventIdOverride ?? activeEventId;
      if (!eventId) {
        return;
      }
      let storagePath: string | null = null;
      if (input.file) {
        const safeName = input.fileName?.replace(/[^a-zA-Z0-9._-]/g, "_") || "document";
        const path = `${eventId}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("cis-documents")
          .upload(path, input.file, { upsert: true });
        if (!uploadError) {
          storagePath = path;
        }
      }

      const userId = profile?.id || user?.id || null;
      const { data: doc, error: docError } = await insertDocument(eventId, {
        title: input.draft.startupName,
        source_type: input.sourceType,
        file_name: input.fileName,
        storage_path: storagePath,
        detected_type: input.conversion.detectedType || "unknown",
        extracted_json: input.conversion as unknown as Record<string, any>,
        raw_content: input.rawContent || null,
        created_by: userId,
      });

      const docRecord = doc as { id?: string; title?: string | null; storage_path?: string | null } | null;
      const docId = docRecord?.id;
      if (docError) {
        console.error("Document insert error in auto-log:", docError);
        toast({
          title: "Document save failed",
          description: docError.message || "Could not save document.",
          variant: "destructive",
        });
        return;
      }
      if (!docId) {
        console.error("Document insert returned no ID:", doc);
        toast({
          title: "Document save failed",
          description: "Insert succeeded but no document ID returned.",
          variant: "destructive",
        });
        return;
      }

      await indexDocumentEmbeddings(docId, input.rawContent || null);
      setDocuments((prev) => [
        { id: docId, title: docRecord?.title || null, storage_path: docRecord?.storage_path || null },
        ...prev,
      ]);

      const { data: decision, error } = await insertDecision(eventId, {
        actor_id: userId,
        actor_name: profile?.full_name || profile?.email || user?.email || "Unknown",
        action_type: "meeting",
        startup_name: input.draft.startupName,
        context: {
          sector: input.draft.sector || undefined,
          stage: input.draft.stage || undefined,
        },
        confidence_score: 70,
        outcome: "pending",
        notes: null,
        document_id: docId,
      });

      if (error || !decision) {
        return;
      }
      setDecisions((prev) => [mapDecisionRow(decision), ...prev]);
      if (storagePath) {
        setDocuments((prev) => [{ id: docId, title: input.draft.startupName, storage_path: storagePath }, ...prev]);
      }
    },
    [activeEventId, profile, user]
  );

  const scopedMessages = useMemo(() => messages.filter((m) => m.threadId === activeThread), [messages, activeThread]);

  useEffect(() => {
    let cancelled = false;
    let documentsChannel: ReturnType<typeof supabase.channel> | null = null;
    let decisionsChannel: ReturnType<typeof supabase.channel> | null = null;
    let sourcesChannel: ReturnType<typeof supabase.channel> | null = null;

    const loadDecisions = async () => {
      if (!profile) return;
      // Sync decisions from Supabase

      const { data: orgData, error: orgError } = await ensureOrganizationForUser(profile);
      if (orgError || !orgData?.organization) {
        console.error("Failed to ensure organization:", orgError);
        toast({
          title: "Organization error",
          description: orgError?.message || "Could not load your organization. Please refresh.",
          variant: "destructive",
        });
        return;
      }

      const { data: event, error: eventError } = await ensureActiveEventForOrg(orgData.organization.id);
      if (eventError) {
        console.error("Failed to ensure active event:", eventError);
        toast({
          title: "Event creation failed",
          description: eventError.message || "Could not create an active event. Please refresh or contact support.",
          variant: "destructive",
        });
        return;
      }
      if (!event) {
        console.error("No event returned from ensureActiveEventForOrg");
        toast({
          title: "No active event",
          description: "Could not create an active event. Please refresh.",
          variant: "destructive",
        });
        return;
      }

      if (cancelled) return;
      setActiveEventId(event.id);

      const [decisionsRes, documentsRes, sourcesRes] = await Promise.all([
        getDecisionsByEvent(event.id),
        getDocumentsByEvent(event.id),
        getSourcesByEvent(event.id),
      ]);
      if (cancelled) return;
      const mapped = (decisionsRes.data || []).map(mapDecisionRow);
      setDecisions(mapped);
      setDocuments(
        (documentsRes.data || []).map((doc: any) => ({
          id: doc.id,
          title: doc.title,
          storage_path: doc.storage_path || null,
        }))
      );
      const normalizedSources = (sourcesRes.data || []).map((source: any) => {
        const tags = Array.isArray(source.tags)
          ? source.tags
          : typeof source.tags === "string"
          ? source.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
          : null;
        return { ...source, tags };
      });
      setSources(normalizedSources as SourceRecord[]);

      // Set up real-time subscriptions for documents
      documentsChannel = supabase
        .channel(`documents:${event.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "documents",
            filter: `event_id=eq.${event.id}`,
          },
          (payload) => {
            if (cancelled) return;
            console.log("Document change:", payload.eventType, payload.new || payload.old);
            
            if (payload.eventType === "INSERT" && payload.new) {
              const newDoc = payload.new as any;
              // Clean up title if it looks like a storage path
              const cleanTitle = (title: string | null): string | null => {
                if (!title) return null;
                // Remove file extension and random IDs
                const cleaned = title.replace(/\.[^/.]+$/, "").replace(/-\w{8,}$/, "").trim();
                if (!cleaned || cleaned.toLowerCase() === "document") {
                  return "Uploaded document";
                }
                return cleaned;
              };
              setDocuments((prev) => {
                // Check if already exists to avoid duplicates
                if (prev.some((d) => d.id === newDoc.id)) return prev;
                return [
                  {
                    id: newDoc.id,
                    title: cleanTitle(newDoc.title) || newDoc.title || "Untitled document",
                    storage_path: newDoc.storage_path || null,
                  },
                  ...prev,
                ];
              });
              toast({
                title: "New document added",
                description: `${cleanTitle(newDoc.title) || newDoc.title || "Untitled"} was added by a team member.`,
              });
            } else if (payload.eventType === "UPDATE" && payload.new) {
              const updatedDoc = payload.new as any;
              setDocuments((prev) =>
                prev.map((d) =>
                  d.id === updatedDoc.id
                    ? {
                        id: updatedDoc.id,
                        title: updatedDoc.title,
                        storage_path: updatedDoc.storage_path || null,
                      }
                    : d
                )
              );
            } else if (payload.eventType === "DELETE" && payload.old) {
              const deletedDoc = payload.old as any;
              setDocuments((prev) => prev.filter((d) => d.id !== deletedDoc.id));
              toast({
                title: "Document removed",
                description: "A document was deleted by a team member.",
              });
            }
          }
        )
        .subscribe();

      // Set up real-time subscriptions for decisions
      decisionsChannel = supabase
        .channel(`decisions:${event.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "decisions",
            filter: `event_id=eq.${event.id}`,
          },
          (payload) => {
            if (cancelled) return;
            console.log("Decision change:", payload.eventType, payload.new || payload.old);
            
            if (payload.eventType === "INSERT" && payload.new) {
              const newDecision = payload.new as any;
              setDecisions((prev) => {
                // Check if already exists to avoid duplicates
                if (prev.some((d) => d.id === newDecision.id)) return prev;
                return [mapDecisionRow(newDecision), ...prev];
              });
              toast({
                title: "New decision logged",
                description: `${newDecision.startup_name || "Unknown"} decision was logged by a team member.`,
              });
            } else if (payload.eventType === "UPDATE" && payload.new) {
              const updatedDecision = payload.new as any;
              setDecisions((prev) =>
                prev.map((d) => (d.id === updatedDecision.id ? mapDecisionRow(updatedDecision) : d))
              );
            } else if (payload.eventType === "DELETE" && payload.old) {
              const deletedDecision = payload.old as any;
              setDecisions((prev) => prev.filter((d) => d.id !== deletedDecision.id));
              toast({
                title: "Decision removed",
                description: "A decision was deleted by a team member.",
              });
            }
          }
        )
        .subscribe();

      // Set up real-time subscription for sources
      sourcesChannel = supabase
        .channel(`sources:${event.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "sources",
            filter: `event_id=eq.${event.id}`,
          },
          (payload) => {
            if (cancelled) return;
            console.log("Source change:", payload.eventType, payload.new || payload.old);
            
            if (payload.eventType === "INSERT" && payload.new) {
              const newSource = payload.new as any;
              const tags = Array.isArray(newSource.tags)
                ? newSource.tags
                : typeof newSource.tags === "string"
                ? newSource.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
                : null;
              setSources((prev) => {
                if (prev.some((s) => s.id === newSource.id)) return prev;
                return [{ ...newSource, tags } as SourceRecord, ...prev];
              });
              toast({
                title: "New source added",
                description: `${newSource.title || "Untitled"} was added by a team member.`,
              });
            } else if (payload.eventType === "UPDATE" && payload.new) {
              const updatedSource = payload.new as any;
              const tags = Array.isArray(updatedSource.tags)
                ? updatedSource.tags
                : typeof updatedSource.tags === "string"
                ? updatedSource.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
                : null;
              setSources((prev) =>
                prev.map((s) => (s.id === updatedSource.id ? { ...updatedSource, tags } as SourceRecord : s))
              );
            } else if (payload.eventType === "DELETE" && payload.old) {
              const deletedSource = payload.old as any;
              setSources((prev) => prev.filter((s) => s.id !== deletedSource.id));
              toast({
                title: "Source removed",
                description: "A source was deleted by a team member.",
              });
            }
          }
        )
        .subscribe();
    };

    loadDecisions();
    return () => {
      cancelled = true;
      if (documentsChannel) {
        supabase.removeChannel(documentsChannel);
      }
      if (decisionsChannel) {
        supabase.removeChannel(decisionsChannel);
      }
      if (sourcesChannel) {
        supabase.removeChannel(sourcesChannel);
      }
    };
  }, [profile, toast]);

  const buildSnippet = useCallback((text: string | null) => {
    if (!text) return "No preview available.";
    const normalized = text.replace(/\s+/g, " ").trim();
    return normalized.length > 240 ? `${normalized.slice(0, 240)}…` : normalized;
  }, []);

  const formatTabularContent = useCallback((text: string) => {
    const rawLines = text.split(/\n/).map((line) => line.replace(/\r/g, ""));
    const nonEmpty = rawLines.filter((line) => line.trim().length > 0);
    if (nonEmpty.length < 3) return text;

    const detectSeparator = (line: string) => {
      const commaCount = (line.match(/,/g) || []).length;
      const semicolonCount = (line.match(/;/g) || []).length;
      const tabCount = (line.match(/\t/g) || []).length;
      if (tabCount > commaCount && tabCount > semicolonCount) return "\t";
      if (semicolonCount > commaCount) return ";";
      return ",";
    };

    const parseCsvLine = (line: string, separator: string) => {
      const cells: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i += 1;
          } else {
            inQuotes = !inQuotes;
          }
          continue;
        }
        if (char === separator && !inQuotes) {
          cells.push(current.trim());
          current = "";
          continue;
        }
        current += char;
      }
      cells.push(current.trim());
      return cells;
    };

    const separator = detectSeparator(nonEmpty[0]);
    const parsed = nonEmpty.map((line) => parseCsvLine(line, separator));
    const counts = parsed.map((row) => row.length).filter((count) => count > 1);
    if (counts.length < 3) return text;

    const frequency = new Map<number, number>();
    counts.forEach((count) => frequency.set(count, (frequency.get(count) || 0) + 1));
    const [targetCols, targetCount] = [...frequency.entries()].sort((a, b) => b[1] - a[1])[0];
    if (targetCols < 2 || targetCount < 3) return text;

    const tableRows = parsed.filter((row) => row.length === targetCols);
    if (tableRows.length < 3) return text;

    const maxRows = 25;
    const rows = tableRows.slice(0, maxRows);
    const headerRow = rows[0].map((cell, index) => cell || `Column ${index + 1}`);
    const renderRow = (cells: string[]) => `| ${cells.map((cell) => cell || " ").join(" | ")} |`;
    const tableLines = [
      "TABLE (formatted):",
      renderRow(headerRow),
      `| ${headerRow.map(() => "---").join(" | ")} |`,
      ...rows.slice(1).map(renderRow),
    ];
    if (tableRows.length > maxRows) {
      tableLines.push("…(table truncated)");
    }
    return tableLines.join("\n");
  }, []);

  const buildNormalizedDocText = useCallback(
    (doc: { raw_content: string | null; extracted_json?: Record<string, any> | null }) => {
      const raw = doc.raw_content?.trim() ? formatTabularContent(doc.raw_content) : "";
      const json = doc.extracted_json ? JSON.stringify(doc.extracted_json) : "";
      return [raw, json].filter(Boolean).join("\n").replace(/\r/g, "").trim();
    },
    [formatTabularContent]
  );

  const buildDocSnippet = useCallback(
    (doc: { raw_content: string | null; extracted_json?: Record<string, any> | null }) => {
      const combined = buildNormalizedDocText(doc);
      if (!combined) return "No preview available.";
      return buildSnippet(combined);
    },
    [buildSnippet, buildNormalizedDocText]
  );

  const buildRelevantSnippet = useCallback(
    (doc: { raw_content: string | null; extracted_json?: Record<string, any> | null }, tokens: string[]) => {
      const combined = buildNormalizedDocText(doc).replace(/\s+/g, " ").trim();
      if (!combined) return "No preview available.";
      const haystack = combined.toLowerCase();
      const match = tokens.find((t) => haystack.includes(t));
      if (!match) return buildDocSnippet(doc);
      const idx = haystack.indexOf(match);
      const start = Math.max(0, idx - 140);
      const end = Math.min(combined.length, idx + match.length + 160);
      const snippet = combined.slice(start, end).trim();
      return snippet.length > 0 ? `${start > 0 ? "…" : ""}${snippet}${end < combined.length ? "…" : ""}` : buildDocSnippet(doc);
    },
    [buildDocSnippet, buildNormalizedDocText]
  );

  const buildClaudeContext = useCallback(
    (
      doc: { raw_content: string | null; extracted_json?: Record<string, any> | null },
      tokens: string[],
      isComprehensive: boolean = false
    ) => {
      const combined = buildNormalizedDocText(doc);
      if (!combined) return "No preview available.";

      const lowerTokens = tokens.map((t) => t.toLowerCase());
      const lines = combined.split("\n").map((line) => line.trim()).filter(Boolean);
      const startIdx = lines.findIndex((line) =>
        lowerTokens.some((t) => line.toLowerCase().includes(t))
      );

      if (startIdx >= 0) {
        const slice = lines.slice(startIdx, startIdx + (isComprehensive ? 80 : 40));
        const joined = slice.join("\n");
        const limit = isComprehensive ? 2500 : 1000;
        return joined.length > limit ? `${joined.slice(0, limit)}…` : joined;
      }

      // Fallback: return the first chunk of the document
      const limit = isComprehensive ? 2500 : 1000;
      return combined.length > limit ? `${combined.slice(0, limit)}…` : combined;
    },
    [buildNormalizedDocText]
  );

  const formatDecisionMatches = useCallback((matchedDecisions: Decision[]) => {
    return (
      "Here are the matching decisions:\n" +
      matchedDecisions
        .map(
          (d, index) =>
            `${index + 1}. ${d.startupName} — ${d.actionType}${d.outcome ? ` (${d.outcome})` : ""}${
              d.notes ? ` — ${d.notes}` : ""
            }`
        )
        .join("\n")
    );
  }, []);

  const docContainsTokens = useCallback(
    (
      doc: {
        raw_content: string | null;
        extracted_json?: Record<string, any> | null;
        title?: string | null;
        file_name?: string | null;
      },
      tokens: string[]
    ) => {
      if (!tokens.length) return false; // No tokens = no match
      const haystack = [
        doc.raw_content || "",
        doc.extracted_json ? JSON.stringify(doc.extracted_json) : "",
        doc.title || "",
        doc.file_name || "",
      ]
        .join(" ")
        .toLowerCase();
      // Require at least 60% of tokens to match.
      // For short queries (1-2 tokens), allow a single match.
      const minMatches = tokens.length <= 2 ? 1 : Math.max(2, Math.ceil(tokens.length * 0.6));
      const matches = tokens.filter((t) => haystack.includes(t)).length;
      return matches >= minMatches;
    },
    []
  );

  // Removed buildStructuredAnswer - it was causing irrelevant "Responsibilities" sections
  // We now trust Claude's answers completely. If Claude says no info, we respect that.

  const isDeveloper =
    (import.meta.env.VITE_DEV_MODE as string | undefined) === "true" ||
    (profile?.email && (import.meta.env.VITE_DEV_EMAIL as string | undefined) === profile.email);

  const persistCostLog = useCallback((entry: typeof costLog[number]) => {
    const updated = [entry, ...costLog].slice(0, 100);
    setCostLog(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("ventureos_cost_log", JSON.stringify(updated));
    }
  }, [costLog]);

  const createChatThread = useCallback(
    async (title: string, parentId?: string | null) => {
      const eventId = activeEventId || (await ensureActiveEventId());
      if (!eventId) return null;
      const userId = profile?.id || user?.id || null;
      const { data, error } = await supabase
        .from("chat_threads")
        .insert({
          event_id: eventId,
          title,
          parent_id: parentId || null,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error || !data?.id) {
        console.error("Failed to create chat thread:", error);
        return null;
      }
      return data.id as string;
    },
    [activeEventId, ensureActiveEventId, profile, user]
  );

  const persistChatMessage = useCallback(
    async (payload: {
      threadId: string;
      role: "user" | "assistant";
      content: string;
      model?: string | null;
      sourceDocIds?: string[] | null;
    }) => {
      try {
        const eventId = activeEventId || (await ensureActiveEventId());
        if (!eventId) return;
        const userId = profile?.id || user?.id || null;
        
        // Ensure thread exists (create if it doesn't)
        let threadId = payload.threadId;
        if (!threadId) {
          const newThreadId = await createChatThread("Chat", null);
          if (newThreadId) {
            threadId = newThreadId;
          } else {
            // Fallback: use a temporary ID (won't persist but won't crash)
            threadId = `t-${Date.now()}`;
          }
        }
        
        // Retry logic for network failures
        let lastError: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const { error } = await supabase.from("chat_messages").insert({
              event_id: eventId,
              thread_id: threadId,
              role: payload.role,
              content: payload.content,
              model: payload.model || null,
              source_doc_ids: payload.sourceDocIds || null,
              created_by: userId,
            });
            if (!error) {
              return; // Success
            }
            lastError = error;
            // Don't retry on RLS/auth errors
            if (error.code === '42501' || error.code === 'PGRST116') {
              break;
            }
          } catch (err) {
            lastError = err;
            // Retry on network errors
            if (attempt < 2 && (err instanceof TypeError || err instanceof Error)) {
              await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
              continue;
            }
            break;
          }
        }
        
        if (lastError) {
          console.error("Failed to save chat message after retries:", lastError);
          const cached = readLocalChatCache();
          const localMessage: LocalChatMessage = {
            id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            threadId,
            author: payload.role,
            text: payload.content,
            ts: new Date().toISOString(),
          };
          writeLocalChatCache([localMessage, ...cached].slice(0, 200));
        }
      } catch (err) {
        console.error("Failed to save chat message:", err);
        // Silently fail - don't block chat functionality
      }
    },
    [activeEventId, ensureActiveEventId, profile, user, createChatThread, readLocalChatCache, writeLocalChatCache]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    embeddingsDisabledRef.current = localStorage.getItem("disable_embeddings") === "true";
    const existing = localStorage.getItem("ventureos_cost_log");
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        if (Array.isArray(parsed)) {
          setCostLog(parsed);
        }
      } catch {
        // ignore invalid JSON
      }
    }
  }, []);

  const estimateClaudeCost = useCallback((question: string) => {
    const ASK_MAX_TOKENS = 700;
    const inputChars = question.length + (lastEvidence?.docs?.length || 0) * 500;
    const estInputTokens = Math.max(1, Math.ceil(inputChars / 4));
    const estOutputTokens = ASK_MAX_TOKENS;
    const inputCost = (estInputTokens / 1_000_000) * 3.0;
    const outputCost = (estOutputTokens / 1_000_000) * 15.0;
    const estCostUsd = Number((inputCost + outputCost).toFixed(5));
    return { estInputTokens, estOutputTokens, estCostUsd };
  }, [lastEvidence]);

  const chunkText = useCallback((text: string) => {
    const CHUNK_SIZE = 800;
    const CHUNK_OVERLAP = 120;
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(text.length, start + CHUNK_SIZE);
      const chunk = text.slice(start, end).trim();
      if (chunk) {
        chunks.push(chunk);
      }
      if (end === text.length) break;
      start = Math.max(0, end - CHUNK_OVERLAP);
    }
    return chunks;
  }, []);

  const disableEmbeddings = useCallback((reason?: string) => {
    embeddingsDisabledRef.current = true;
    if (typeof window !== "undefined") {
      localStorage.setItem("disable_embeddings", "true");
    }
    if (reason) {
      console.warn("Embeddings disabled:", reason);
    }
  }, []);

  const indexDocumentEmbeddings = useCallback(
    async (documentId: string, rawContent?: string | null) => {
      if (embeddingsDisabledRef.current) return;
      if (!rawContent?.trim()) return;
      (async () => {
        try {
          const { data: existing } = await supabase
            .from("document_embeddings")
            .select("id")
            .eq("document_id", documentId)
            .limit(1);
          if (existing && existing.length > 0) return;

          const MAX_EMBED_CHARS = 4000;
          const MAX_EMBED_CHUNKS = 4;
          const truncated = rawContent.slice(0, MAX_EMBED_CHARS);
          const chunks = chunkText(truncated).slice(0, MAX_EMBED_CHUNKS);

          for (const chunk of chunks) {
            try {
              const embedding = await embedQuery(chunk, "document");
              if (!embedding.length) continue;
              const { error } = await supabase.from("document_embeddings").insert({
                document_id: documentId,
                chunk_text: chunk,
                embedding,
              });
              if (error) {
                disableEmbeddings(error.message || "Embedding insert failed");
                return;
              }
            } catch (chunkErr) {
              disableEmbeddings(chunkErr instanceof Error ? chunkErr.message : "Embedding error");
              return;
            }
          }
        } catch (err) {
          disableEmbeddings(err instanceof Error ? err.message : "Embedding setup failed");
        }
      })();
    },
    [chunkText, disableEmbeddings]
  );

  const createAssistantMessage = useCallback(
    (text: string, threadId: string, sourceDocIds?: string[] | null) => {
      const id = `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setMessages((prev) => [...prev, { id, author: "assistant", text, threadId }]);
      void persistChatMessage({
        threadId,
        role: "assistant",
        content: text,
        model: "claude",
        sourceDocIds: sourceDocIds || null,
      });
      // Auto-scroll to bottom after message is added
      setTimeout(() => {
        scrollChatToBottom();
      }, 100);
    },
    [persistChatMessage, scrollChatToBottom]
  );

  const createStreamingAssistantMessage = useCallback(
    (threadId: string, sourceDocIds?: string[] | null) => {
      const id = `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      let currentText = "";
      let messageIndex = -1;
      
      // Create placeholder message with thinking indicator (dots)
      setMessages((prev) => {
        const newMessages = [...prev, { id, author: "assistant" as const, text: "...", threadId, isStreaming: true }];
        messageIndex = newMessages.length - 1;
        return newMessages;
      });

      // Auto-scroll when thinking
      setTimeout(() => {
        scrollChatToBottom();
      }, 100);

      return {
        appendChunk: (chunk: string) => {
          currentText += chunk;
          setMessages((prev) => {
            const updated = [...prev];
            if (messageIndex >= 0 && messageIndex < updated.length) {
              updated[messageIndex] = { ...updated[messageIndex], text: currentText, isStreaming: true };
            }
            return updated;
          });
          // Auto-scroll as text streams
          setTimeout(() => {
            scrollChatToBottom();
          }, 50);
        },
        finalize: () => {
          setMessages((prev) => {
            const updated = [...prev];
            if (messageIndex >= 0 && messageIndex < updated.length) {
              updated[messageIndex] = { ...updated[messageIndex], text: currentText, isStreaming: false };
            }
            return updated;
          });
          void persistChatMessage({
            threadId,
            role: "assistant",
            content: currentText,
            model: "claude",
            sourceDocIds: sourceDocIds || null,
          });
        },
        setError: (error: string) => {
          setMessages((prev) => {
            const updated = [...prev];
            if (messageIndex >= 0 && messageIndex < updated.length) {
              updated[messageIndex] = { ...updated[messageIndex], text: error, isStreaming: false };
            }
            return updated;
          });
          void persistChatMessage({
            threadId,
            role: "assistant",
            content: error,
            model: "claude",
            sourceDocIds: sourceDocIds || null,
          });
        },
      };
    },
    [persistChatMessage, scrollChatToBottom]
  );

  // Scroll to bottom when chat tab is first opened
  useEffect(() => {
    if (activeTab === "chat" && chatContainerRef.current) {
      // Scroll to bottom immediately when chat tab opens
      const container = chatContainerRef.current;
      // Use setTimeout to ensure DOM is fully rendered
      setTimeout(() => {
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 50);
    }
  }, [activeTab]);

  // Auto-scroll when new messages arrive - only if near bottom
  useEffect(() => {
    if (chatContainerRef.current && scopedMessages.length > 0) {
      const container = chatContainerRef.current;
      // Only auto-scroll if we're near the bottom (within 150px)
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      
      if (isNearBottom) {
        // Use requestAnimationFrame for smooth scrolling
        requestAnimationFrame(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
          }
        });
      }
    }
  }, [scopedMessages]);

  const askFund = useCallback(
    async (question: string, threadId: string) => {
      if (!scopes.some((s) => s.checked)) {
        createAssistantMessage("Select at least one scope to search fund memory.", threadId);
        return;
      }

      const eventId = activeEventId || (await ensureActiveEventId());
      if (!eventId) {
        createAssistantMessage("I can’t access documents yet. Please try again in a moment.", threadId);
        return;
      }

      const previousEvidence = lastEvidence;
      const previousEvidenceThreadId = lastEvidenceThreadId;
      setChatIsLoading(true);
      // Reset evidence for new prompt to avoid showing previous sources
      setLastEvidence(null);
      let timedOut = false;
      let searchTimeoutId: number | null = null;
      // Increased timeout to 90 seconds (20s for search + 70s for Claude)
      const searchTimeoutId_temp = window.setTimeout(() => {
        timedOut = true;
        setChatIsLoading(false);
        createAssistantMessage(
          "Search is taking too long. Please try a more specific query or disable semantic search.",
          threadId
        );
      }, 20000);
      searchTimeoutId = searchTimeoutId_temp;
      const myDocsSelected = scopes.find((s) => s.id === "my-docs")?.checked ?? false;
      const teamDocsSelected = scopes.find((s) => s.id === "team-docs")?.checked ?? false;
      const currentUserId = profile?.id || user?.id || null;
      const normalizedQuestion = question.toLowerCase();
      // Unicode-aware tokenization (supports non-English)
      const tokens = normalizedQuestion
        .split(/[\s\p{P}]+/u)
        .map((t) => t.trim())
        .filter((t) => t.length > 2);
      const contentStopwords = new Set([
        "what",
        "about",
        "know",
        "tell",
        "me",
        "the",
        "and",
        "for",
        "with",
        "his",
        "her",
        "their",
        "there",
        "this",
        "that",
        "these",
        "those",
        "who",
        "when",
        "where",
        "why",
        "how",
        "company",
        "startup",
        "business",
      ]);
      const contentTokens = tokens.filter((t) => !contentStopwords.has(t));
      const isComprehensiveQuestion =
        /\b(all you know|everything|comprehensive|detailed|full|complete|tell me all|what do you know|what can you tell me|summarize|overview)\b/i.test(
          question
        );
      const isFollowUpQuery = (() => {
        const q = normalizedQuestion;
        const hasPronoun = /\b(it|its|they|them|their|he|his|she|her|there|that|those|these)\b/i.test(q);
        const hasFollowUpCue = /\b(what about|and what|requirements|responsibilities|limitations|cannot|can't|couldn't|allowed|forbidden)\b/i.test(q);
        const isShort = q.split(/\s+/).length <= 12;
        return (hasPronoun || hasFollowUpCue) && isShort;
      })();
      let docs: Array<{
        id: string;
        title: string | null;
        file_name: string | null;
        raw_content: string | null;
        extracted_json?: Record<string, any> | null;
        created_at: string;
        storage_path: string | null;
      }> = [];
      let error: { message?: string } | null = null;
      let semanticFailed = false;

      const canSemantic = semanticMode && tokens.length >= 2;

      if (canSemantic) {
        try {
          // Add timeout to embedding query (15s max)
          let embedding: number[] | null = null;
          try {
            const embeddingPromise = embedQuery(question, "query");
            const embeddingTimeout = new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error("Embedding timeout")), 15000)
            );
            embedding = await Promise.race([embeddingPromise, embeddingTimeout]);
          } catch (embedErr) {
            // Embedding timeout or error - skip semantic search, use full-text instead
            semanticFailed = true;
            embedding = null;
          }
          if (timedOut) return;
          if (embedding && embedding.length > 0) {
            const { data: matches, error: matchError } = await supabase.rpc("match_documents", {
              query_embedding: embedding,
              match_count: 6,
              filter_event_id: eventId,
            });
            if (timedOut) return;
            if (!matchError && matches?.length) {
              const ids = matches.map((m: any) => m.document_id);
              let docQuery = supabase
                .from("documents")
                .select("id,title,file_name,raw_content,extracted_json,created_at,storage_path,created_by")
                .in("id", ids);
              if (myDocsSelected && !teamDocsSelected && currentUserId) {
                docQuery = docQuery.eq("created_by", currentUserId);
              } else if (!myDocsSelected && teamDocsSelected && currentUserId) {
                docQuery = docQuery.neq("created_by", currentUserId);
              }
              const { data: docRows, error: docError } = await docQuery;
              if (timedOut) return;
              if (docError) {
                error = docError as { message?: string };
              } else if (docRows?.length) {
                const docMap = new Map(docRows.map((d: any) => [d.id, d]));
                docs = ids.map((id: string) => docMap.get(id)).filter(Boolean);
              }
            }
          }
        } catch (err) {
          // Semantic search failed - silently fall back to full-text search
          semanticFailed = true;
          // Don't log error - embeddings are optional, full-text search works fine
        }
      }

      if (!docs.length && !error) {
        // More aggressive search: try multiple search strategies
        // First, try full-text search with the question
        let responseQuery = supabase
          .from("documents")
          .select("id,title,file_name,raw_content,extracted_json,created_at,storage_path,created_by")
          .eq("event_id", eventId)
          .textSearch("raw_content", question.replace(/[^\w\s-]/g, ' ').trim(), { type: "websearch", config: "english" })
          .order("created_at", { ascending: false })
          .limit(6);
        
        // Apply scope filters
        if (myDocsSelected && !teamDocsSelected && currentUserId) {
          responseQuery = responseQuery.eq("created_by", currentUserId);
        } else if (!myDocsSelected && teamDocsSelected && currentUserId) {
          responseQuery = responseQuery.neq("created_by", currentUserId);
        }
        
        let response;
        try {
          response = await responseQuery;
        } catch (queryErr) {
          console.warn("Document query failed:", queryErr);
          response = { data: [], error: queryErr };
        }
        if (timedOut) return;
        docs = (response.data || []) as typeof docs;
        
        // If still no results, try keyword search with individual terms
        if (!docs.length && !response.error) {
          const keywords = question
            .toLowerCase()
            .split(/\W+/)
            .filter((w) => w.length > 3)
            .slice(0, 3); // Use top 3 keywords
          
          if (keywords.length > 0) {
            try {
              let keywordQuery = supabase
                .from("documents")
                .select("id,title,file_name,raw_content,extracted_json,created_at,storage_path,created_by")
                .eq("event_id", eventId);
              
              // Build OR conditions safely
              const orConditions = keywords.map((k) => `raw_content.ilike.%${k}%`).join(",");
              if (orConditions) {
                keywordQuery = keywordQuery.or(orConditions);
              }
              
              keywordQuery = keywordQuery.order("created_at", { ascending: false }).limit(6);
              
              if (myDocsSelected && !teamDocsSelected && currentUserId) {
                keywordQuery = keywordQuery.eq("created_by", currentUserId);
              } else if (!myDocsSelected && teamDocsSelected && currentUserId) {
                keywordQuery = keywordQuery.neq("created_by", currentUserId);
              }
              
              const keywordResponse = await keywordQuery;
              if (timedOut) return;
              if (keywordResponse.data?.length) {
                docs = (keywordResponse.data || []) as typeof docs;
              }
            } catch (keywordErr) {
              console.warn("Keyword search failed:", keywordErr);
              // Continue without keyword results
            }
          }
        }
        
        if (response.error) {
          error = response.error as { message?: string };
        }

        // Final fallback: client-side scan of recent docs using raw + extracted JSON
        if (!docs.length && !error && contentTokens.length > 0) {
          let recentQuery = supabase
            .from("documents")
            .select("id,title,file_name,raw_content,extracted_json,created_at,storage_path,created_by")
            .eq("event_id", eventId)
            .order("created_at", { ascending: false })
            .limit(50);
          if (myDocsSelected && !teamDocsSelected && currentUserId) {
            recentQuery = recentQuery.eq("created_by", currentUserId);
          } else if (!myDocsSelected && teamDocsSelected && currentUserId) {
            recentQuery = recentQuery.neq("created_by", currentUserId);
          }
          const recentResponse = await recentQuery;
          if (timedOut) return;
          if (!recentResponse.error && recentResponse.data?.length) {
            const filtered = (recentResponse.data as typeof docs).filter((doc) => {
              if (!contentTokens.length) return false;
              const haystack = [
                doc.raw_content || "",
                doc.extracted_json ? JSON.stringify(doc.extracted_json) : "",
                doc.title || "",
                doc.file_name || "",
              ]
                .join(" ")
                .toLowerCase();
              // Require at least 60% of tokens to match (or at least 1 if short)
              const minMatches = contentTokens.length <= 2
                ? 1
                : Math.max(2, Math.ceil(contentTokens.length * 0.6));
              const matches = contentTokens.filter((t) => haystack.includes(t)).length;
              const hasStrongMatch =
                contentTokens.length <= 6 &&
                contentTokens.some((t) => t.length >= 4 && haystack.includes(t));
              return matches >= minMatches || hasStrongMatch;
            });
            if (filtered.length) {
              docs = filtered.slice(0, 6);
            }
          }
        }
      }

      const decisionIntent =
        /\b(decision|decisions|outcome|log|logged|approve|approved|reject|rejected)\b/i.test(question);
      const decisionStopwords = new Set([
        "the",
        "and",
        "for",
        "with",
        "about",
        "tell",
        "what",
        "which",
        "that",
        "this",
        "from",
        "into",
        "your",
        "you",
        "have",
        "does",
        "did",
        "are",
        "can",
        "will",
        "should",
        "could",
        "please",
        "company",
        "companies",
        "decision",
        "decisions",
        "meeting",
        "notes",
        "table",
        "document",
      ]);
      const decisionTokens = tokens.filter((t) => !decisionStopwords.has(t));
      const minDecisionMatches = Math.max(
        1,
        decisionTokens.length >= 3 ? Math.ceil(decisionTokens.length * 0.5) : 1
      );
      
      const decisionMatches = decisionIntent
        ? decisions
            .filter((d) => {
              const haystack = [
                d.startupName,
                d.actionType,
                d.outcome ?? "",
                d.notes ?? "",
                d.actor ?? "",
              ]
                .join(" ")
                .toLowerCase();
              if (!decisionTokens.length) return false;
              const matches = decisionTokens.filter((t) => haystack.includes(t)).length;
              return matches >= minDecisionMatches;
            })
            .slice(0, 5)
        : [];

      if (error) {
        if (searchTimeoutId !== null) {
          window.clearTimeout(searchTimeoutId);
        }
        createAssistantMessage(
          `Search failed: ${error.message || "Could not query documents."}`,
          threadId
        );
        setChatIsLoading(false);
        return;
      }

      // STRICT FILTERING: Only keep documents that are actually relevant
      // Allow strong matches for short, entity-like queries
      const minTokenMatches = contentTokens.length <= 2
        ? 1
        : Math.max(2, Math.ceil(contentTokens.length * 0.6));
      const filteredDocs = (docs || []).filter((doc) => {
        if (!contentTokens.length) return false; // No tokens = no match
        const haystack = [
          doc.raw_content || "",
          doc.extracted_json ? JSON.stringify(doc.extracted_json) : "",
          doc.title || "",
          doc.file_name || "",
        ]
          .join(" ")
          .toLowerCase();
        const matches = contentTokens.filter((t) => haystack.includes(t)).length;
        const hasStrongMatch =
          contentTokens.length <= 6 &&
          contentTokens.some((t) => t.length >= 4 && haystack.includes(t));
        return matches >= minTokenMatches || hasStrongMatch;
      });

      // Check if this is a meta-question (about capabilities/system)
      const isMetaQuestion = (() => {
        const q = normalizedQuestion;
        const metaPatterns = [
          "what can you do",
          "what could you do",
          "what are you",
          "what do you do",
          "how do you work",
          "what is your purpose",
          "what are your capabilities",
          "what can you help",
          "how can you help",
          "what features",
          "what functionality",
          "what is ventureos",
          "who are you",
          "introduce yourself",
          "what is this",
          "what is this system",
          "what is this platform",
        ];
        return metaPatterns.some(pattern => q.includes(pattern));
      })();

      // For meta-questions, answer even without sources
      if (isMetaQuestion && (!filteredDocs || filteredDocs.length === 0)) {
        if (searchTimeoutId !== null) {
          window.clearTimeout(searchTimeoutId);
        }
        setChatIsLoading(false);
        setIsClaudeLoading(true);
        const streamer = createStreamingAssistantMessage(threadId);
        let streamCompleted = false;
        const streamTimeout = setTimeout(() => {
          if (!streamCompleted) {
            console.error("Meta-question stream timeout");
            streamer.setError("Request timed out. Please try again.");
            setIsClaudeLoading(false);
          }
        }, 75000);
        try {
          // Answer meta-questions with general knowledge (streaming)
          const threadMessages = messages
            .filter((m) => m.threadId === threadId)
            .slice(-10)
            .map((m) => ({
              role: (m.author === "assistant" ? "assistant" : "user") as "assistant" | "user",
              content: m.text,
            }));
          await askClaudeAnswerStream(
            {
              question,
              sources: [],
              decisions: [],
              previousMessages: threadMessages,
            },
            (chunk) => {
              streamer.appendChunk(chunk);
            },
            (error) => {
              streamCompleted = true;
              clearTimeout(streamTimeout);
              streamer.setError(error.message || "Failed to answer. Please try again.");
              setIsClaudeLoading(false);
            }
          );
          streamCompleted = true;
          clearTimeout(streamTimeout);
          streamer.finalize();
        } catch (err) {
          streamCompleted = true;
          clearTimeout(streamTimeout);
          streamer.setError(err instanceof Error ? err.message : "Failed to answer. Please try again.");
        } finally {
          setIsClaudeLoading(false);
        }
        return;
      }

      const lowSignalFollowUp =
        isFollowUpQuery && contentTokens.length <= 1;

      if (!filteredDocs || filteredDocs.length === 0 || lowSignalFollowUp) {
        if (
          isFollowUpQuery &&
          previousEvidence &&
          previousEvidence.docs.length > 0 &&
          previousEvidenceThreadId === threadId
        ) {
          const answerDocs = previousEvidence.docs.slice(0, 3);
          setLastEvidence({ question, docs: answerDocs, decisions: decisionMatches });
          setLastEvidenceThreadId(threadId);
          setChatIsLoading(false);
          // Clear search timeout - Claude has its own 70s timeout
          if (searchTimeoutId !== null) {
            window.clearTimeout(searchTimeoutId);
          }
          // Use Claude with the prior sources
          setIsClaudeLoading(true);
          const streamer = createStreamingAssistantMessage(threadId);
          let streamCompleted = false;
          const streamTimeout = setTimeout(() => {
            if (!streamCompleted) {
              console.error("Follow-up stream timeout");
              streamer.setError("Request timed out. Please try again.");
              setIsClaudeLoading(false);
            }
          }, 75000);
          try {
            const claudeTokens = question
              .toLowerCase()
              .split(/\W+/)
              .map((t) => t.trim())
              .filter((t) => t.length > 3);
            const sources = answerDocs.map((doc) => ({
              title: doc.title,
              file_name: doc.file_name,
              snippet: buildClaudeContext(doc, claudeTokens, isComprehensiveQuestion),
            }));
            const decisionsForClaude = decisionIntent
              ? decisionMatches.map((d) => ({
                  startup_name: d.startupName,
                  action_type: d.actionType,
                  outcome: d.outcome ?? null,
                  notes: d.notes ?? null,
                }))
              : [];
            
            // Get previous messages from this thread for context
            const threadMessages = messages
              .filter((m) => m.threadId === threadId)
              .slice(-10) // Last 10 messages for context
              .map((m) => ({
                role: (m.author === "assistant" ? "assistant" : "user") as "assistant" | "user",
                content: m.text,
              }));
            
            await askClaudeAnswerStream(
              {
                question,
                sources,
                decisions: decisionsForClaude,
                previousMessages: threadMessages,
              },
              (chunk) => {
                if (!streamCompleted) {
                  streamer.appendChunk(chunk);
                }
              },
              (error) => {
                if (!streamCompleted) {
                  streamCompleted = true;
                  clearTimeout(streamTimeout);
                  streamer.setError(error.message || "Claude answer failed. Please try again.");
                  setIsClaudeLoading(false);
                }
              }
            );
            // Only finalize if stream completed successfully
            if (!streamCompleted) {
              streamCompleted = true;
              clearTimeout(streamTimeout);
              streamer.finalize();
            }
          } catch (err) {
            streamCompleted = true;
            clearTimeout(streamTimeout);
            streamer.setError(err instanceof Error ? err.message : "Claude answer failed. Please try again.");
          } finally {
            setIsClaudeLoading(false);
          }
          return;
        }
        const fallback = decisionIntent
          ? decisionMatches.length
            ? `${formatDecisionMatches(decisionMatches)}\n\nIf you want deeper answers, upload or link supporting documents in the Sources tab.`
            : `I couldn't find matching decisions for: "${question}".\n\n💡 Try:\n1. Searching by company name or decision type\n2. Logging decisions in the Decision Logger\n3. Checking your Knowledge Scope (My docs / Team docs)`
          : `I couldn't find relevant documents in your uploaded sources for: "${question}"\n\n💡 To get answers:\n1. Upload relevant documents (pitch decks, memos, meeting notes) in the Sources tab\n2. Or try a different question about companies/sectors you've already uploaded\n3. Check your Knowledge Scope settings (My docs / Team docs)`;
        if (searchTimeoutId !== null) {
          window.clearTimeout(searchTimeoutId);
        }
        createAssistantMessage(fallback, threadId);
        // Don't set lastEvidence if no docs found - prevents Claude from being called
        setLastEvidence(null);
        setChatIsLoading(false);
        return;
      }

      const decisionBlock = decisionIntent && decisionMatches.length
        ? `\n\nRelated decisions:\n${decisionMatches
            .map(
              (d, index) =>
                `${index + 1}. ${d.startupName} — ${d.actionType}${
                  d.outcome ? ` (${d.outcome})` : ""
                }${d.notes ? ` — ${d.notes}` : ""}`
            )
            .join("\n")}`
        : "";

      const semanticNote = semanticFailed
        ? "\n\nNote: Semantic search was unavailable, so I used keyword search."
        : "";

      // For comprehensive questions, use more sources (up to 5)
      const maxDocs = isComprehensiveQuestion ? 5 : 3;
      const answerDocs = filteredDocs.slice(0, maxDocs);
      setLastEvidence({ question, docs: answerDocs, decisions: decisionMatches });
      setLastEvidenceThreadId(threadId);
      setChatIsLoading(false);
      // Clear search timeout - Claude has its own 70s timeout
      if (searchTimeoutId !== null) {
        window.clearTimeout(searchTimeoutId);
      }

      // Always use Claude for the final answer once sources exist
      setIsClaudeLoading(true);
      const streamer = createStreamingAssistantMessage(threadId, answerDocs.map((doc) => doc.id));
      let fullAnswer = "";
      let streamCompleted = false;
      
      // Add timeout to prevent infinite hanging
      const streamTimeout = setTimeout(() => {
        if (!streamCompleted) {
          console.error("Stream timeout - no response after 75 seconds");
          streamer.setError("Request timed out. The response is taking too long. Please try again with a simpler question.");
          setIsClaudeLoading(false);
        }
      }, 75000);
      
      try {
        const docsForClaude = answerDocs;
        const claudeTokens = question
          .toLowerCase()
          .split(/\W+/)
          .map((t) => t.trim())
          .filter((t) => t.length > 3);
        const sources = docsForClaude.map((doc) => ({
          title: doc.title,
          file_name: doc.file_name,
          snippet: buildClaudeContext(doc, claudeTokens, isComprehensiveQuestion),
        }));
        const decisionsForClaude = decisionIntent
          ? decisionMatches.map((d) => ({
              startup_name: d.startupName,
              action_type: d.actionType,
              outcome: d.outcome ?? null,
              notes: d.notes ?? null,
            }))
          : [];
        
        // Get previous messages from this thread for context
        const threadMessages = messages
          .filter((m) => m.threadId === threadId)
          .slice(-10) // Last 10 messages for context
          .map((m) => ({
            role: (m.author === "assistant" ? "assistant" : "user") as "assistant" | "user",
            content: m.text,
          }));
        
        await askClaudeAnswerStream(
          {
            question,
            sources,
            decisions: decisionsForClaude,
            previousMessages: threadMessages,
          },
          (chunk) => {
            if (!streamCompleted) {
              fullAnswer += chunk;
              streamer.appendChunk(chunk);
            }
          },
          (error) => {
            if (!streamCompleted) {
              streamCompleted = true;
              clearTimeout(streamTimeout);
              const errorMsg = error.message || "Claude answer failed. Please try again.";
              console.error("Stream error:", errorMsg);
              streamer.setError(errorMsg);
              setIsClaudeLoading(false);
            }
          }
        );
        // Only finalize if stream completed successfully (no error was called)
        if (!streamCompleted && fullAnswer.length > 0) {
          streamCompleted = true;
          clearTimeout(streamTimeout);
          // Append decision block and semantic note after streaming completes
          streamer.appendChunk(decisionBlock + semanticNote);
          streamer.finalize();
        } else if (!streamCompleted) {
          // Stream completed but no data received - ensure timeout is cleared
          streamCompleted = true;
          clearTimeout(streamTimeout);
          setIsClaudeLoading(false);
        }
        const estimate = estimateClaudeCost(question);
        persistCostLog({
          ts: new Date().toISOString(),
          question: question.slice(0, 120),
          estInputTokens: estimate.estInputTokens,
          estOutputTokens: estimate.estOutputTokens,
          estCostUsd: estimate.estCostUsd,
        });
      } catch (error: any) {
        streamCompleted = true;
        clearTimeout(streamTimeout);
        const errorMsg = error?.message || "Could not generate an answer.";
        // Provide more helpful error messages
        let userMessage = `Claude answer failed: ${errorMsg}`;
        if (errorMsg.includes("timeout") || errorMsg.includes("timed out")) {
          userMessage = `The request timed out after 70 seconds. This can happen with:\n\n` +
            `• Complex questions requiring deep analysis\n` +
            `• Large documents with lots of context\n` +
            `• Slow API responses\n\n` +
            `💡 **Try:**\n` +
            `• Rephrasing your question to be more specific\n` +
            `• Breaking complex questions into smaller parts\n` +
            `• Asking about specific companies/topics (e.g., "Giga Energy intern responsibilities")\n` +
            `• Checking if your documents contain the information\n` +
            `• Trying again in a moment`;
        } else if (errorMsg.includes("HTTP error") || errorMsg.includes("Failed to fetch")) {
          userMessage = `Network error: ${errorMsg}\n\n` +
            `💡 **Check:**\n` +
            `• Your internet connection\n` +
            `• If the API service is available\n` +
            `• Try again in a moment`;
        } else if (errorMsg.includes("AbortError") || errorMsg.includes("aborted")) {
          userMessage = `Request was cancelled. Please try again.`;
        }
        streamer.setError(userMessage);
      } finally {
        setIsClaudeLoading(false);
      }
    },
    [
      activeEventId,
      ensureActiveEventId,
      buildSnippet,
      buildClaudeContext,
      docContainsTokens,
      createAssistantMessage,
      decisions,
      scopes,
      profile,
      user,
      askClaudeAnswerStream,
      persistCostLog,
    ]
  );

  const addMessage = async () => {
    if (chatIsLoading) return;
    if (!input.trim()) return;
    let threadId = activeThread;
    if (!threadId) {
      const createdId = await createChatThread("Main thread");
      const newThreadId = createdId || `t-${Date.now()}`;
      setThreads((prev) => [...prev, { id: newThreadId, title: "Main thread" }]);
      setActiveThread(newThreadId);
      threadId = newThreadId;
    }
    const question = input.trim();
    const id = `m-${Date.now()}`;
    setMessages((prev) => [...prev, { id, author: "user", text: question, threadId }]);
    void persistChatMessage({
      threadId,
      role: "user",
      content: question,
      model: null,
      sourceDocIds: null,
    });
    setInput("");
    setChatIsLoading(true);
    try {
      await askFund(question, threadId);
    } catch (err) {
      console.error("Chat error:", err);
      const errorMsg = err instanceof Error ? err.message : "Chat failed unexpectedly. Please try again.";
      createAssistantMessage(
        `❌ Error: ${errorMsg}\n\nPlease try again or check the console for details.`,
        threadId
      );
    } finally {
      setChatIsLoading(false);
      setIsClaudeLoading(false);
    }
  };

  // Removed createBranch - no longer needed

  const toggleScope = (id: string, checked: boolean) => {
    setScopes((prev) => prev.map((s) => (s.id === id ? { ...s, checked } : s)));
  };

  const evidence = initialKOs;
  const buildStamp =
    (import.meta.env.VITE_BUILD_STAMP as string | undefined) ||
    (import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA as string | undefined) ||
    "local";
  const lastTokens = useMemo(() => {
    if (!lastEvidence?.question) return [];
    return lastEvidence.question
      .toLowerCase()
      .split(/\W+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 3);
  }, [lastEvidence?.question]);

  const renderAssistantContent = useCallback((text: string) => {
    const lines = text.split("\n");
    const blocks: Array<{ type: "p" | "ul" | "h"; content: string | string[] }> = [];
    let paragraph: string[] = [];
    let list: string[] = [];

    const flushParagraph = () => {
      if (paragraph.length) {
        blocks.push({ type: "p", content: paragraph.join(" ") });
        paragraph = [];
      }
    };

    const flushList = () => {
      if (list.length) {
        blocks.push({ type: "ul", content: list });
        list = [];
      }
    };

    lines.forEach((raw) => {
      const line = raw.trim();
      if (!line) {
        flushParagraph();
        flushList();
        return;
      }
      if (line.endsWith(":") && line.length < 64) {
        flushParagraph();
        flushList();
        blocks.push({ type: "h", content: line.replace(/:$/, "") });
        return;
      }
      if (line.startsWith("- ") || line.startsWith("* ")) {
        flushParagraph();
        list.push(line.replace(/^[-*]\s*/, ""));
        return;
      }
      paragraph.push(line);
    });

    flushParagraph();
    flushList();

    return (
      <div className="space-y-2">
        {blocks.map((block, idx) => {
          if (block.type === "h") {
            return (
              <div key={idx} className="text-xs uppercase tracking-wide text-white/70 font-mono font-bold">
                {block.content as string}
              </div>
            );
          }
          if (block.type === "ul") {
            return (
              <ul key={idx} className="list-disc pl-5 text-sm text-white space-y-1">
                {(block.content as string[]).map((item, itemIdx) => (
                  <li key={itemIdx} className="text-white">{item}</li>
                ))}
              </ul>
            );
          }
          return (
            <p key={idx} className="text-sm text-white leading-relaxed">
              {block.content as string}
            </p>
          );
        })}
      </div>
    );
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white relative overflow-hidden">
      {/* Parallax Background */}
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 237, 0, 0.2) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 237, 0, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b-2 border-white pb-4">
          <div>
            <h1 className="text-3xl font-black font-mono flex items-center gap-2 text-white tracking-tight">
              <Brain className="h-7 w-7 text-[#FFED00]" />
              COMPANY INTELLIGENCE SYSTEM
            </h1>
            <p className="text-xs text-white/70 uppercase tracking-wider font-semibold mt-1">
              AI-POWERED DOCUMENT EXTRACTION, DECISION TRACKING, AND KNOWLEDGE MANAGEMENT
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="border-2 border-white bg-transparent rounded-none px-3 py-2 text-xs text-white/70">
              <div className="font-bold text-white uppercase tracking-wider">
                {profile?.full_name || profile?.email || "SIGNED-IN USER"}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-[#FFED00] text-black font-bold">{profile?.role?.toUpperCase() || "MEMBER"}</Badge>
                {profile?.organization_id ? (
                  <span className="truncate text-white/50">ORG: {profile.organization_id.slice(0, 8)}...</span>
                ) : (
                  <span className="text-white/50">ORG: PENDING</span>
                )}
              </div>
              <div className="mt-1 text-[10px] text-white/40 uppercase tracking-wider">
                BUILD: {buildStamp}
              </div>
            </div>
            {(profile?.role as string) === "admin" && (
              <Button variant="outline" asChild className="border-2 border-white bg-transparent text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] transition-all font-bold">
                <Link to="/admin">
                  <Shield className="h-4 w-4 mr-2" />
                  Admin Panel
                </Link>
              </Button>
            )}
            <Button variant="outline" onClick={signOut} className="border-2 border-white bg-transparent text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] transition-all font-bold">
              Log out
            </Button>
            <Button variant="outline" asChild className="border-2 border-white bg-transparent text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] transition-all font-bold">
              <a href="/">← Back to Matchmaking</a>
            </Button>
          </div>
        </div>

        {/* Main Layout with Left Sidebar */}
        <div className="flex gap-4">
          {/* Left Sidebar - Navigation */}
          <div className="w-64 flex-shrink-0 flex flex-col gap-4">
            <div className="border-2 border-white bg-transparent p-4 space-y-2 sticky top-4">
              <div className="text-xs text-white/70 font-mono font-bold uppercase tracking-wider mb-4 pb-2 border-b border-white/30">
                Navigation
              </div>
              <button
                onClick={() => setActiveTab("chat")}
                className={`w-full flex items-center gap-2 px-3 py-2 border-2 transition-all font-mono font-bold text-sm ${
                  activeTab === "chat"
                    ? "bg-[#FFED00] text-black border-[#FFED00]"
                    : "bg-transparent text-white border-white hover:border-[#FFED00] hover:bg-[#FFED00]/5"
                }`}
              >
                <Brain className="h-4 w-4" />
                Intelligence Chat
              </button>
              {(profile?.role === "managing_partner" || profile?.role === "organizer") && (
                <button
                  onClick={() => setActiveTab("onboarding")}
                  className={`w-full flex items-center gap-2 px-3 py-2 border-2 transition-all font-mono font-bold text-sm ${
                    activeTab === "onboarding"
                      ? "bg-[#FFED00] text-black border-[#FFED00]"
                      : "bg-transparent text-white border-white hover:border-[#FFED00] hover:bg-[#FFED00]/5"
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                  Onboarding
                </button>
              )}
              <button
                onClick={() => setActiveTab("overview")}
                className={`w-full flex items-center gap-2 px-3 py-2 border-2 transition-all font-mono font-bold text-sm ${
                  activeTab === "overview"
                    ? "bg-[#FFED00] text-black border-[#FFED00]"
                    : "bg-transparent text-white border-white hover:border-[#FFED00] hover:bg-[#FFED00]/5"
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab("sources")}
                className={`w-full flex items-center gap-2 px-3 py-2 border-2 transition-all font-mono font-bold text-sm ${
                  activeTab === "sources"
                    ? "bg-[#FFED00] text-black border-[#FFED00]"
                    : "bg-transparent text-white border-white hover:border-[#FFED00] hover:bg-[#FFED00]/5"
                }`}
              >
                <Folder className="h-4 w-4" />
                Sources
              </button>
              <button
                onClick={() => setActiveTab("decisions")}
                className={`w-full flex items-center gap-2 px-3 py-2 border-2 transition-all font-mono font-bold text-sm ${
                  activeTab === "decisions"
                    ? "bg-[#FFED00] text-black border-[#FFED00]"
                    : "bg-transparent text-white border-white hover:border-[#FFED00] hover:bg-[#FFED00]/5"
                }`}
              >
                <ClipboardList className="h-4 w-4" />
                Decision Logger
              </button>
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`w-full flex items-center gap-2 px-3 py-2 border-2 transition-all font-mono font-bold text-sm ${
                  activeTab === "dashboard"
                    ? "bg-[#FFED00] text-black border-[#FFED00]"
                    : "bg-transparent text-white border-white hover:border-[#FFED00] hover:bg-[#FFED00]/5"
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                Decision Engine
              </button>
            </div>

            {/* Knowledge Scope - Only show in chat tab */}
            {activeTab === "chat" && (
              <div className="border-2 border-white bg-transparent p-4 sticky top-4">
                <div className="text-xs text-white/70 font-mono font-bold uppercase tracking-wider mb-4 pb-2 border-b border-white/30">
                  Knowledge Scope
                </div>
                <div className="space-y-2">
                  {scopes.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm border-2 border-white px-2 py-1.5 rounded-md cursor-pointer hover:bg-[#FFED00]/5 hover:border-[#FFED00] transition-colors text-white font-mono">
                      <Checkbox checked={s.checked} onCheckedChange={(val) => toggleScope(s.id, val === true)} className="border-white data-[state=checked]:bg-[#FFED00] data-[state=checked]:border-[#FFED00]" />
                      <span className="flex-1 text-xs">{s.label}</span>
                      <Badge variant="outline" className="text-xs border-white text-white bg-transparent font-mono">
                        {s.type}
                      </Badge>
                    </label>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">

          {/* Onboarding Tab */}
          <TabsContent value="onboarding">
            <OnboardingTab
              profile={profile}
              sources={sources}
              documents={documents}
              decisions={decisions}
              onNavigate={setActiveTab}
            />
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="space-y-4 overflow-hidden">
            {isDeveloper && (
              <Card className="border-2 border-white bg-transparent">
                <CardHeader className="pb-2 border-b-2 border-white">
                  <CardTitle className="text-sm text-white font-mono font-black uppercase tracking-tight">Developer Cost Log</CardTitle>
                  <CardDescription className="text-xs text-white/70 font-mono">
                    Estimated Claude spend (local only).
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <div className="font-medium">
                    Total: $
                    {costLog.reduce((sum, entry) => sum + entry.estCostUsd, 0).toFixed(4)}
                  </div>
                  {costLog.length === 0 ? (
                    <div className="text-white/70 font-mono">No Claude calls logged yet.</div>
                  ) : (
                    costLog.slice(0, 5).map((entry) => (
                      <div key={entry.ts} className="border rounded-md p-2">
                        <div className="font-medium">${entry.estCostUsd} • {entry.ts}</div>
                        <div className="text-white/70 font-mono">Q: {entry.question}</div>
                        <div className="text-white/70 font-mono">
                          Tokens: {entry.estInputTokens} in / {entry.estOutputTokens} out
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )}
            {/* Chat Container - Fixed height, scrollable within, no page scroll */}
            <div className="flex flex-col overflow-hidden" style={{ height: "600px", maxHeight: "600px" }}>
              <Card className="flex-1 flex flex-col border-2 border-white bg-transparent min-h-0 h-full overflow-hidden">
                <CardHeader className="pb-3 border-b-2 border-white flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-mono font-black uppercase tracking-tight text-white">Chat</CardTitle>
                    <div className="text-xs text-white/70 font-mono">
                      Scope: {scopes.filter((s) => s.checked).map((s) => s.label).join(", ") || "None"}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0 overflow-hidden min-h-0">
                  <div 
                    ref={chatContainerRef}
                    className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-transparent"
                    style={{ height: "100%", maxHeight: "100%" }}
                  >
                      {scopedMessages.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center space-y-2">
                            <div className="text-lg font-mono font-bold text-white">Start a conversation</div>
                            <div className="text-sm text-white/70 font-mono">Ask questions about your documents</div>
                          </div>
                        </div>
                      ) : (
                        <>
                          {scopedMessages.map((m, index) => (
                            <div
                              key={m.id}
                              className={`flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                                m.author === "user" ? "justify-end" : "justify-start"
                              }`}
                              style={{ animationDelay: `${index * 50}ms` }}
                            >
                              {m.author === "assistant" && (
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#FFED00]/20 flex items-center justify-center">
                                  <svg className="w-5 h-5 text-[#FFED00]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                  </svg>
                                </div>
                              )}
                              <div
                                className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                                  m.author === "user"
                                    ? "bg-[#FFED00] text-black font-mono"
                                    : "bg-transparent border-2 border-white text-white font-mono"
                                }`}
                              >
                                {m.author === "assistant" ? (
                                  <div className="prose prose-sm dark:prose-invert max-w-none text-white [&_*]:text-white [&_p]:text-white [&_strong]:text-white [&_em]:text-white [&_ul]:text-white [&_ol]:text-white [&_li]:text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_h4]:text-white [&_code]:text-white [&_pre]:text-white">
                                    {m.isStreaming && m.text === "..." ? (
                                      <span className="inline-flex items-center gap-1 text-white">
                                        <span className="animate-pulse">.</span>
                                        <span className="animate-pulse delay-75">.</span>
                                        <span className="animate-pulse delay-150">.</span>
                                      </span>
                                    ) : (
                                      <>
                                        {renderAssistantContent(m.text)}
                                        {m.isStreaming && (
                                          <span className="inline-block w-2 h-5 ml-1 bg-[#FFED00] animate-pulse" />
                                        )}
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-sm leading-relaxed whitespace-pre-wrap text-black">{m.text}</div>
                                )}
                              </div>
                              {m.author === "user" && (
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#FFED00]/20 flex items-center justify-center">
                                  <svg className="w-5 h-5 text-[#FFED00]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          ))}
                          <div ref={messagesEndRef} />
                        </>
                      )}
                    </div>

                    {lastEvidence && lastEvidence.docs.length > 0 && (
                      <div className="border-t-2 border-white bg-transparent px-4 py-3 space-y-2 flex-shrink-0">
                        <div className="text-xs font-mono font-bold text-white mb-2">
                          Sources Used
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {lastEvidence.docs.slice(0, 3).map((doc, index) => (
                            <Button
                              key={doc.id}
                              size="sm"
                              variant="outline"
                              className="text-xs h-auto py-1.5 px-3 border-2 border-white bg-transparent text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] font-mono font-bold"
                              onClick={() => handleOpenDocument(doc.id)}
                            >
                              {index + 1}. {doc.title || doc.file_name || "Untitled"}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="border-t-2 border-white p-4 bg-transparent flex-shrink-0">
                      <div className="flex gap-2 items-end">
                        <Textarea
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          placeholder="Ask a question..."
                          className="min-h-[60px] max-h-[200px] resize-none border-2 border-white bg-transparent text-white placeholder:text-white/50 font-mono"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey && !chatIsLoading) {
                              e.preventDefault();
                              addMessage();
                            }
                          }}
                        />
                        <Button 
                          onClick={addMessage} 
                          disabled={chatIsLoading || !input.trim()}
                          size="lg"
                          className="h-[60px] px-6 bg-[#FFED00] text-black hover:bg-[#FFED00]/80 font-bold border-2 border-[#FFED00] transition-all hover:shadow-[0_0_20px_rgba(255,237,0,0.5)] disabled:opacity-50"
                        >
                          {chatIsLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                          )}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-white/70 font-mono">
                          {chatIsLoading ? "Searching..." : "Press Enter to send"}
                        </span>
                        <label className="flex items-center gap-2 text-xs text-white/70 font-mono">
                          <Checkbox
                            checked={semanticMode}
                            onCheckedChange={(val) => setSemanticMode(val === true)}
                            className="border-white data-[state=checked]:bg-[#FFED00] data-[state=checked]:border-[#FFED00]"
                          />
                          Semantic search
                        </label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
            </div>
          </TabsContent>

          {/* Sources Tab */}
          <TabsContent value="sources">
            <SourcesTab
              sources={sources}
              documents={documents}
              onCreateSource={handleCreateSource}
              onDeleteSource={handleDeleteSource}
              getGoogleAccessToken={getGoogleAccessToken}
              onAutoLogDecision={handleAutoLogDecision}
              onDocumentSaved={(doc) =>
                setDocuments((prev) => [
                  { id: doc.id, title: doc.title, storage_path: doc.storage_path },
                  ...prev,
                ])
              }
              activeEventId={activeEventId}
              ensureActiveEventId={ensureActiveEventId}
              currentUserId={profile?.id || user?.id || null}
              indexDocumentEmbeddings={indexDocumentEmbeddings}
            />
          </TabsContent>

          {/* Dashboard Tab */}
          <TabsContent value="overview">
            <DashboardTab decisions={decisions} documents={documents} sources={sources} />
          </TabsContent>

          {/* Decisions Tab */}
          <TabsContent value="decisions">
              <DecisionLoggerTab
              decisions={decisions}
              setDecisions={setDecisions}
              activeEventId={activeEventId}
              actorDefault={profile?.full_name || profile?.email || ""}
              draftDecision={draftDecision}
              onDraftConsumed={() => setDraftDecision(null)}
                draftDocumentId={draftDocumentId}
                onDraftDocumentConsumed={() => setDraftDocumentId(null)}
              documents={documents}
              onOpenDocument={handleOpenDocument}
                onOpenConverter={() => setActiveTab("sources")}
                currentUserId={profile?.id || user?.id || null}
            />
          </TabsContent>

              {/* Decision Engine Dashboard Tab */}
              <TabsContent value="dashboard">
                <DecisionEngineDashboardTab decisions={decisions} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Document Viewer Modal */}
      <Dialog open={!!viewingDocument} onOpenChange={(open) => !open && setViewingDocument(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span>{viewingDocument?.title || "Document Viewer"}</span>
              <Button variant="secondary" onClick={handleLogDecisionFromDocument}>
                Add decision
              </Button>
            </DialogTitle>
            <DialogDescription>
              {viewingDocument?.file_name && `File: ${viewingDocument.file_name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-4">
            <Tabs defaultValue="extracted" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="extracted">Extracted JSON</TabsTrigger>
                <TabsTrigger value="raw">Raw Content</TabsTrigger>
              </TabsList>
              <TabsContent value="extracted" className="mt-4">
                {viewingDocument?.extracted_json ? (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground mb-2">
                      Structured data extracted by AI
                    </div>
                    <pre className="p-4 bg-transparent border-2 border-white rounded-lg overflow-auto max-h-[500px] text-xs text-white font-mono">
                      {JSON.stringify(viewingDocument.extracted_json, null, 2)}
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(viewingDocument?.extracted_json, null, 2)], {
                          type: "application/json",
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${viewingDocument?.title || "document"}-extracted.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download JSON
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No extracted JSON available</p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="raw" className="mt-4">
                {viewingDocument?.raw_content ? (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground mb-2">
                      Original text content ({viewingDocument.raw_content.length} characters)
                    </div>
                    <pre className="p-4 bg-muted rounded-lg overflow-auto max-h-[500px] text-xs whitespace-pre-wrap">
                      {viewingDocument.raw_content}
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const blob = new Blob([viewingDocument?.raw_content || ""], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${viewingDocument?.title || "document"}-raw.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Raw Text
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No raw content stored</p>
                    {viewingDocument?.storage_path && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-4"
                        onClick={async () => {
                          if (!viewingDocument?.storage_path) return;
                          const { data, error } = await supabase.storage
                            .from("cis-documents")
                            .createSignedUrl(viewingDocument.storage_path, 60);
                          if (error || !data?.signedUrl) {
                            toast({
                              title: "File not found",
                              description: "Could not access stored file.",
                              variant: "destructive",
                            });
                            return;
                          }
                          window.open(data.signedUrl, "_blank", "noopener,noreferrer");
                        }}
                      >
                        <Link2 className="h-4 w-4 mr-2" />
                        Open Stored File
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
