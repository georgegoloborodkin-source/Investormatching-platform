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
  ChevronDown,
  FolderPlus,
  Link2,
  BarChart3,
  PieChart,
  Eye,
  MessageSquarePlus,
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
  getSourceFoldersByEvent,
  getCompanyConnectionsByEvent,
  insertDecision,
  insertDocument,
  insertSource,
  insertSourceFolder,
  insertCompanyConnection,
  updateCompanyConnection,
  deleteCompanyConnection,
  updateDecision,
  deleteDecision,
  deleteSource,
  getDocumentById,
  type ConnectionType,
  type ConnectionStatus,
  type CompanyConnection,
} from "@/utils/supabaseHelpers";
import { convertFileWithAI, convertWithAI, askClaudeAnswerStream, embedQuery, rerankDocuments, rewriteQueryWithLLM, suggestConnections, type AIConversionResponse, type AskFundConnection } from "@/utils/aiConverter";
import { getClickUpLists, ingestClickUpList, ingestGoogleDrive } from "@/utils/ingestionClient";
import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// TYPES
// ============================================================================

type ScopeItem = { id: string; label: string; checked: boolean; type: "portfolio" | "deal" | "thread" | "global" | "folder" };
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

type SourceFolder = {
  id: string;
  name: string;
  created_at?: string | null;
  created_by?: string | null;
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
          <SelectTrigger className="w-[220px] border-2 border-white bg-transparent text-white hover:bg-white/10 hover:border-[#FFED00] font-mono font-bold">
            <SelectValue placeholder="Filter by document" className="text-white" />
          </SelectTrigger>
          <SelectContent className="bg-[#050505] border-2 border-white">
            <SelectItem value="all" className="text-white font-mono hover:bg-white/10 focus:bg-white/10">All documents</SelectItem>
            {documents.filter((doc) => !!doc.id).map((doc) => (
              <SelectItem key={doc.id} value={doc.id} className="text-white font-mono hover:bg-white/10 focus:bg-white/10">
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#050505] border-2 border-white text-white">
          <DialogHeader>
            <DialogTitle className="text-white font-mono font-bold">Decision Details</DialogTitle>
            <DialogDescription className="text-white/70 font-mono">
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
  sourceFolders,
  onCreateSource,
  onCreateFolder,
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
    folder_id?: string | null;
  }>;
  sourceFolders: SourceFolder[];
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
  onCreateFolder: (name: string) => Promise<SourceFolder | null>;
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
  onDocumentSaved: (doc: { id: string; title: string | null; storage_path: string | null; folder_id?: string | null }) => void;
  activeEventId: string | null;
  ensureActiveEventId: () => Promise<string | null>;
  currentUserId: string | null;
  indexDocumentEmbeddings: (documentId: string, rawContent?: string | null) => Promise<void>;
}) {
  const { toast } = useToast();
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
  const [selectedFolderId, setSelectedFolderId] = useState<string>("none");
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [pendingFolderDocs, setPendingFolderDocs] = useState<Array<{ id: string; title: string | null }>>([]);
  const [folderAssignmentIds, setFolderAssignmentIds] = useState<string[]>([]);
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [isAssigningFolders, setIsAssigningFolders] = useState(false);
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

  const openFolderAssignmentDialog = useCallback(
    (docs: Array<{ id: string; title: string | null }>) => {
      if (!docs.length) return;
      setPendingFolderDocs(docs);
      const defaults = selectedFolderId !== "none" ? [selectedFolderId] : [];
      setFolderAssignmentIds(defaults);
      setIsFolderDialogOpen(true);
    },
    [selectedFolderId]
  );

  const assignFoldersToDocuments = useCallback(async () => {
    if (!pendingFolderDocs.length || folderAssignmentIds.length === 0) {
      setIsFolderDialogOpen(false);
      setPendingFolderDocs([]);
      return;
    }
    setIsAssigningFolders(true);
    try {
      const docIds = pendingFolderDocs.map((d) => d.id);
      const rows = docIds.flatMap((docId) =>
        folderAssignmentIds.map((folderId) => ({
          document_id: docId,
          folder_id: folderId,
          created_by: currentUserId || null,
        }))
      );

      // Replace existing links for these documents
      await supabase.from("document_folder_links").delete().in("document_id", docIds);
      const { error: insertError } = await supabase.from("document_folder_links").insert(rows);
      if (insertError) {
        throw insertError;
      }

      // Keep a primary folder for backward compatibility
      const primaryFolderId = folderAssignmentIds[0] || null;
      await supabase.from("documents").update({ folder_id: primaryFolderId }).in("id", docIds);

      toast({
        title: "Folders assigned",
        description: `Assigned ${folderAssignmentIds.length} folder${folderAssignmentIds.length > 1 ? "s" : ""} to ${docIds.length} document${docIds.length > 1 ? "s" : ""}.`,
      });
    } catch (err) {
      toast({
        title: "Folder assignment failed",
        description: err instanceof Error ? err.message : "Could not assign folders to documents.",
        variant: "destructive",
      });
    } finally {
      setIsAssigningFolders(false);
      setIsFolderDialogOpen(false);
      setPendingFolderDocs([]);
    }
  }, [currentUserId, folderAssignmentIds, pendingFolderDocs, toast]);

  const toggleFolderAssignment = useCallback((folderId: string, checked: boolean) => {
    setFolderAssignmentIds((prev) => {
      if (checked) {
        return prev.includes(folderId) ? prev : [...prev, folderId];
      }
      return prev.filter((id) => id !== folderId);
    });
  }, []);

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
        const uploadedDocs: Array<{ id: string; title: string | null }> = [];

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
            folder_id: null,
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
          uploadedDocs.push({ id: docRecord.id, title: docRecord.title || null });

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
        if (uploadedDocs.length > 0) {
          openFolderAssignmentDialog(uploadedDocs);
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
    [activeEventId, currentUserId, ensureActiveEventId, indexDocumentEmbeddings, onCreateSource, onDocumentSaved, openFolderAssignmentDialog, toast]
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
      let assignmentDoc: { id: string; title: string | null } | null = null;
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
            folder_id: null,
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
            assignmentDoc = { id: docRecord.id, title: docRecord.title || cleanedTitle };
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

      if (!assignmentDoc && result.title) {
        try {
          const { data: recentDocs } = await supabase
            .from("documents")
            .select("id,title")
            .eq("event_id", eventId)
            .eq("file_name", result.title)
            .order("created_at", { ascending: false })
            .limit(1);
          const candidate = Array.isArray(recentDocs) ? recentDocs[0] : null;
          if (candidate?.id) {
            assignmentDoc = { id: candidate.id, title: candidate.title || result.title || cleanedTitle };
          }
        } catch (lookupErr) {
          console.warn("Folder assignment lookup failed:", lookupErr);
        }
      }

      if (assignmentDoc) {
        openFolderAssignmentDialog([assignmentDoc]);
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
  }, [activeEventId, autoExtract, currentUserId, ensureActiveEventId, getGoogleAccessToken, indexDocumentEmbeddings, onAutoLogDecision, onCreateSource, onDocumentSaved, openFolderAssignmentDialog, toast]);

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
      
      // View for all supported document types (including uploaded files, not just native Google docs)
      const allFilesView = new window.google.picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false)
        .setMode(window.google.picker.DocsViewMode.LIST)
        .setMimeTypes([
          // Google native formats
          "application/vnd.google-apps.document",
          "application/vnd.google-apps.spreadsheet",
          "application/vnd.google-apps.presentation",
          // PDFs
          "application/pdf",
          // Microsoft Office formats
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "application/msword",
          "application/vnd.ms-excel",
          "application/vnd.ms-powerpoint",
          // Text formats
          "text/plain",
          "text/csv",
          "text/markdown",
          "application/json",
        ].join(","));
      
      // View specifically for Shared Drives (Team Drives)
      const sharedDriveView = new window.google.picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false)
        .setEnableDrives(true)
        .setMode(window.google.picker.DocsViewMode.LIST);
      
      // Recently viewed files view
      const recentView = new window.google.picker.DocsView()
        .setIncludeFolders(false)
        .setSelectFolderEnabled(false)
        .setMode(window.google.picker.DocsViewMode.LIST)
        .setOwnedByMe(false);  // Include files shared with me
      
      const picker = new window.google.picker.PickerBuilder()
        .setDeveloperKey(googleApiKey)
        .setOAuthToken(accessToken)
        .setAppId(googleClientId.split("-")[0])  // Extract project number from client ID
        .addView(allFilesView)
        .addView(sharedDriveView)
        .addView(recentView)
        .enableFeature(window.google.picker.Feature.SUPPORT_DRIVES)  // Enable Shared Drives
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)  // Allow multiple file selection
        .setCallback((data: any) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const docs = data.docs || [];
            // Handle multiple files if selected
            for (const doc of docs) {
              const pickedUrl = doc?.url;
              if (pickedUrl) {
                setDriveUrl(pickedUrl);
                importDriveUrl(pickedUrl);
              }
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
      {/* ClickUp import temporarily disabled */}

      {/* Folder Management Section */}
      <Card className="border-2 border-white bg-transparent">
        <CardHeader className="border-b-2 border-white">
          <CardTitle className="text-white font-mono font-black uppercase tracking-tight">
            <Folder className="h-5 w-5 inline mr-2 text-[#FFED00]" />
            Document Folders
          </CardTitle>
          <CardDescription className="text-white/70 font-mono">Organize your documents into folders for better context filtering.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Folder Selector */}
          <div>
            <Label className="text-white font-mono font-bold">Select Folder for Uploads</Label>
            <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
              <SelectTrigger className="border-2 border-white bg-transparent text-white">
                <SelectValue placeholder="Select a folder" />
              </SelectTrigger>
              <SelectContent className="bg-[#050505] border-2 border-white">
                <SelectItem value="none" className="text-white font-mono hover:bg-white/10 focus:bg-white/10">
                  <span className="flex items-center gap-2">
                    <Folder className="h-4 w-4" />
                    No Folder (Root)
                  </span>
                </SelectItem>
                {sourceFolders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id} className="text-white font-mono hover:bg-white/10 focus:bg-white/10">
                    <span className="flex items-center gap-2">
                      <Folder className="h-4 w-4 text-[#FFED00]" />
                      {folder.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-white/50 font-mono mt-1">
              This folder will be preselected in the post-upload folder picker.
            </p>
          </div>
          
          {/* Create New Folder */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label className="text-white font-mono font-bold">Create New Folder</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g., Q1 2026 Deals, Due Diligence, Market Research"
                className="border-2 border-white bg-transparent text-white placeholder:text-white/50"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={async () => {
                  if (!newFolderName.trim()) return;
                  setIsCreatingFolder(true);
                  try {
                    const folder = await onCreateFolder(newFolderName.trim());
                    if (folder) {
                      setSelectedFolderId(folder.id);
                      setNewFolderName("");
                      toast({ title: "Folder created", description: `Created folder "${folder.name}"` });
                    }
                  } catch (err) {
                    toast({ title: "Error", description: "Failed to create folder", variant: "destructive" });
                  } finally {
                    setIsCreatingFolder(false);
                  }
                }}
                disabled={isCreatingFolder || !newFolderName.trim()}
                className="w-full border-2 border-white bg-transparent text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] font-bold disabled:opacity-50"
                variant="outline"
              >
                {isCreatingFolder ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FolderPlus className="h-4 w-4 mr-2" />}
                Create Folder
              </Button>
            </div>
          </div>
          
          {/* Existing Folders List */}
          {sourceFolders.length > 0 && (
            <div className="pt-2 border-t border-white/20">
              <Label className="text-white/70 font-mono text-xs mb-2 block">Existing Folders ({sourceFolders.length})</Label>
              <div className="flex flex-wrap gap-2">
                {sourceFolders.map((folder) => (
                  <Badge
                    key={folder.id}
                    variant="outline"
                    className={`cursor-pointer transition-all font-mono ${
                      selectedFolderId === folder.id
                        ? "border-[#FFED00] text-[#FFED00] bg-[#FFED00]/10"
                        : "border-white text-white bg-transparent hover:border-[#FFED00] hover:text-[#FFED00]"
                    }`}
                    onClick={() => setSelectedFolderId(folder.id)}
                  >
                    <Folder className="h-3 w-3 mr-1" />
                    {folder.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-2 border-white bg-transparent">
        <CardHeader className="border-b-2 border-white">
          <CardTitle className="text-white font-mono font-black uppercase tracking-tight">Local Upload</CardTitle>
          <CardDescription className="text-white/70 font-mono">
            Upload files from your computer into Sources.
            {selectedFolderId !== "none" && (
              <span className="ml-2 text-[#FFED00]">
                → Default folder: {sourceFolders.find(f => f.id === selectedFolderId)?.name}
              </span>
            )}
          </CardDescription>
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
            Supported: PDF, Word (.docx), Excel (.xlsx, .xls), Text (.txt, .md, .csv, .json) — all are indexed for AI search.
          </p>
        </CardContent>
      </Card>

      <Card className="border-2 border-white bg-transparent">
        <CardHeader className="border-b-2 border-white">
          <CardTitle className="text-white font-mono font-black uppercase tracking-tight">Google Drive Import</CardTitle>
          <CardDescription className="text-white/70 font-mono">
            Paste a Google Docs/Slides/Sheets link or choose from Drive.
            {selectedFolderId !== "none" && (
              <span className="ml-2 text-[#FFED00]">
                → Default folder: {sourceFolders.find(f => f.id === selectedFolderId)?.name}
              </span>
            )}
          </CardDescription>
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
          <CardTitle className="text-white font-mono font-black uppercase tracking-tight">Tracked Sources</CardTitle>
          <CardDescription className="text-white/70 font-mono">{sources.length} items</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-white">
          {sources.length === 0 ? (
            <div className="text-sm text-white/70 font-mono">No sources yet. Upload documents or import from Google Drive to create sources.</div>
          ) : (
            sources.map((source) => {
              const relatedDoc = documents.find(
                (d: any) => d.storage_path === source.storage_path || d.title === source.title
              );
              const relatedFolderName = relatedDoc?.folder_id
                ? sourceFolders.find((folder) => folder.id === relatedDoc.folder_id)?.name
                : null;

              return (
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
                    {relatedDoc && (relatedDoc.uploader_email || relatedDoc.uploader_name) && (
                      <div className="text-xs text-white/70 font-mono">
                        Uploaded by: {relatedDoc.uploader_name || relatedDoc.uploader_email}
                      </div>
                    )}
                    {relatedFolderName && (
                      <div className="text-xs text-white/70 font-mono">
                        Folder: <span className="text-[#FFED00]">{relatedFolderName}</span>
                      </div>
                    )}
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
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isFolderDialogOpen}
        onOpenChange={(open) => {
          setIsFolderDialogOpen(open);
          if (!open) {
            setPendingFolderDocs([]);
            setFolderAssignmentIds([]);
          }
        }}
      >
        <DialogContent className="bg-[#050505] border-2 border-white text-white">
          <DialogHeader>
            <DialogTitle className="text-white font-mono font-black uppercase tracking-tight">Assign Folders</DialogTitle>
            <DialogDescription className="text-white/70 font-mono">
              Choose one or more folders for your uploaded documents.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-white/70 font-mono">
              {pendingFolderDocs.length} document{pendingFolderDocs.length > 1 ? "s" : ""} uploaded:
            </div>
            <div className="space-y-1 max-h-[160px] overflow-y-auto border border-white/20 rounded-md p-2">
              {pendingFolderDocs.map((doc) => (
                <div key={doc.id} className="text-xs text-white font-mono truncate">
                  • {doc.title || "Untitled document"}
                </div>
              ))}
            </div>
            {sourceFolders.length === 0 ? (
              <div className="text-xs text-white/70 font-mono border border-white/20 rounded-md p-2">
                No folders yet. Create a folder first to organize these documents.
              </div>
            ) : (
              <div className="space-y-2">
                {sourceFolders.map((folder) => (
                  <label
                    key={folder.id}
                    className="flex items-center gap-2 text-xs border border-white/40 px-2 py-1.5 rounded-md cursor-pointer hover:bg-[#FFED00]/5 hover:border-[#FFED00] transition-colors text-white font-mono"
                  >
                    <Checkbox
                      checked={folderAssignmentIds.includes(folder.id)}
                      onCheckedChange={(val) => toggleFolderAssignment(folder.id, val === true)}
                      className="border-white data-[state=checked]:bg-[#FFED00] data-[state=checked]:border-[#FFED00]"
                    />
                    <Folder className="h-3 w-3 text-white/70" />
                    <span className="flex-1">{folder.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              className="border-2 border-white bg-transparent text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] font-bold"
              onClick={() => {
                setIsFolderDialogOpen(false);
                setPendingFolderDocs([]);
                setFolderAssignmentIds([]);
              }}
            >
              Skip for now
            </Button>
            <Button
              className="bg-[#FFED00] text-black hover:bg-[#FFED00]/80 font-bold border-2 border-[#FFED00] transition-all hover:shadow-[0_0_20px_rgba(255,237,0,0.5)] disabled:opacity-50"
              disabled={isAssigningFolders || folderAssignmentIds.length === 0}
              onClick={assignFoldersToDocuments}
            >
              {isAssigningFolders ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FolderPlus className="h-4 w-4 mr-2" />}
              Assign folders
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
  
  // Company Connections state for visual graph and decision logging
  const [companyConnections, setCompanyConnections] = useState<Array<{
    id: string;
    source_company_name: string;
    target_company_name: string;
    source_document_id?: string | null;
    target_document_id?: string | null;
    connection_type: "BD" | "INV" | "Knowledge" | "Partnership" | "Portfolio";
    connection_status: "To Connect" | "Connected" | "Rejected" | "In Progress" | "Completed";
    ai_reasoning?: string | null;
    notes?: string | null;
    created_at: string;
  }>>([]);
  const [logDecisionDialogOpen, setLogDecisionDialogOpen] = useState(false);
  const [pendingDecisionContext, setPendingDecisionContext] = useState<{
    aiReasoning: string;
    sourceDocIds?: string[];
  } | null>(null);
  
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
  const [documents, setDocuments] = useState<
    Array<{ id: string; title: string | null; storage_path: string | null; folder_id?: string | null }>
  >([]);

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
  const [sourceFolders, setSourceFolders] = useState<SourceFolder[]>([]);
  const [foldersExpanded, setFoldersExpanded] = useState(false);
  const [draftDecision, setDraftDecision] = useState<{
    startupName: string;
    sector?: string;
    stage?: string;
  } | null>(null);

  // Keep folder scopes in sync with source folders for Knowledge Scope
  useEffect(() => {
    setScopes((prev) => {
      const nonFolderScopes = prev.filter((scope) => scope.type !== "folder");
      const existingFolderChecks = new Map(
        prev
          .filter((scope) => scope.type === "folder")
          .map((scope) => [scope.id, scope.checked])
      );
      const folderScopes = sourceFolders.map((folder) => {
        const scopeId = `folder:${folder.id}`;
        return {
          id: scopeId,
          label: folder.name,
          checked: existingFolderChecks.get(scopeId) ?? false,
          type: "folder" as const,
        };
      });
      return [...nonFolderScopes, ...folderScopes];
    });
  }, [sourceFolders]);

  // Auto-expand folder list if any folder is selected
  useEffect(() => {
    if (scopes.some((scope) => scope.type === "folder" && scope.checked)) {
      setFoldersExpanded(true);
    }
  }, [scopes]);
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

  const handleCreateFolder = useCallback(
    async (name: string): Promise<SourceFolder | null> => {
      const eventId = activeEventId;
      if (!eventId) {
        toast({ title: "No active event", description: "Cannot create folder.", variant: "destructive" });
        return null;
      }
      const userId = user?.id || profile?.id || null;
      const { data, error } = await insertSourceFolder(eventId, {
        name,
        created_by: userId,
      });
      if (error || !data) {
        toast({ title: "Folder creation failed", description: error?.message || "Unknown error", variant: "destructive" });
        return null;
      }
      const folder = data as SourceFolder;
      setSourceFolders((prev) => [folder, ...prev]);
      return folder;
    },
    [activeEventId, profile, user, toast]
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

      const docRecord = doc as { id?: string; title?: string | null; storage_path?: string | null; folder_id?: string | null } | null;
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
        {
          id: docId,
          title: docRecord?.title || null,
          storage_path: docRecord?.storage_path || null,
          folder_id: docRecord?.folder_id || null,
        },
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

      const [decisionsRes, documentsRes, sourcesRes, foldersRes, connectionsRes] = await Promise.all([
        getDecisionsByEvent(event.id),
        getDocumentsByEvent(event.id),
        getSourcesByEvent(event.id),
        getSourceFoldersByEvent(event.id),
        getCompanyConnectionsByEvent(event.id),
      ]);
      if (cancelled) return;
      const mapped = (decisionsRes.data || []).map(mapDecisionRow);
      setDecisions(mapped);
      setDocuments(
        (documentsRes.data || []).map((doc: any) => ({
          id: doc.id,
          title: doc.title,
          storage_path: doc.storage_path || null,
          folder_id: doc.folder_id || null,
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
      // Load source folders
      setSourceFolders((foldersRes.data || []) as SourceFolder[]);
      
      // Load company connections for graph view
      setCompanyConnections((connectionsRes.data || []) as typeof companyConnections);

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
                    folder_id: newDoc.folder_id || null,
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
                        folder_id: updatedDoc.folder_id || null,
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
      isComprehensive: boolean = false,
      snippetOverride?: string | null
    ) => {
      if (snippetOverride?.trim()) {
        const limit = isComprehensive ? 2500 : 1000;
        const trimmed = snippetOverride.trim();
        return trimmed.length > limit ? `${trimmed.slice(0, limit)}…` : trimmed;
      }

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
            const { error, data } = await supabase.from("chat_messages").insert({
              event_id: eventId,
              thread_id: threadId,
              role: payload.role,
              content: payload.content,
              model: payload.model || null,
              source_doc_ids: payload.sourceDocIds || null,
              created_by: userId,
            }).select();
            if (!error) {
              console.log("[DEBUG] ✅ Saved chat message to DB:", { role: payload.role, contentLength: payload.content.length, threadId });
              return; // Success
            } else {
              console.error("[DEBUG] ❌ Failed to save chat message:", error);
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

  const chunkTextWithOverlap = useCallback((text: string, size: number, overlap: number) => {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(text.length, start + size);
      const chunk = text.slice(start, end).trim();
      if (chunk) {
        chunks.push(chunk);
      }
      if (end === text.length) break;
      start = Math.max(0, end - overlap);
    }
    return chunks;
  }, []);

  const buildParentChildChunks = useCallback(
    (text: string) => {
      const PARENT_SIZE = 2000;
      const PARENT_OVERLAP = 200;
      const CHILD_SIZE = 400;
      const CHILD_OVERLAP = 80;
      const MAX_PARENT_CHUNKS = 6;
      const MAX_CHILD_PER_PARENT = 3;

      const parents = chunkTextWithOverlap(text, PARENT_SIZE, PARENT_OVERLAP).slice(0, MAX_PARENT_CHUNKS);
      const pairs: Array<{ parentText: string; childText: string; parentIndex: number; childIndex: number }> = [];

      parents.forEach((parentText, parentIndex) => {
        const children = chunkTextWithOverlap(parentText, CHILD_SIZE, CHILD_OVERLAP).slice(0, MAX_CHILD_PER_PARENT);
        children.forEach((childText, childIndex) => {
          pairs.push({ parentText, childText, parentIndex, childIndex });
        });
      });

      return pairs;
    },
    [chunkTextWithOverlap]
  );

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

          const MAX_EMBED_CHARS = 8000;
          const truncated = rawContent.slice(0, MAX_EMBED_CHARS);
          const pairs = buildParentChildChunks(truncated);

          for (const pair of pairs) {
            try {
              const embedding = await embedQuery(pair.childText, "document");
              if (!embedding.length) continue;
              const { error } = await supabase.from("document_embeddings").insert({
                document_id: documentId,
                chunk_text: pair.childText,
                parent_text: pair.parentText,
                parent_index: pair.parentIndex,
                child_index: pair.childIndex,
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
    [buildParentChildChunks, disableEmbeddings]
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

  // Scroll to bottom when chat tab is first opened or when messages are loaded
  useEffect(() => {
    if (activeTab === "chat" && chatContainerRef.current) {
      // Scroll to bottom when tab opens or when messages change
      const container = chatContainerRef.current;
      // Use multiple timeouts to ensure DOM is fully rendered and messages are displayed
      const scrollToBottom = () => {
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      };
      // Immediate scroll
      scrollToBottom();
      // Delayed scrolls to catch any async rendering
      setTimeout(scrollToBottom, 50);
      setTimeout(scrollToBottom, 200);
      setTimeout(scrollToBottom, 500);
    }
  }, [activeTab, scopedMessages.length]);

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

  // Helper function to get thread messages (from state or DB)
  const getThreadMessages = useCallback(async (threadId: string, limit: number = 10): Promise<Array<{ role: "user" | "assistant"; content: string }>> => {
    // ALWAYS fetch from database to ensure we have the latest messages
    // State might be stale or missing recent messages
    let threadMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
    
    if (threadId) {
      try {
        const eventId = activeEventId || (await ensureActiveEventId());
        if (eventId) {
          const { data: dbMessages, error } = await supabase
            .from("chat_messages")
            .select("role, content, created_at")
            .eq("event_id", eventId)
            .eq("thread_id", threadId)
            .order("created_at", { ascending: true })
            .limit(limit);
          
          if (error) {
            console.error("[DEBUG] Error fetching chat history from DB:", error);
          } else if (dbMessages && dbMessages.length > 0) {
            threadMessages = dbMessages.map((m: any) => ({
              role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
              content: m.content || "",
            }));
            console.log("[DEBUG] ✅ Fetched chat history from DB:", threadMessages.length, "messages");
            console.log("[DEBUG] Sample messages:", threadMessages.slice(0, 3).map(m => ({ role: m.role, content: m.content.substring(0, 50) + "..." })));
          } else {
            console.log("[DEBUG] ⚠️ No messages found in DB for thread:", threadId);
          }
        }
      } catch (fetchError) {
        console.error("[DEBUG] ❌ Failed to fetch chat history from DB:", fetchError);
        // Fallback to state messages if DB fetch fails
        threadMessages = messages
          .filter((m) => m.threadId === threadId)
          .slice(-limit)
          .map((m) => ({
            role: (m.author === "assistant" ? "assistant" : "user") as "assistant" | "user",
            content: m.text,
          }));
        console.log("[DEBUG] Using state messages as fallback:", threadMessages.length, "messages");
      }
    }
    
    // If still no messages, try state as last resort
    if (threadMessages.length === 0) {
      threadMessages = messages
        .filter((m) => m.threadId === threadId)
        .slice(-limit)
        .map((m) => ({
          role: (m.author === "assistant" ? "assistant" : "user") as "assistant" | "user",
          content: m.text,
        }));
      console.log("[DEBUG] Using state messages (no DB messages):", threadMessages.length, "messages");
    }
    
    return threadMessages;
  }, [messages, activeEventId, ensureActiveEventId]);

  // ── Convert companyConnections state to the format expected by askClaudeAnswerStream ──
  const connectionsForChat: AskFundConnection[] = useMemo(() => {
    return companyConnections.map((c) => ({
      source_company_name: c.source_company_name,
      target_company_name: c.target_company_name,
      connection_type: c.connection_type,
      connection_status: c.connection_status,
      ai_reasoning: c.ai_reasoning ?? null,
      notes: c.notes ?? null,
    }));
  }, [companyConnections]);

  const askFund = useCallback(
    async (question: string, threadId: string) => {
      if (!scopes.some((s) => s.checked)) {
        createAssistantMessage("Select at least one scope to search fund memory.", threadId);
        return;
      }

      const eventId = activeEventId || (await ensureActiveEventId());
      if (!eventId) {
        createAssistantMessage("I can't access documents yet. Please try again in a moment.", threadId);
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
          "Search is taking too long. Please try a more specific query.",
          threadId
        );
      }, 20000);
      searchTimeoutId = searchTimeoutId_temp;
      const myDocsSelected = scopes.find((s) => s.id === "my-docs")?.checked ?? false;
      const teamDocsSelected = scopes.find((s) => s.id === "team-docs")?.checked ?? false;
      const currentUserId = profile?.id || user?.id || null;
      const selectedFolderIds = scopes
        .filter((s) => s.type === "folder" && s.checked)
        .map((s) => s.id.replace("folder:", ""));

      const filterDocsByFolderScope = async <T extends { id: string; folder_id?: string | null }>(
        docList: T[]
      ): Promise<T[]> => {
        if (selectedFolderIds.length === 0 || docList.length === 0) return docList;
        const docIds = docList.map((doc) => doc.id);
        try {
          // Check document_folder_links table
          const { data: links } = await supabase
            .from("document_folder_links")
            .select("document_id, folder_id")
            .in("document_id", docIds)
            .in("folder_id", selectedFolderIds);
          const allowed = new Set((links || []).map((row: any) => row.document_id));
          
          // Also check if document's direct folder_id matches any selected folder
          const filtered = docList.filter(
            (doc) =>
              allowed.has(doc.id) ||
              (doc.folder_id && selectedFolderIds.includes(doc.folder_id))
          );
          
          console.log("[DEBUG] Folder scope filter:", {
            totalDocs: docList.length,
            selectedFolders: selectedFolderIds,
            linkedDocs: allowed.size,
            afterFilter: filtered.length,
            droppedDocs: docList.length - filtered.length,
          });
          
          // IMPORTANT: If folder filter removes ALL documents, return the original list
          // This prevents the case where a document IS in the folder but the link table
          // is out of sync. Better to show too many results than none.
          if (filtered.length === 0 && docList.length > 0) {
            console.warn("[DEBUG] Folder scope filter removed ALL docs — returning unfiltered to avoid empty results");
            return docList;
          }
          
          return filtered;
        } catch (err) {
          console.warn("Folder scope filter failed:", err);
          return docList;
        }
      };
      
      // REWRITE QUERY BEFORE SEARCHING (ChatGPT-style "Condense" step)
      // Use backend LLM-based rewriting for robust pronoun resolution
      let searchQuestion = question;
      
      // Get thread messages (from state or DB)
      const threadMessages = await getThreadMessages(threadId, 10); // Get more messages for better context
      
      console.log("[DEBUG] ========== QUERY REWRITING ==========");
      console.log("[DEBUG] Original question:", question);
      console.log("[DEBUG] Thread messages count:", threadMessages.length);
      if (threadMessages.length > 0) {
        console.log("[DEBUG] Last few messages:", threadMessages.slice(-3).map(m => ({ role: m.role, content: m.content.substring(0, 100) })));
      }
      
      // Use backend LLM rewriting if we have chat history and the question might need rewriting
      const qLower = question.toLowerCase();
      const hasPronouns = /\b(it|its|him|his|her|she|they|them|their|this|that|these|those)\b/i.test(question);
      const hasVaguePattern = /\b(tell me more|tell me all|what about|and what|how about|what else|tell more|more about|more details|more info|more complete|more comprehensive|more profound|give more|give more info|expand|elaborate|all you know|everything|full|complete|comprehensive|detailed)\b/i.test(qLower);
      const followUpCueInQuestion = /\b(what about|and what|tell me|more about|more info|more complete|more comprehensive|more profound|give more|give more info|elaborate|explain|requirements|responsibilities|limitations|cannot|can't|couldn't|allowed|forbidden|answer|profound|comprehensive|detail|full|complete|detailed)\b/i.test(qLower);
      const isShort = question.split(/\s+/).length <= 15;
      
      // CRITICAL: Extract names from chat history for fallback pronoun replacement
      const extractNamesFromHistory = (msgs: Array<{ role: string; content: string }>): string[] => {
        const allText = msgs.map(m => m.content).join(" ");
        // Find "FirstName LastName" patterns
        const namePattern = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g;
        const names = allText.match(namePattern) || [];
        return [...new Set(names)]; // Unique names
      };
      
      const namesInHistory = extractNamesFromHistory(threadMessages);
      console.log("[DEBUG] Names found in chat history:", namesInHistory);
      
      if ((hasPronouns || hasVaguePattern || isShort) && threadMessages.length > 0) {
        try {
          // Call backend LLM to rewrite the query (much more robust than frontend heuristics)
          searchQuestion = await rewriteQueryWithLLM(question, threadMessages);
          console.log("[DEBUG] LLM rewritten query:", searchQuestion);
          
          // VALIDATION: If original had pronouns but rewritten doesn't contain any name from history, force fix it
          if (hasPronouns && namesInHistory.length > 0) {
            const rewrittenLower = searchQuestion.toLowerCase();
            const hasNameInRewritten = namesInHistory.some(name => rewrittenLower.includes(name.toLowerCase()));
            if (!hasNameInRewritten) {
              console.log("[DEBUG] ⚠️ LLM rewrite didn't include name from history, using fallback");
              // Use the most recent name from history
              const mostRecentName = namesInHistory[namesInHistory.length - 1];
              searchQuestion = question;
              for (const pronoun of ["him", "her", "it", "they", "them", "his", "her", "their", "this", "that"]) {
                const regex = new RegExp(`\\b${pronoun}\\b`, "gi");
                searchQuestion = searchQuestion.replace(regex, mostRecentName);
              }
              console.log("[DEBUG] Fallback rewritten query:", searchQuestion);
            }
          }
          // If the question is a vague follow-up without pronouns, inject the most recent name
          if (!hasPronouns && namesInHistory.length > 0 && (hasVaguePattern || followUpCueInQuestion)) {
            const mostRecentName = namesInHistory[namesInHistory.length - 1];
            const rewrittenLower = searchQuestion.toLowerCase();
            if (!rewrittenLower.includes(mostRecentName.toLowerCase())) {
              searchQuestion = `${searchQuestion} about ${mostRecentName}`.replace(/\s+/g, " ").trim();
              console.log("[DEBUG] Injected name into vague follow-up:", searchQuestion);
            }
          }
        } catch (rewriteError) {
          console.warn("[DEBUG] Query rewriting failed:", rewriteError);
          // FALLBACK: If we have pronouns and names in history, replace pronouns with the most recent name
          if (hasPronouns && namesInHistory.length > 0) {
            const mostRecentName = namesInHistory[namesInHistory.length - 1];
            console.log("[DEBUG] Using fallback: replacing pronouns with", mostRecentName);
            searchQuestion = question;
            for (const pronoun of ["him", "her", "it", "they", "them", "his", "her", "their", "this", "that"]) {
              const regex = new RegExp(`\\b${pronoun}\\b`, "gi");
              searchQuestion = searchQuestion.replace(regex, mostRecentName);
            }
            console.log("[DEBUG] Fallback rewritten query:", searchQuestion);
          } else {
            searchQuestion = question;
          }
        }
      } else if ((hasPronouns || hasVaguePattern || followUpCueInQuestion) && namesInHistory.length > 0) {
        // Even if no LLM rewriting triggered, still resolve pronouns if we have names
        const mostRecentName = namesInHistory[namesInHistory.length - 1];
        console.log("[DEBUG] Resolving follow-up without LLM using:", mostRecentName);
        for (const pronoun of ["him", "her", "it", "they", "them", "his", "her", "their", "this", "that"]) {
          const regex = new RegExp(`\\b${pronoun}\\b`, "gi");
          searchQuestion = searchQuestion.replace(regex, mostRecentName);
        }
        // If no pronouns were present, append subject to the query
        if (!hasPronouns && !searchQuestion.toLowerCase().includes(mostRecentName.toLowerCase())) {
          searchQuestion = `${searchQuestion} about ${mostRecentName}`.replace(/\s+/g, " ").trim();
        }
        console.log("[DEBUG] Pronoun-resolved query:", searchQuestion);
      }
      
      console.log("[DEBUG] Final search question:", searchQuestion);
      console.log("[DEBUG] ======================================");
      
      // PHASE 1: Extract proper nouns (names) BEFORE cleaning to preserve them
      const extractProperNouns = (text: string): string[] => {
        // Find capitalized words (potential names)
        const pattern = /\b[A-Z][a-z]+\b/g;
        const matches = text.match(pattern) || [];
        const commonCaps = new Set(['The', 'A', 'An', 'And', 'Or', 'But', 'In', 'On', 'At', 'To', 'For', 'Of', 'With', 'By']);
        return matches.filter(m => !commonCaps.has(m) && m.length > 2);
      };
      
      const properNouns = extractProperNouns(searchQuestion);
      const properNounsLower = properNouns.map(pn => pn.toLowerCase());
      
      // Detect if query contains names (Phase 1) - IMPROVED for typo tolerance
      const detectNameInQuery = (query: string): [boolean, string[]] => {
        const nouns = extractProperNouns(query);
        // Pattern for "FirstName LastName" - capital letters at start
        const namePattern = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g;
        const nameMatches = (query.match(namePattern) || []).map(m => m.trim());
        
        // Also detect potential names with typos - capitalized words of 4+ letters
        const potentialNames = /\b[A-Z][a-z]{3,}\b/g;
        const potentialMatches = (query.match(potentialNames) || []).filter(m => 
          !['What', 'Where', 'When', 'Which', 'About', 'Tell', 'Give', 'Find', 'Search', 'Show', 'Explain', 'Describe', 'More', 'Complete', 'Comprehensive'].includes(m)
        );
        
        // Check for common name-like patterns even without capitals (handles "george goloborodkin" in lowercase)
        const lowerQuery = query.toLowerCase();
        const hasNameLikeWords = /\b[a-z]{4,}\s+[a-z]{6,}\b/.test(lowerQuery); // First + Last name pattern
        
        const allNames = Array.from(new Set([...nouns, ...nameMatches, ...potentialMatches]));
        
        // If query looks like a "who is X" or "tell me about X" pattern, assume it's a name query
        const isNameQuery = allNames.length > 0 || 
          /\b(who is|about|tell me about|search for)\s+\w{4,}/i.test(query) ||
          hasNameLikeWords;
        
        console.log("[DEBUG] Name detection:", { nouns, nameMatches, potentialMatches, allNames, hasNameLikeWords, isNameQuery });
        return [isNameQuery, allNames];
      };
      
      const [hasName, detectedNames] = detectNameInQuery(searchQuestion);
      
      // QUERY CLEANING: Remove instruction words to focus on entities/keywords
      // PRESERVES proper nouns (Phase 1)
      const instructionWords = [
        "summarize", "summarise", "tell me about", "tell me", "find", "search for",
        "what is", "what are", "what does", "explain", "describe", "show me",
        "get", "fetch", "retrieve", "give me", "provide", "list", "show",
      ];
      let cleanedSearchQuery = searchQuestion;
      for (const instruction of instructionWords) {
        const regex = new RegExp(`\\b${instruction}\\b`, "gi");
        cleanedSearchQuery = cleanedSearchQuery.replace(regex, "");
      }
      // Clean up extra spaces
      cleanedSearchQuery = cleanedSearchQuery.replace(/\s+/g, " ").trim();
      
      // Ensure proper nouns are preserved (Phase 1)
      if (properNouns.length > 0) {
        const cleanedLower = cleanedSearchQuery.toLowerCase();
        for (const pn of properNouns) {
          if (!cleanedLower.includes(pn.toLowerCase())) {
            cleanedSearchQuery = `${pn} ${cleanedSearchQuery}`.trim();
          }
        }
      }
      
      // Use cleaned query if it's not empty, otherwise use original
      const finalSearchQuery = cleanedSearchQuery || searchQuestion;
      
      // PHASE 2: Query intent classification
      const classifyQueryIntent = (query: string): string => {
        const qLower = query.toLowerCase();
        if (/\b(find|search|locate|get|fetch|retrieve|show me)\b/.test(qLower)) return "FIND";
        if (/\b(summarize|summarise|summary|overview|brief|sum up)\b/.test(qLower)) return "SUMMARIZE";
        if (/\b(explain|why|how does|how do|what is|what are)\b/.test(qLower)) return "EXPLAIN";
        if (/\b(compare|difference|versus|vs|contrast)\b/.test(qLower)) return "COMPARE";
        return "FIND"; // Default
      };
      
      const queryIntent = classifyQueryIntent(question);
      
      const normalizedQuestion = finalSearchQuery.toLowerCase();
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
      const followUpHasPronoun = /\b(it|its|they|them|their|he|him|his|she|her|hers|there|that|those|these)\b/i.test(normalizedQuestion);
      const isFollowUpQuery = (() => {
        const q = normalizedQuestion;
        const isShort = q.split(/\s+/).length <= 15; // Increased from 12
        return (followUpHasPronoun || followUpCueInQuestion) && isShort;
      })();
      let docs: Array<{
        id: string;
        title: string | null;
        file_name: string | null;
        raw_content: string | null;
        extracted_json?: Record<string, any> | null;
        created_at: string;
        storage_path: string | null;
        folder_id?: string | null;
      }> = [];
      const snippetByDocId = new Map<string, string>();
      let error: { message?: string } | null = null;
      let semanticFailed = false;
      let semanticMatches: Array<{ document_id: string; similarity: number; chunk_text?: string | null; parent_text?: string | null }> = [];
      let keywordMatches: Array<{ document_id: string; rank: number; snippet?: string | null }> = [];

      const canSemantic = tokens.length >= 1;

      if (canSemantic) {
        try {
          // Add timeout to embedding query (15s max)
          // Use cleaned query (without instruction words) for embedding
          let embedding: number[] | null = null;
          try {
            const embeddingPromise = embedQuery(finalSearchQuery, "query");
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
          console.log("[DEBUG] Embedding generated:", { length: embedding?.length || 0 });
          if (embedding && embedding.length > 0) {
            const { data: matches, error: matchError } = await supabase.rpc("match_document_chunks", {
              query_embedding: embedding,
              match_count: 30,
              filter_event_id: eventId,
            });
            if (timedOut) return;
            console.log("[DEBUG] Semantic search results:", { 
              matchCount: matches?.length || 0, 
              matchError: matchError?.message || null,
              topSimilarities: matches?.slice(0, 5).map((m: any) => ({ docId: m.document_id, similarity: m.similarity })) || []
            });
            if (!matchError && matches?.length) {
              // PHASE 1: Lower similarity threshold for name queries (0.3 instead of 0.5)
              // CRITICAL FIX: If hasName, use even lower threshold (0.15) to catch typos
              const SIMILARITY_THRESHOLD = hasName ? 0.15 : 0.35;
              console.log("[DEBUG] Filtering with threshold:", { hasName, SIMILARITY_THRESHOLD, detectedNames });
              semanticMatches = (matches as typeof semanticMatches).filter(
                (m) => m.similarity >= SIMILARITY_THRESHOLD
              );
              console.log("[DEBUG] After threshold filter:", { remaining: semanticMatches.length });
              semanticMatches.forEach((m) => {
                if (m.parent_text?.trim()) {
                  snippetByDocId.set(m.document_id, m.parent_text);
                } else if (m.chunk_text?.trim()) {
                  snippetByDocId.set(m.document_id, m.chunk_text);
                }
              });
            }
          } else {
            console.log("[DEBUG] ⚠️ No embedding generated - semantic search skipped");
          }
        } catch (err) {
          // Semantic search failed - silently fall back to full-text search
          semanticFailed = true;
          console.log("[DEBUG] ⚠️ Semantic search error:", err instanceof Error ? err.message : String(err));
        }
      }

      if (!docs.length && !error) {
        // Hybrid search: keyword + semantic (RRF)
        // Use cleaned query (without instruction words) for keyword search
        const keywordQueryText = finalSearchQuery.replace(/[^\w\s-]/g, " ").trim();
        console.log("[DEBUG] Keyword search query:", keywordQueryText);
        if (keywordQueryText.length > 1) {
          try {
            const { data: keywordRows, error: keywordError } = await supabase.rpc("match_documents_keyword", {
              query_text: keywordQueryText,
              match_count: 30,
              filter_event_id: eventId,
            });
            if (timedOut) return;
            console.log("[DEBUG] Keyword search results:", { 
              matchCount: keywordRows?.length || 0, 
              keywordError: keywordError?.message || null,
              topRanks: keywordRows?.slice(0, 5).map((m: any) => ({ docId: m.document_id, rank: m.rank })) || []
            });
            if (!keywordError && keywordRows?.length) {
              keywordMatches = keywordRows as typeof keywordMatches;
              keywordMatches.forEach((m) => {
                if (!snippetByDocId.has(m.document_id) && m.snippet?.trim()) {
                  snippetByDocId.set(m.document_id, m.snippet);
                }
              });
            }
          } catch (keywordErr) {
            // Ignore keyword errors; fall back below
            console.log("[DEBUG] ⚠️ Keyword search error:", keywordErr instanceof Error ? keywordErr.message : String(keywordErr));
          }
        }
        
        // CRITICAL FIX: Direct title/filename search for name queries
        // PostgreSQL full-text search is bad at proper nouns, so search directly
        if (hasName && (semanticMatches.length === 0 || keywordMatches.length === 0)) {
          console.log("[DEBUG] 🔍 Trying direct title/filename search for names:", detectedNames);
          try {
            // Build OR conditions for each detected name (and each word in names)
            const searchTerms = new Set<string>();
            detectedNames.forEach(name => {
              searchTerms.add(name.toLowerCase());
              name.split(/\s+/).forEach(part => {
                if (part.length > 3) searchTerms.add(part.toLowerCase());
              });
            });
            // Also add words from finalSearchQuery that look like names
            finalSearchQuery.split(/\s+/).forEach(word => {
              if (word.length > 4 && /^[A-Za-z]+$/.test(word)) {
                searchTerms.add(word.toLowerCase());
              }
            });
            
            console.log("[DEBUG] Direct search terms:", Array.from(searchTerms));
            
            // Query documents directly using ILIKE for fuzzy matching
            const { data: titleMatches, error: titleError } = await supabase
              .from("documents")
              .select("id,title,file_name,raw_content,extracted_json,created_at,storage_path,created_by")
              .eq("event_id", eventId)
              .limit(30);
            
            if (!titleError && titleMatches?.length) {
              // Filter documents that contain any of our search terms in title, filename, or content
              const directMatches = titleMatches.filter((doc: any) => {
                const titleText = `${doc.title || ""} ${doc.file_name || ""}`.toLowerCase();
                const contentText = (doc.raw_content || "").toLowerCase().substring(0, 5000); // Check first 5k chars
                const fullText = `${titleText} ${contentText}`;
                return Array.from(searchTerms).some(term => fullText.includes(term));
              });
              
              console.log("[DEBUG] Direct title/content search found:", directMatches.length, "documents");
              
              // Add these to keyword matches if not already there
              directMatches.forEach((doc: any) => {
                if (!keywordMatches.some(m => m.document_id === doc.id)) {
                  keywordMatches.push({
                    document_id: doc.id,
                    rank: 0.5, // Medium rank
                    snippet: (doc.raw_content || "").substring(0, 200)
                  });
                }
              });
            }
          } catch (directErr) {
            console.log("[DEBUG] Direct search error:", directErr instanceof Error ? directErr.message : String(directErr));
          }
        }

        const RRF_K = 60;
        const scoreMap = new Map<string, number>();
        semanticMatches.forEach((m, idx) => {
          const score = 1 / (RRF_K + idx + 1);
          scoreMap.set(m.document_id, (scoreMap.get(m.document_id) || 0) + score);
        });
        keywordMatches.forEach((m, idx) => {
          const score = 1 / (RRF_K + idx + 1);
          scoreMap.set(m.document_id, (scoreMap.get(m.document_id) || 0) + score);
        });

        const rankedIds = Array.from(scoreMap.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([id]) => id)
          .slice(0, 20);
        
        console.log("[DEBUG] RRF results:", { 
          semanticMatchCount: semanticMatches.length, 
          keywordMatchCount: keywordMatches.length, 
          rankedIdsCount: rankedIds.length 
        });

        // CRITICAL FALLBACK: If all searches fail but it's a name query, try direct document query
        if (rankedIds.length === 0 && hasName) {
          console.log("[DEBUG] 🆘 All searches failed for name query - trying DIRECT document query");
          try {
            // Query ALL documents for this event and filter manually
            let fallbackQuery = supabase
              .from("documents")
              .select("id,title,file_name,raw_content,extracted_json,created_at,storage_path,created_by")
              .eq("event_id", eventId)
              .limit(100);
            
            if (myDocsSelected && !teamDocsSelected && currentUserId) {
              fallbackQuery = fallbackQuery.eq("created_by", currentUserId);
            } else if (!myDocsSelected && teamDocsSelected && currentUserId) {
              fallbackQuery = fallbackQuery.neq("created_by", currentUserId);
            }
            
            const { data: allDocs, error: fallbackError } = await fallbackQuery;
            
            if (!fallbackError && allDocs?.length) {
              console.log("[DEBUG] Fallback: Got", allDocs.length, "documents to scan");
              
              // Filter documents that contain any name or query token
              const searchTermsLower = new Set<string>();
              detectedNames.forEach(name => {
                searchTermsLower.add(name.toLowerCase());
                name.split(/\s+/).forEach(part => {
                  if (part.length > 3) searchTermsLower.add(part.toLowerCase());
                });
              });
              contentTokens.forEach(token => {
                if (token.length > 3) searchTermsLower.add(token);
              });
              
              const matchedDocs = allDocs.filter((doc: any) => {
                const fullText = `${doc.title || ""} ${doc.file_name || ""} ${doc.raw_content || ""}`.toLowerCase();
                return Array.from(searchTermsLower).some(term => fullText.includes(term));
              });
              
              console.log("[DEBUG] Fallback: Matched", matchedDocs.length, "documents by text search");
              
              if (matchedDocs.length > 0) {
                docs = matchedDocs.slice(0, 10);
              }
            }
          } catch (fallbackErr) {
            console.log("[DEBUG] Fallback query error:", fallbackErr);
          }
        }

        if (rankedIds.length > 0) {
          let docQuery = supabase
            .from("documents")
            .select("id,title,file_name,raw_content,extracted_json,created_at,storage_path,created_by,folder_id")
            .in("id", rankedIds);
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
            let fetchedDocs = rankedIds.map((id) => docMap.get(id)).filter(Boolean);
            
            // PHASE 2: Document title boosting - boost documents where query terms appear in title
            const titleBoost = (docTitle: string | null, docFileName: string | null): number => {
              if (!docTitle && !docFileName) return 0;
              const titleText = `${docTitle || ""} ${docFileName || ""}`.toLowerCase();
              const queryLower = finalSearchQuery.toLowerCase();
              const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
              let boost = 0;
              for (const word of queryWords) {
                if (titleText.includes(word)) {
                  boost += 0.5; // Boost for each matching word in title
                }
              }
              // Extra boost if name appears in title
              if (hasName && detectedNames.length > 0) {
                for (const name of detectedNames) {
                  if (titleText.includes(name.toLowerCase())) {
                    boost += 1.0; // Strong boost for name in title
                  }
                }
              }
              return boost;
            };
            
            // PHASE 1: Fuzzy name matching - check if document names match query names with typos
            const fuzzyMatchName = (queryName: string, docName: string, maxDistance: number = 2): boolean => {
              const queryLower = queryName.toLowerCase().trim();
              const docLower = docName.toLowerCase().trim();
              
              // Exact match
              if (queryLower === docLower) return true;
              
              // Contains match
              if (queryLower.includes(docLower) || docLower.includes(queryLower)) return true;
              
              // Levenshtein distance (simple version)
              const distance = (s1: string, s2: string): number => {
                if (s1.length === 0) return s2.length;
                if (s2.length === 0) return s1.length;
                const matrix: number[][] = [];
                for (let i = 0; i <= s2.length; i++) {
                  matrix[i] = [i];
                }
                for (let j = 0; j <= s1.length; j++) {
                  matrix[0][j] = j;
                }
                for (let i = 1; i <= s2.length; i++) {
                  for (let j = 1; j <= s1.length; j++) {
                    if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
                      matrix[i][j] = matrix[i - 1][j - 1];
                    } else {
                      matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                      );
                    }
                  }
                }
                return matrix[s2.length][s1.length];
              };
              
              const dist = distance(queryLower, docLower);
              const maxAllowed = Math.min(maxDistance, Math.floor(queryLower.length / 3));
              return dist <= maxAllowed;
            };
            
            // Apply fuzzy matching and title boosting
            if (hasName && detectedNames.length > 0) {
              fetchedDocs = fetchedDocs.map(doc => {
                let boost = titleBoost(doc.title, doc.file_name);
                // Check if any detected name fuzzy matches document title/content
                const docText = `${doc.title || ""} ${doc.file_name || ""} ${doc.raw_content || ""}`.toLowerCase();
                for (const name of detectedNames) {
                  const nameParts = name.split(/\s+/);
                  for (const part of nameParts) {
                    if (part.length > 3) { // Only check significant name parts
                      // Check title
                      if (doc.title && fuzzyMatchName(part, doc.title)) {
                        boost += 1.5; // Strong boost for fuzzy name match in title
                      }
                      // Check filename
                      if (doc.file_name && fuzzyMatchName(part, doc.file_name)) {
                        boost += 1.5;
                      }
                      // Check content (weaker boost)
                      if (doc.raw_content && doc.raw_content.toLowerCase().includes(part.toLowerCase())) {
                        boost += 0.3;
                      }
                    }
                  }
                }
                return { ...doc, _boost: boost };
              });
              
              // Re-sort by boost + original score
              fetchedDocs.sort((a, b) => {
                const boostA = (a as any)._boost || 0;
                const boostB = (b as any)._boost || 0;
                return boostB - boostA;
              });
              
              // Remove boost property
              docs = fetchedDocs.map(({ _boost, ...doc }) => doc);
            } else {
              // Just apply title boosting without fuzzy matching
              fetchedDocs = fetchedDocs.map(doc => {
                const boost = titleBoost(doc.title, doc.file_name);
                return { ...doc, _boost: boost };
              });
              fetchedDocs.sort((a, b) => {
                const boostA = (a as any)._boost || 0;
                const boostB = (b as any)._boost || 0;
                return boostB - boostA;
              });
              docs = fetchedDocs.map(({ _boost, ...doc }) => doc);
            }
          }
        }
      }

      if (!docs.length && !error) {
        // More aggressive search: try multiple search strategies
        // First, try full-text search with the question
        let responseQuery = supabase
          .from("documents")
          .select("id,title,file_name,raw_content,extracted_json,created_at,storage_path,created_by,folder_id")
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
                .select("id,title,file_name,raw_content,extracted_json,created_at,storage_path,created_by,folder_id")
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
            .select("id,title,file_name,raw_content,extracted_json,created_at,storage_path,created_by,folder_id")
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

      if (selectedFolderIds.length > 0 && docs.length > 0) {
        docs = await filterDocsByFolderScope(docs);
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
      // CRITICAL: For name queries, be VERY lenient - names are the signal
      const minTokenMatches = hasName 
        ? 1 // Name queries: just 1 token match is enough
        : contentTokens.length <= 2
          ? 1
          : Math.max(2, Math.ceil(contentTokens.length * 0.6));
      
      console.log("[DEBUG] Content filtering:", { 
        contentTokens, 
        minTokenMatches, 
        hasName,
        docsBeforeFilter: docs?.length || 0
      });
      
      const filteredDocs = (docs || []).filter((doc) => {
        if (!contentTokens.length && !hasName) return false; // No tokens = no match (unless name query)
        
        // For name queries with no tokens but detected names, check directly
        if (hasName && contentTokens.length === 0 && detectedNames.length > 0) {
          const haystack = `${doc.title || ""} ${doc.file_name || ""} ${doc.raw_content || ""}`.toLowerCase();
          return detectedNames.some(name => haystack.includes(name.toLowerCase()));
        }
        
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
        
        // For name queries, also check if detected names appear in doc
        const hasNameMatch = hasName && detectedNames.some(name => {
          const nameLower = name.toLowerCase();
          const nameParts = nameLower.split(/\s+/);
          // Match if full name OR any part of name (first/last) appears
          return haystack.includes(nameLower) || 
            nameParts.some(part => part.length > 3 && haystack.includes(part));
        });
        
        return matches >= minTokenMatches || hasStrongMatch || hasNameMatch;
      });
      
      console.log("[DEBUG] After content filtering:", { 
        filteredDocsCount: filteredDocs.length,
        filteredDocTitles: filteredDocs.map(d => d.title || d.file_name).slice(0, 5)
      });

      let rankedDocs = filteredDocs;
      if (rankedDocs.length > 1) {
        try {
          const rerankPayload = rankedDocs.map((doc) => {
            const snippet = snippetByDocId.get(doc.id);
            const baseText = snippet || buildNormalizedDocText(doc) || "";
            return {
              id: doc.id,
              text: baseText.slice(0, 1500),
            };
          });
          const rerankResults = await rerankDocuments({
            query: question,
            documents: rerankPayload,
            topN: Math.min(10, rerankPayload.length),
          });
          if (rerankResults.length > 0) {
            // Filter by reranking score threshold (0.1 = minimum relevance)
            // Cohere scores are typically 0-1, but can be negative for very poor matches
            const RERANK_SCORE_THRESHOLD = 0.1;
            const filteredRerankResults = rerankResults.filter(
              (r) => r.score >= RERANK_SCORE_THRESHOLD
            );
            if (filteredRerankResults.length > 0) {
              const docMap = new Map(rankedDocs.map((d) => [d.id, d]));
              const reranked = filteredRerankResults.map((r) => docMap.get(r.id)).filter(Boolean);
              rankedDocs = reranked as typeof rankedDocs;
            } else {
              // If all reranked results are below threshold, keep original order but limit to top 3
              rankedDocs = rankedDocs.slice(0, 3);
            }
          }
        } catch (rerankErr) {
          // If rerank fails, keep existing order
        }
      }

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
      
      // ── CONNECTION-INTENT DETECTION ──
      // When user asks about connections, partnerships, or "who to connect with",
      // we need to send ALL portfolio context so Claude knows what companies exist.
      const isConnectionIntent = (() => {
        const q = normalizedQuestion;
        return /\b(connect|connected|connection|connections|partner|partnership|partnerships|introduce|introduction|link|linked|linking|network|networking|relationship|relationships|relate|who.*help|help.*them|could.*connect|should.*connect|could.*partner|suggest.*compan|recommend.*compan|match.*with|pair.*with|synerg|collaborate|collaboration)\b/i.test(q);
      })();

      // For meta-questions, answer even without sources
      if (isMetaQuestion && (!rankedDocs || rankedDocs.length === 0)) {
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
          // Get thread messages for context (from state or DB)
          const threadMessages = await getThreadMessages(threadId, 10);
          
          await askClaudeAnswerStream(
            {
              question,
              sources: [],
              decisions: [],
              connections: connectionsForChat,
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

      // CRITICAL: If this is a pronoun-based follow-up, reuse previous evidence directly.
      // This avoids searching for "him" and failing to find new docs.
      if (
        isFollowUpQuery &&
        followUpHasPronoun &&
        previousEvidence &&
        previousEvidence.docs.length > 0 &&
        previousEvidenceThreadId === threadId
      ) {
        console.log("[DEBUG] ✅ Using previous evidence for pronoun follow-up (skip new search)");
        const maxDocs = isComprehensiveQuestion ? 5 : 3;
        const answerDocs = previousEvidence.docs.slice(0, maxDocs);
        setLastEvidence({ question: searchQuestion, docs: answerDocs, decisions: decisionMatches });
        setLastEvidenceThreadId(threadId);
        setChatIsLoading(false);
        if (searchTimeoutId !== null) {
          window.clearTimeout(searchTimeoutId);
        }
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
          const claudeTokens = searchQuestion
            .toLowerCase()
            .split(/\W+/)
            .map((t) => t.trim())
            .filter((t) => t.length > 3);
          const sources = answerDocs.map((doc) => ({
            title: doc.title,
            file_name: doc.file_name,
            snippet: buildClaudeContext(doc, claudeTokens, isComprehensiveQuestion, snippetByDocId.get(doc.id)),
          }));
          const decisionsForClaude = decisionIntent
            ? decisionMatches.map((d) => ({
                startup_name: d.startupName,
                action_type: d.actionType,
                outcome: d.outcome ?? null,
                notes: d.notes ?? null,
              }))
            : [];
          const threadMessages = await getThreadMessages(threadId, 10);
          await askClaudeAnswerStream(
            {
              question: searchQuestion,
              sources,
              decisions: decisionsForClaude,
              connections: connectionsForChat,
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

      const lowSignalFollowUp =
        isFollowUpQuery && contentTokens.length <= 1;

      console.log("[DEBUG] Follow-up detection:", {
        isFollowUpQuery,
        hasRankedDocs: rankedDocs?.length > 0,
        hasPreviousEvidence: !!previousEvidence,
        previousEvidenceDocsCount: previousEvidence?.docs?.length,
        sameThread: previousEvidenceThreadId === threadId,
        lowSignalFollowUp,
      });

      if (!rankedDocs || rankedDocs.length === 0 || lowSignalFollowUp) {
        // CRITICAL: If search fails but we have context (pronouns OR follow-up cues), use previous evidence
        // Be MORE lenient here - if user is asking for "more info/complete/profound", use previous docs
        const hasPronounInQuestion = /\b(him|her|it|they|them|his|hers|their|this|that)\b/i.test(question);
        const hasFollowupCueInOriginal = /\b(more about|more info|more complete|more comprehensive|more profound|give more|give more info|tell me more|elaborate|explain|full|complete|comprehensive|detailed)\b/i.test(question.toLowerCase());
        const shouldUsePreviousEvidence = (
          (isFollowUpQuery || hasPronounInQuestion || hasFollowupCueInOriginal) &&
          previousEvidence &&
          previousEvidence.docs.length > 0
          // Removed: && previousEvidenceThreadId === threadId (too strict!)
        );
        
        console.log("[DEBUG] Should use previous evidence:", {
          isFollowUpQuery,
          hasPronounInQuestion,
          hasFollowupCueInOriginal,
          hasPreviousEvidence: !!previousEvidence,
          previousEvidenceDocsCount: previousEvidence?.docs?.length,
          shouldUsePreviousEvidence,
        });
        
        if (shouldUsePreviousEvidence) {
          console.log("[DEBUG] ✅ Using previous evidence for follow-up query");
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
              snippet: buildClaudeContext(doc, claudeTokens, isComprehensiveQuestion, snippetByDocId.get(doc.id)),
            }));
            const decisionsForClaude = decisionIntent
              ? decisionMatches.map((d) => ({
                  startup_name: d.startupName,
                  action_type: d.actionType,
                  outcome: d.outcome ?? null,
                  notes: d.notes ?? null,
                }))
              : [];
            
            // Get previous messages from this thread for context (from state or DB)
            const threadMessages = await getThreadMessages(threadId, 10);
            
            await askClaudeAnswerStream(
              {
                question,
                sources,
                decisions: decisionsForClaude,
                connections: connectionsForChat,
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
        // FALLBACK: If we have chat history and the question has pronouns, try to answer from context
        // This is a last resort - Claude can reference previous conversation even without new sources
        const hasPronounInOriginal = /\b(him|her|it|they|them|his|hers|their|this|that)\b/i.test(question);
        const threadMessagesForFallback = await getThreadMessages(threadId, 10);
        
        if (hasPronounInOriginal && threadMessagesForFallback.length > 0) {
          console.log("[DEBUG] ✅ Fallback: Calling Claude with chat history only (no new sources)");
          if (searchTimeoutId !== null) {
            window.clearTimeout(searchTimeoutId);
          }
          setChatIsLoading(false);
          setIsClaudeLoading(true);
          const streamer = createStreamingAssistantMessage(threadId);
          let streamCompleted = false;
          const streamTimeout = setTimeout(() => {
            if (!streamCompleted) {
              console.error("Fallback stream timeout");
              streamer.setError("Request timed out. Please try again.");
              setIsClaudeLoading(false);
            }
          }, 75000);
          try {
            await askClaudeAnswerStream(
              {
                question,
                sources: [], // No sources, but chat history should help
                decisions: [],
                connections: connectionsForChat,
                previousMessages: threadMessagesForFallback,
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
                  streamer.setError(error.message || "Failed to answer. Please try again.");
                  setIsClaudeLoading(false);
                }
              }
            );
            if (!streamCompleted) {
              streamCompleted = true;
              clearTimeout(streamTimeout);
              streamer.finalize();
            }
          } catch (err) {
            streamCompleted = true;
            clearTimeout(streamTimeout);
            streamer.setError(err instanceof Error ? err.message : "Failed to answer. Please try again.");
          } finally {
            setIsClaudeLoading(false);
          }
          return;
        }
        
        // Show searchQuestion (rewritten) if different from original, for better debugging
        const queryToShow = searchQuestion !== question ? `${searchQuestion} (original: ${question})` : question;
        // If we have decision matches, show them
        if (decisionIntent && decisionMatches.length) {
          const fallback = `${formatDecisionMatches(decisionMatches)}\n\nIf you want deeper answers, upload or link supporting documents in the Sources tab.`;
          if (searchTimeoutId !== null) {
            window.clearTimeout(searchTimeoutId);
          }
          createAssistantMessage(fallback, threadId);
          setLastEvidence(null);
          setChatIsLoading(false);
          return;
        }

        // NO DOCUMENTS FOUND — but instead of showing an error, forward to Claude
        // so it can still answer general questions, greetings, or use conversation context.
        // This fixes the problem where "hello" or document-specific questions get blocked.
        console.log("[DEBUG] No docs found, forwarding to Claude for general answer");
        console.log("[DEBUG] isConnectionIntent:", isConnectionIntent, "| documents count:", documents.length);
        
        if (searchTimeoutId !== null) {
          window.clearTimeout(searchTimeoutId);
        }
        
        // ── CONNECTION-INTENT: Build portfolio context from ALL documents ──
        // When user asks about connections/partnerships, send all doc titles
        // so Claude knows what companies are in the portfolio even though
        // the search didn't match the specific company name.
        let portfolioSources: Array<{ title: string | null; file_name: string | null; snippet: string | null }> = [];
        if (isConnectionIntent && documents.length > 0) {
          console.log("[DEBUG] 🔗 Connection-intent detected — injecting full portfolio context");
          portfolioSources = documents.slice(0, 15).map((doc) => ({
            title: doc.title || "Untitled",
            file_name: null,
            snippet: `[Portfolio company/document: ${doc.title || "Untitled"}]`,
          }));
        }
        
        // Set evidence (even with empty docs) and call Claude directly
        setLastEvidence({ question, docs: [], decisions: decisionMatches });
        setLastEvidenceThreadId(threadId);
        setChatIsLoading(false);
        setIsClaudeLoading(true);
        
        // Create streaming message
        const streamer = createStreamingAssistantMessage(threadId, []);
        let fullAnswer = "";
        let streamCompleted = false;
        
        const streamTimeout = setTimeout(() => {
          if (!streamCompleted) {
            console.error("Stream timeout - no response after 75 seconds");
            streamer.setError("Request timed out. The response is taking too long. Please try again with a simpler question.");
            setIsClaudeLoading(false);
          }
        }, 75000);
        
        try {
          // Get previous messages from this thread for context
          const threadMessages = await getThreadMessages(threadId, 10);
          
          // Call Claude with portfolio context for connection-intent, or empty sources otherwise
          await askClaudeAnswerStream(
            {
              question,
              sources: portfolioSources.length > 0 ? portfolioSources : [],
              decisions: decisionIntent
                ? decisionMatches.map((d) => ({
                    startup_name: d.startupName,
                    action_type: d.actionType,
                    outcome: d.outcome ?? null,
                    notes: d.notes ?? null,
                  }))
                : [],
              connections: connectionsForChat,
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
          
          if (!streamCompleted && fullAnswer.length > 0) {
            streamCompleted = true;
            clearTimeout(streamTimeout);
            streamer.finalize();
          } else if (!streamCompleted) {
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
          streamer.setError(errorMsg);
          setIsClaudeLoading(false);
        }
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
      const answerDocs = rankedDocs.slice(0, maxDocs);
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
        let sources = docsForClaude.map((doc) => ({
          title: doc.title,
          file_name: doc.file_name,
          snippet: buildClaudeContext(doc, claudeTokens, isComprehensiveQuestion, snippetByDocId.get(doc.id)),
        }));
        
        // ── CONNECTION-INTENT: Inject additional portfolio context ──
        // When user asks about connections, also include titles of OTHER docs
        // not already in sources so Claude knows the full portfolio.
        if (isConnectionIntent) {
          const existingDocIds = new Set(docsForClaude.map((d) => d.id));
          const extraPortfolio = documents
            .filter((d) => !existingDocIds.has(d.id))
            .slice(0, 10)
            .map((doc) => ({
              title: doc.title || "Untitled",
              file_name: null as string | null,
              snippet: `[Portfolio company/document: ${doc.title || "Untitled"}]`,
            }));
          if (extraPortfolio.length > 0) {
            sources = [...sources, ...extraPortfolio];
            console.log("[DEBUG] 🔗 Connection-intent: injected", extraPortfolio.length, "extra portfolio docs");
          }
        }
        const decisionsForClaude = decisionIntent
          ? decisionMatches.map((d) => ({
              startup_name: d.startupName,
              action_type: d.actionType,
              outcome: d.outcome ?? null,
              notes: d.notes ?? null,
            }))
          : [];
        
        // Get previous messages from this thread for context (from state or DB)
        const threadMessages = await getThreadMessages(threadId, 10);
        
        // Debug logging
        console.log("[DEBUG] Sending to backend:", {
          question,
          threadMessagesCount: threadMessages.length,
          threadMessages: threadMessages.map(m => ({ role: m.role, content: m.content.substring(0, 50) + "..." }))
        });
        
        await askClaudeAnswerStream(
          {
            question,
            sources,
            decisions: decisionsForClaude,
            connections: connectionsForChat,
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
      connectionsForChat,
      documents,
      persistCostLog,
      getThreadMessages,
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

  // Handler to open Log Decision dialog after AI response
  const handleLogDecisionFromChat = useCallback((aiReasoning: string, sourceDocIds?: string[]) => {
    setPendingDecisionContext({ aiReasoning, sourceDocIds });
    setLogDecisionDialogOpen(true);
  }, []);

  // Handler to create a company connection
  const handleCreateConnection = useCallback(async (connectionData: {
    source_company_name: string;
    target_company_name: string;
    source_document_id?: string | null;
    target_document_id?: string | null;
    connection_type: ConnectionType;
    connection_status: ConnectionStatus;
    ai_reasoning?: string | null;
    notes?: string | null;
  }) => {
    const eventId = activeEventId;
    if (!eventId) {
      toast({
        title: "No active event",
        description: "Please wait for the event to load.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await insertCompanyConnection(eventId, {
        ...connectionData,
        created_by: profile?.id || null,
      });

      if (error) throw error;

      // Add to local state
      if (data) {
        setCompanyConnections((prev) => [data as typeof prev[0], ...prev]);
      }

      toast({
        title: "Connection logged",
        description: `Created ${connectionData.connection_type} connection: ${connectionData.source_company_name} → ${connectionData.target_company_name}`,
      });

      setLogDecisionDialogOpen(false);
      setPendingDecisionContext(null);
    } catch (err) {
      console.error("Failed to create connection:", err);
      toast({
        title: "Failed to log decision",
        description: err instanceof Error ? err.message : "Could not create connection.",
        variant: "destructive",
      });
    }
  }, [activeEventId, profile?.id, toast]);

  // Handler to update connection status
  const handleUpdateConnectionStatus = useCallback(async (
    connectionId: string, 
    newStatus: ConnectionStatus
  ) => {
    try {
      const { error } = await updateCompanyConnection(connectionId, { connection_status: newStatus });
      if (error) throw error;

      setCompanyConnections((prev) =>
        prev.map((c) => c.id === connectionId ? { ...c, connection_status: newStatus } : c)
      );

      toast({
        title: "Status updated",
        description: `Connection status changed to "${newStatus}"`,
      });
    } catch (err) {
      console.error("Failed to update connection:", err);
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Could not update status.",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Handler: AI-powered connection suggestions
  const [aiSuggestions, setAiSuggestions] = useState<Array<{
    source_company: string;
    target_company: string;
    connection_type: string;
    reasoning: string;
    confidence: number;
  }>>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const handleSuggestConnections = useCallback(async () => {
    setSuggestionsLoading(true);
    try {
      // Build sources from documents
      const docSources = documents.slice(0, 10).map((doc) => ({
        title: doc.title,
        file_name: null as string | null,
        snippet: null as string | null, // The backend will use titles for context
      }));

      const result = await suggestConnections({
        sources: docSources,
        existingConnections: connectionsForChat,
        maxSuggestions: 5,
      });

      setAiSuggestions(result.suggestions);

      if (result.suggestions.length === 0) {
        toast({
          title: "No suggestions",
          description: result.contextSummary || "Upload more documents to get AI suggestions.",
        });
      } else {
        toast({
          title: `${result.suggestions.length} connection(s) suggested`,
          description: result.contextSummary || "Review and add them to your graph.",
        });
      }
    } catch (err) {
      console.error("Suggest connections failed:", err);
      toast({
        title: "Suggestion failed",
        description: err instanceof Error ? err.message : "Could not generate suggestions.",
        variant: "destructive",
      });
    } finally {
      setSuggestionsLoading(false);
    }
  }, [documents, connectionsForChat, toast]);

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
    // ── Inline markdown renderer ──
    // Converts **bold**, *italic*, `code`, [n] references into React elements
    const renderInline = (raw: string, keyPrefix: string = ""): React.ReactNode[] => {
      const parts: React.ReactNode[] = [];
      // Regex: bold+italic (***), bold (**), italic (*), code (`), source ref [n]
      const inlineRegex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[(\d+)\])/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      let i = 0;
      while ((match = inlineRegex.exec(raw)) !== null) {
        // Text before the match
        if (match.index > lastIndex) {
          parts.push(<span key={`${keyPrefix}t${i}`}>{raw.slice(lastIndex, match.index)}</span>);
        }
        if (match[2]) {
          // ***bold italic***
          parts.push(<strong key={`${keyPrefix}bi${i}`} className="font-bold italic text-[#FFED00]">{match[2]}</strong>);
        } else if (match[3]) {
          // **bold**
          parts.push(<strong key={`${keyPrefix}b${i}`} className="font-bold text-[#FFED00]">{match[3]}</strong>);
        } else if (match[4]) {
          // *italic*
          parts.push(<em key={`${keyPrefix}i${i}`} className="italic text-white/90">{match[4]}</em>);
        } else if (match[5]) {
          // `code`
          parts.push(<code key={`${keyPrefix}c${i}`} className="bg-white/10 px-1.5 py-0.5 rounded text-xs text-[#FFED00] font-mono">{match[5]}</code>);
        } else if (match[6]) {
          // [1] source reference
          parts.push(<span key={`${keyPrefix}r${i}`} className="inline-flex items-center justify-center bg-[#FFED00]/20 text-[#FFED00] text-[10px] font-bold rounded-full w-4 h-4 mx-0.5 align-text-top">{match[6]}</span>);
        }
        lastIndex = match.index + match[0].length;
        i++;
      }
      if (lastIndex < raw.length) {
        parts.push(<span key={`${keyPrefix}end`}>{raw.slice(lastIndex)}</span>);
      }
      return parts.length > 0 ? parts : [<span key={`${keyPrefix}plain`}>{raw}</span>];
    };

    const lines = text.split("\n");
    type Block =
      | { type: "h1"; content: string }
      | { type: "h2"; content: string }
      | { type: "h3"; content: string }
      | { type: "p"; content: string }
      | { type: "ul"; items: string[] }
      | { type: "ol"; items: string[] }
      | { type: "hr" }
      | { type: "blank" };

    const blocks: Block[] = [];
    let ulItems: string[] = [];
    let olItems: string[] = [];
    let paragraph: string[] = [];

    const flushParagraph = () => {
      if (paragraph.length) {
        blocks.push({ type: "p", content: paragraph.join(" ") });
        paragraph = [];
      }
    };
    const flushUl = () => {
      if (ulItems.length) {
        blocks.push({ type: "ul", items: [...ulItems] });
        ulItems = [];
      }
    };
    const flushOl = () => {
      if (olItems.length) {
        blocks.push({ type: "ol", items: [...olItems] });
        olItems = [];
      }
    };
    const flushAll = () => { flushParagraph(); flushUl(); flushOl(); };

    for (const raw of lines) {
      const line = raw.trimEnd();
      const trimmed = line.trim();

      // Blank line
      if (!trimmed) { flushAll(); continue; }

      // Horizontal rule
      if (/^(---+|\*\*\*+|___+)$/.test(trimmed)) { flushAll(); blocks.push({ type: "hr" }); continue; }

      // Headings: ## or ###
      const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
      if (headingMatch) {
        flushAll();
        const level = headingMatch[1].length;
        const content = headingMatch[2].replace(/\s*#+$/, ""); // strip trailing #
        if (level === 1) blocks.push({ type: "h1", content });
        else if (level === 2) blocks.push({ type: "h2", content });
        else blocks.push({ type: "h3", content });
        continue;
      }

      // Unordered list: - item or * item
      if (/^[-*]\s+/.test(trimmed)) {
        flushParagraph(); flushOl();
        ulItems.push(trimmed.replace(/^[-*]\s+/, ""));
        continue;
      }

      // Ordered list: 1. item, 2. item
      if (/^\d+[.)]\s+/.test(trimmed)) {
        flushParagraph(); flushUl();
        olItems.push(trimmed.replace(/^\d+[.)]\s+/, ""));
        continue;
      }

      // Lines ending with ":" that are short → treat as sub-heading
      if (trimmed.endsWith(":") && trimmed.length < 80 && !trimmed.startsWith("http")) {
        flushAll();
        blocks.push({ type: "h3", content: trimmed.replace(/:$/, "") });
        continue;
      }

      // Normal paragraph text
      flushUl(); flushOl();
      paragraph.push(trimmed);
    }
    flushAll();

    return (
      <div className="space-y-3">
        {blocks.map((block, idx) => {
          switch (block.type) {
            case "h1":
              return (
                <h2 key={idx} className="text-base font-bold text-[#FFED00] font-mono mt-3 mb-1 border-b border-white/20 pb-1">
                  {renderInline(block.content, `h1-${idx}-`)}
                </h2>
              );
            case "h2":
              return (
                <h3 key={idx} className="text-sm font-bold text-[#FFED00] font-mono mt-3 mb-1">
                  {renderInline(block.content, `h2-${idx}-`)}
                </h3>
              );
            case "h3":
              return (
                <h4 key={idx} className="text-sm font-semibold text-white/90 font-mono mt-2 mb-0.5">
                  {renderInline(block.content, `h3-${idx}-`)}
                </h4>
              );
            case "ul":
              return (
                <ul key={idx} className="list-disc pl-5 text-sm text-white space-y-1.5">
                  {block.items.map((item, i) => (
                    <li key={i} className="text-white leading-relaxed">{renderInline(item, `ul-${idx}-${i}-`)}</li>
                  ))}
                </ul>
              );
            case "ol":
              return (
                <ol key={idx} className="list-decimal pl-5 text-sm text-white space-y-1.5">
                  {block.items.map((item, i) => (
                    <li key={i} className="text-white leading-relaxed">{renderInline(item, `ol-${idx}-${i}-`)}</li>
                  ))}
                </ol>
              );
            case "hr":
              return <hr key={idx} className="border-white/20 my-3" />;
            case "p":
              return (
                <p key={idx} className="text-sm text-white leading-relaxed">
                  {renderInline(block.content, `p-${idx}-`)}
                </p>
              );
            default:
              return null;
          }
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
            {/* Chat Threads - Only show in chat tab, positioned between Knowledge Scope and Navigation */}
            {activeTab === "chat" && (
              <div className="border-2 border-white bg-transparent p-4 sticky top-4">
                <div className="text-xs text-white/70 font-mono font-bold uppercase tracking-wider mb-4 pb-2 border-b border-white/30">
                  Chat Threads
                </div>
                <div className="space-y-3">
                  <Button
                    onClick={async () => {
                      const newThreadId = await createChatThread(`Chat ${threads.length + 1}`, null);
                      if (newThreadId) {
                        setActiveThread(newThreadId);
                        setMessages([]);
                        // Reload threads to show the new one
                        const eventId = activeEventId || (await ensureActiveEventId());
                        if (eventId) {
                          const { data: threadRows } = await supabase
                            .from("chat_threads")
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
                          }
                        }
                      }
                    }}
                    className="w-full border-2 border-[#FFED00] bg-[#FFED00] text-black hover:bg-[#FFED00]/80 hover:border-[#FFED00] font-bold font-mono text-sm transition-all hover:shadow-[0_0_20px_rgba(255,237,0,0.5)]"
                  >
                    <MessageSquarePlus className="h-4 w-4 mr-2" />
                    Create New Chat
                  </Button>
                  {threads.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto">
                      <ThreadTree
                        threads={threads}
                        active={activeThread}
                        onSelect={(id) => {
                          setActiveThread(id);
                          setMessages([]);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-white/50 font-mono text-center py-4">
                      No threads yet
                    </div>
                  )}
                </div>
              </div>
            )}

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
                onClick={() => setActiveTab("connections")}
                className={`w-full flex items-center gap-2 px-3 py-2 border-2 transition-all font-mono font-bold text-sm ${
                  activeTab === "connections"
                    ? "bg-[#FFED00] text-black border-[#FFED00]"
                    : "bg-transparent text-white border-white hover:border-[#FFED00] hover:bg-[#FFED00]/5"
                }`}
              >
                <Link2 className="h-4 w-4" />
                Connections Graph
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
                  {scopes.filter((s) => s.type !== "folder").map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm border-2 border-white px-2 py-1.5 rounded-md cursor-pointer hover:bg-[#FFED00]/5 hover:border-[#FFED00] transition-colors text-white font-mono">
                      <Checkbox checked={s.checked} onCheckedChange={(val) => toggleScope(s.id, val === true)} className="border-white data-[state=checked]:bg-[#FFED00] data-[state=checked]:border-[#FFED00]" />
                      <span className="flex-1 text-xs">{s.label}</span>
                      <Badge variant="outline" className="text-xs border-white text-white bg-transparent font-mono">
                        {s.type}
                      </Badge>
                    </label>
                  ))}
                  {scopes.some((s) => s.type === "folder") && (
                    <div className="border-2 border-white/60 rounded-md">
                      <button
                        type="button"
                        onClick={() => setFoldersExpanded((prev) => !prev)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-white font-mono font-bold uppercase tracking-wider hover:bg-[#FFED00]/5 transition-colors"
                      >
                        <Folder className="h-4 w-4 text-[#FFED00]" />
                        <span className="flex-1 text-left">Folders</span>
                        <Badge variant="outline" className="text-[10px] border-white/60 text-white/80 bg-transparent font-mono">
                          {scopes.filter((s) => s.type === "folder").length}
                        </Badge>
                        <ChevronDown className={`h-4 w-4 transition-transform ${foldersExpanded ? "rotate-180" : ""}`} />
                      </button>
                      {foldersExpanded && (
                        <div className="space-y-2 px-2 pb-2">
                          {scopes.filter((s) => s.type === "folder").map((s) => (
                            <label key={s.id} className="flex items-center gap-2 text-xs border border-white/40 px-2 py-1.5 rounded-md cursor-pointer hover:bg-[#FFED00]/5 hover:border-[#FFED00] transition-colors text-white font-mono">
                              <Checkbox checked={s.checked} onCheckedChange={(val) => toggleScope(s.id, val === true)} className="border-white data-[state=checked]:bg-[#FFED00] data-[state=checked]:border-[#FFED00]" />
                              <Folder className="h-3 w-3 text-white/70" />
                              <span className="flex-1">{s.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
                                  <>
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
                                    {/* Log Decision button - appears after each AI response */}
                                    {!m.isStreaming && m.text && m.text !== "..." && (
                                      <div className="mt-2 pt-2 border-t border-white/20">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleLogDecisionFromChat(m.text)}
                                          className="text-xs h-6 px-2 text-white/70 hover:text-[#FFED00] hover:bg-white/5 font-mono"
                                        >
                                          <Link2 className="h-3 w-3 mr-1" />
                                          Log Decision
                                        </Button>
                                      </div>
                                    )}
                                  </>
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
              sourceFolders={sourceFolders}
              onCreateSource={handleCreateSource}
              onCreateFolder={handleCreateFolder}
              onDeleteSource={handleDeleteSource}
              getGoogleAccessToken={getGoogleAccessToken}
              onAutoLogDecision={handleAutoLogDecision}
              onDocumentSaved={(doc) =>
                setDocuments((prev) => [
                  { id: doc.id, title: doc.title, storage_path: doc.storage_path, folder_id: doc.folder_id },
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

          {/* Connections Graph Tab */}
          <TabsContent value="connections">
            <ConnectionsGraphTab
              connections={companyConnections}
              documents={documents}
              onUpdateStatus={handleUpdateConnectionStatus}
              onAddConnection={() => setLogDecisionDialogOpen(true)}
              onSuggestConnections={handleSuggestConnections}
            />
            {/* AI Suggested Connections */}
            {(suggestionsLoading || aiSuggestions.length > 0) && (
              <Card className="mt-4 border-2 border-[#6366f1] bg-transparent">
                <CardHeader className="pb-2 border-b-2 border-[#6366f1]">
                  <CardTitle className="text-sm font-mono font-black uppercase tracking-tight text-[#6366f1] flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    AI-Suggested Connections
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {suggestionsLoading ? (
                    <div className="flex items-center justify-center py-6 gap-2 text-white/70 font-mono">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Analyzing documents for connections...
                    </div>
                  ) : (
                    aiSuggestions.map((s, idx) => (
                      <div
                        key={idx}
                        className="p-3 border-2 border-white/20 rounded-md hover:border-[#6366f1] transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-white font-mono font-bold">
                              <span>{s.source_company}</span>
                              <span className="text-white/50">→</span>
                              <span>{s.target_company}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs border-[#6366f1] text-[#6366f1] bg-transparent font-mono">
                                {s.connection_type}
                              </Badge>
                              <span className="text-xs text-white/50 font-mono">
                                {Math.round(s.confidence * 100)}% confidence
                              </span>
                            </div>
                            <p className="text-xs text-white/60 font-mono mt-2">{s.reasoning}</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              setPendingDecisionContext({
                                aiReasoning: s.reasoning,
                              });
                              setLogDecisionDialogOpen(true);
                            }}
                            className="bg-[#6366f1] text-white hover:bg-[#6366f1]/80 font-bold text-xs"
                          >
                            + Add
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )}
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

      {/* Log Decision Dialog - Create company connections from chat */}
      <Dialog open={logDecisionDialogOpen} onOpenChange={setLogDecisionDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-[#050505] border-2 border-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white font-mono font-black uppercase">
              <Link2 className="h-5 w-5 text-[#FFED00]" />
              Log Decision / Connection
            </DialogTitle>
            <DialogDescription className="text-white/70 font-mono">
              Record a connection between two companies based on AI insight
            </DialogDescription>
          </DialogHeader>

          <LogDecisionForm
            documents={documents}
            pendingContext={pendingDecisionContext}
            onSubmit={handleCreateConnection}
            onCancel={() => {
              setLogDecisionDialogOpen(false);
              setPendingDecisionContext(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Log Decision Form Component
function LogDecisionForm({
  documents,
  pendingContext,
  onSubmit,
  onCancel,
}: {
  documents: Array<{ id: string; title: string | null; storage_path: string | null }>;
  pendingContext: { aiReasoning: string; sourceDocIds?: string[] } | null;
  onSubmit: (data: {
    source_company_name: string;
    target_company_name: string;
    source_document_id?: string | null;
    target_document_id?: string | null;
    connection_type: ConnectionType;
    connection_status: ConnectionStatus;
    ai_reasoning?: string | null;
    notes?: string | null;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [sourceCompany, setSourceCompany] = useState("");
  const [targetCompany, setTargetCompany] = useState("");
  const [sourceDocId, setSourceDocId] = useState<string>("none");
  const [targetDocId, setTargetDocId] = useState<string>("none");
  const [connectionType, setConnectionType] = useState<ConnectionType>("BD");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("To Connect");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extract company names from AI reasoning
  useEffect(() => {
    if (pendingContext?.aiReasoning) {
      // Try to extract company names from the reasoning
      const companyPatterns = [
        /([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+(?:would be|could be|should|might|can)\s+(?:useful|helpful|good|great)\s+(?:to\s+)?(?:connect|partner|work)\s+with\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i,
        /suggest(?:s|ing)?\s+(?:that\s+)?([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+(?:and|with)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i,
        /connect(?:ing)?\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+(?:to|with)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i,
      ];
      
      for (const pattern of companyPatterns) {
        const match = pendingContext.aiReasoning.match(pattern);
        if (match) {
          setSourceCompany(match[1] || "");
          setTargetCompany(match[2] || "");
          break;
        }
      }
    }
  }, [pendingContext?.aiReasoning]);

  const handleSubmit = async () => {
    if (!sourceCompany.trim() || !targetCompany.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        source_company_name: sourceCompany.trim(),
        target_company_name: targetCompany.trim(),
        source_document_id: sourceDocId === "none" ? null : sourceDocId,
        target_document_id: targetDocId === "none" ? null : targetDocId,
        connection_type: connectionType,
        connection_status: connectionStatus,
        ai_reasoning: pendingContext?.aiReasoning || null,
        notes: notes.trim() || null,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-white font-mono font-bold">Source Company</Label>
          <Input
            value={sourceCompany}
            onChange={(e) => setSourceCompany(e.target.value)}
            placeholder="e.g., Ridelink"
            className="border-2 border-white bg-transparent text-white placeholder:text-white/50 font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-white font-mono font-bold">Target Company</Label>
          <Input
            value={targetCompany}
            onChange={(e) => setTargetCompany(e.target.value)}
            placeholder="e.g., Weego"
            className="border-2 border-white bg-transparent text-white placeholder:text-white/50 font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-white font-mono font-bold">Source Document (optional)</Label>
          <Select value={sourceDocId} onValueChange={setSourceDocId}>
            <SelectTrigger className="border-2 border-white bg-transparent text-white font-mono">
              <SelectValue placeholder="Link to document..." />
            </SelectTrigger>
            <SelectContent className="bg-[#050505] border-2 border-white">
              <SelectItem value="none" className="text-white font-mono">None</SelectItem>
              {documents.map((doc) => (
                <SelectItem key={doc.id} value={doc.id} className="text-white font-mono">
                  {doc.title || "Untitled"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-white font-mono font-bold">Target Document (optional)</Label>
          <Select value={targetDocId} onValueChange={setTargetDocId}>
            <SelectTrigger className="border-2 border-white bg-transparent text-white font-mono">
              <SelectValue placeholder="Link to document..." />
            </SelectTrigger>
            <SelectContent className="bg-[#050505] border-2 border-white">
              <SelectItem value="none" className="text-white font-mono">None</SelectItem>
              {documents.filter((d) => d.id !== sourceDocId || sourceDocId === "none").map((doc) => (
                <SelectItem key={doc.id} value={doc.id} className="text-white font-mono">
                  {doc.title || "Untitled"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-white font-mono font-bold">Connection Type</Label>
          <Select value={connectionType} onValueChange={(v) => setConnectionType(v as ConnectionType)}>
            <SelectTrigger className="border-2 border-white bg-transparent text-white font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#050505] border-2 border-white">
              <SelectItem value="BD" className="text-white font-mono">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  BD (Business Dev)
                </span>
              </SelectItem>
              <SelectItem value="INV" className="text-white font-mono">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  INV (Investment)
                </span>
              </SelectItem>
              <SelectItem value="Knowledge" className="text-white font-mono">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  Knowledge
                </span>
              </SelectItem>
              <SelectItem value="Partnership" className="text-white font-mono">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  Partnership
                </span>
              </SelectItem>
              <SelectItem value="Portfolio" className="text-white font-mono">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-500" />
                  Portfolio
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-white font-mono font-bold">Status</Label>
          <Select value={connectionStatus} onValueChange={(v) => setConnectionStatus(v as ConnectionStatus)}>
            <SelectTrigger className="border-2 border-white bg-transparent text-white font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#050505] border-2 border-white">
              <SelectItem value="To Connect" className="text-white font-mono">
                <span className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-yellow-500" />
                  To Connect
                </span>
              </SelectItem>
              <SelectItem value="In Progress" className="text-white font-mono">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 text-blue-500" />
                  In Progress
                </span>
              </SelectItem>
              <SelectItem value="Connected" className="text-white font-mono">
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Connected
                </span>
              </SelectItem>
              <SelectItem value="Rejected" className="text-white font-mono">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                  Rejected
                </span>
              </SelectItem>
              <SelectItem value="Completed" className="text-white font-mono">
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-emerald-500" />
                  Completed
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-white font-mono font-bold">Additional Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any additional context..."
          className="border-2 border-white bg-transparent text-white placeholder:text-white/50 font-mono min-h-[80px]"
        />
      </div>

      {pendingContext?.aiReasoning && (
        <div className="space-y-2">
          <Label className="text-white font-mono font-bold text-xs">AI Context (will be saved)</Label>
          <div className="p-3 rounded-md bg-white/5 border border-white/20 max-h-[100px] overflow-y-auto">
            <p className="text-xs text-white/70 font-mono whitespace-pre-wrap line-clamp-4">
              {pendingContext.aiReasoning.substring(0, 500)}
              {pendingContext.aiReasoning.length > 500 && "..."}
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          onClick={onCancel}
          className="border-2 border-white bg-transparent text-white hover:bg-white/10 font-mono"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !sourceCompany.trim() || !targetCompany.trim()}
          className="bg-[#FFED00] text-black hover:bg-[#FFED00]/80 font-bold border-2 border-[#FFED00]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Link2 className="h-4 w-4 mr-2" />
              Log Connection
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Connections Graph Tab Component
const CONNECTION_TYPE_COLORS: Record<ConnectionType, string> = {
  BD: "#22c55e",        // green
  INV: "#f59e0b",       // amber
  Knowledge: "#6366f1", // indigo
  Partnership: "#a855f7", // purple
  Portfolio: "#06b6d4",  // cyan
};

const CONNECTION_STATUS_COLORS: Record<ConnectionStatus, string> = {
  "To Connect": "#eab308",  // yellow
  "In Progress": "#3b82f6", // blue
  Connected: "#22c55e",     // green
  Rejected: "#ef4444",      // red
  Completed: "#10b981",     // emerald
};

function ConnectionsGraphTab({
  connections,
  documents,
  onUpdateStatus,
  onAddConnection,
  onSuggestConnections,
}: {
  connections: Array<{
    id: string;
    source_company_name: string;
    target_company_name: string;
    source_document_id?: string | null;
    target_document_id?: string | null;
    connection_type: ConnectionType;
    connection_status: ConnectionStatus;
    ai_reasoning?: string | null;
    notes?: string | null;
    created_at: string;
  }>;
  documents: Array<{ id: string; title: string | null; storage_path: string | null }>;
  onUpdateStatus: (connectionId: string, newStatus: ConnectionStatus) => Promise<void>;
  onAddConnection: () => void;
  onSuggestConnections?: () => void;
}) {
  // Extract unique companies from connections
  const companies = useMemo(() => {
    const companySet = new Set<string>();
    connections.forEach((c) => {
      companySet.add(c.source_company_name);
      companySet.add(c.target_company_name);
    });
    return Array.from(companySet);
  }, [connections]);

  // Group connections by status
  const connectionsByStatus = useMemo(() => {
    return connections.reduce((acc, conn) => {
      if (!acc[conn.connection_status]) {
        acc[conn.connection_status] = [];
      }
      acc[conn.connection_status].push(conn);
      return acc;
    }, {} as Record<ConnectionStatus, typeof connections>);
  }, [connections]);

  return (
    <div className="space-y-6">
      {/* Header with Add Connection button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-mono font-black uppercase tracking-tight text-white">
            Company Connections
          </h2>
          <p className="text-sm text-white/70 font-mono mt-1">
            {connections.length} connections between {companies.length} companies
          </p>
        </div>
        <div className="flex gap-2">
          {onSuggestConnections && (
            <Button
              onClick={onSuggestConnections}
              variant="outline"
              className="border-2 border-[#6366f1] text-[#6366f1] hover:bg-[#6366f1]/10 font-bold"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              AI Suggest
            </Button>
          )}
          <Button
            onClick={onAddConnection}
            className="bg-[#FFED00] text-black hover:bg-[#FFED00]/80 font-bold border-2 border-[#FFED00]"
          >
            <Link2 className="h-4 w-4 mr-2" />
            Add Connection
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {(["To Connect", "In Progress", "Connected", "Rejected", "Completed"] as ConnectionStatus[]).map((status) => (
          <Card key={status} className="border-2 border-white bg-transparent">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: CONNECTION_STATUS_COLORS[status] }}
                />
                <span className="text-xs font-mono text-white/70">{status}</span>
              </div>
              <div className="text-2xl font-mono font-black text-white">
                {connectionsByStatus[status]?.length || 0}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Connection Type Legend */}
      <Card className="border-2 border-white bg-transparent">
        <CardHeader className="pb-2 border-b-2 border-white">
          <CardTitle className="text-sm font-mono font-black uppercase tracking-tight text-white">
            Connection Types
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            {(Object.entries(CONNECTION_TYPE_COLORS) as [ConnectionType, string][]).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2">
                <div className="w-4 h-1 rounded" style={{ backgroundColor: color }} />
                <span className="text-xs font-mono text-white">{type}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Visual Graph Placeholder */}
      <Card className="border-2 border-white bg-transparent">
        <CardHeader className="pb-2 border-b-2 border-white">
          <CardTitle className="text-sm font-mono font-black uppercase tracking-tight text-white">
            Network Graph
          </CardTitle>
          <CardDescription className="text-white/70 font-mono">
            Visual representation of company relationships
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {connections.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="text-center">
                <Link2 className="h-12 w-12 mx-auto mb-4 text-white/30" />
                <p className="text-white/70 font-mono">No connections yet</p>
                <p className="text-sm text-white/50 font-mono mt-1">
                  Log decisions from the chat to create connections
                </p>
              </div>
            </div>
          ) : (
            <div className="h-[400px] relative bg-white/5 rounded-lg overflow-hidden">
              {/* Simple SVG-based graph visualization */}
              <svg className="w-full h-full" viewBox="0 0 800 400">
                {/* Draw edges */}
                {connections.map((conn, idx) => {
                  const sourceIdx = companies.indexOf(conn.source_company_name);
                  const targetIdx = companies.indexOf(conn.target_company_name);
                  const sourceX = 100 + (sourceIdx % 4) * 180;
                  const sourceY = 80 + Math.floor(sourceIdx / 4) * 120;
                  const targetX = 100 + (targetIdx % 4) * 180;
                  const targetY = 80 + Math.floor(targetIdx / 4) * 120;
                  return (
                    <line
                      key={`edge-${idx}`}
                      x1={sourceX}
                      y1={sourceY}
                      x2={targetX}
                      y2={targetY}
                      stroke={CONNECTION_TYPE_COLORS[conn.connection_type]}
                      strokeWidth="2"
                      opacity="0.6"
                    />
                  );
                })}
                {/* Draw nodes */}
                {companies.map((company, idx) => {
                  const x = 100 + (idx % 4) * 180;
                  const y = 80 + Math.floor(idx / 4) * 120;
                  return (
                    <g key={`node-${idx}`}>
                      <circle
                        cx={x}
                        cy={y}
                        r="30"
                        fill="#050505"
                        stroke="#FFED00"
                        strokeWidth="2"
                      />
                      <text
                        x={x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize="10"
                        fontFamily="monospace"
                      >
                        {company.length > 12 ? company.substring(0, 10) + "..." : company}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connections List */}
      <Card className="border-2 border-white bg-transparent">
        <CardHeader className="pb-2 border-b-2 border-white">
          <CardTitle className="text-sm font-mono font-black uppercase tracking-tight text-white">
            All Connections
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          {connections.length === 0 ? (
            <div className="text-center py-8 text-white/70 font-mono">
              No connections logged yet
            </div>
          ) : (
            connections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center justify-between gap-4 p-3 border-2 border-white rounded-md hover:border-[#FFED00] hover:bg-[#FFED00]/5 transition-all"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="w-2 h-8 rounded"
                    style={{ backgroundColor: CONNECTION_TYPE_COLORS[conn.connection_type] }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-white font-mono font-bold">
                      <span>{conn.source_company_name}</span>
                      <span className="text-white/50">→</span>
                      <span>{conn.target_company_name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs border-white text-white bg-transparent font-mono">
                        {conn.connection_type}
                      </Badge>
                      {conn.ai_reasoning && (
                        <span className="text-xs text-white/50 font-mono truncate max-w-[200px]">
                          {conn.ai_reasoning.substring(0, 50)}...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={conn.connection_status}
                    onValueChange={(v) => onUpdateStatus(conn.id, v as ConnectionStatus)}
                  >
                    <SelectTrigger className="w-[140px] border-2 border-white bg-transparent text-white font-mono text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#050505] border-2 border-white">
                      {(["To Connect", "In Progress", "Connected", "Rejected", "Completed"] as ConnectionStatus[]).map((status) => (
                        <SelectItem key={status} value={status} className="text-white font-mono text-xs">
                          <span className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: CONNECTION_STATUS_COLORS[status] }}
                            />
                            {status}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
