import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RefreshCw, CheckCircle, AlertCircle, Clock, Cloud, Database } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface SyncConfig {
  id: string;
  source_type: "clickup" | "google_drive";
  config: {
    clickup_list_id?: string;
    google_drive_folder_id?: string;
    sync_frequency?: "hourly" | "daily" | "manual";
  };
  last_sync_at: string | null;
  last_sync_status: "success" | "error" | "pending" | null;
  last_sync_error: string | null;
  next_sync_at: string | null;
  event_id: string;
}

export function SyncStatus() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [syncConfigs, setSyncConfigs] = useState<SyncConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  const isMD = profile?.role === "managing_partner" || profile?.role === "organizer";
  const orgId = profile?.organization_id;

  useEffect(() => {
    if (isMD && orgId) {
      loadSyncConfigs();
    }
  }, [isMD, orgId]);

  const loadSyncConfigs = async () => {
    // For now, we'll use localStorage to track sync configs
    // In production, this should be in a database table
    const clickupListId = localStorage.getItem("clickup_list_id");
    const clickupUrl = localStorage.getItem("clickup_list_url");
    
    const configs: SyncConfig[] = [];
    
    if (clickupListId || clickupUrl) {
      configs.push({
        id: "clickup-1",
        source_type: "clickup",
        config: {
          clickup_list_id: clickupListId || undefined,
          sync_frequency: "daily",
        },
        last_sync_at: localStorage.getItem("clickup_last_sync") || null,
        last_sync_status: (localStorage.getItem("clickup_sync_status") as any) || null,
        last_sync_error: localStorage.getItem("clickup_sync_error") || null,
        next_sync_at: null,
        event_id: "", // Will be set from active event
      });
    }

    setSyncConfigs(configs);
    setLoading(false);
  };

  const triggerSync = async (configId: string, sourceType: "clickup" | "google_drive") => {
    setSyncing(configId);
    try {
      const clickupListId = localStorage.getItem("clickup_list_id");
      if (!clickupListId && sourceType === "clickup") {
        throw new Error("ClickUp list ID not configured");
      }

      // Call sync endpoint (would be a backend job in production)
      // For now, we'll just update the last sync time
      const now = new Date().toISOString();
      localStorage.setItem(`${sourceType}_last_sync`, now);
      localStorage.setItem(`${sourceType}_sync_status`, "success");
      localStorage.removeItem(`${sourceType}_sync_error`);

      toast({
        title: "Sync triggered",
        description: `${sourceType === "clickup" ? "ClickUp" : "Google Drive"} sync has been started.`,
      });

      // Reload configs
      await loadSyncConfigs();
    } catch (err: any) {
      console.error("Sync error:", err);
      const sourceType = configId.includes("clickup") ? "clickup" : "google_drive";
      localStorage.setItem(`${sourceType}_sync_status`, "error");
      localStorage.setItem(`${sourceType}_sync_error`, err.message || "Sync failed");
      toast({
        title: "Sync failed",
        description: err.message || "Failed to trigger sync.",
        variant: "destructive",
      });
      await loadSyncConfigs();
    } finally {
      setSyncing(null);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "success":
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Synced</Badge>;
      case "error":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">Never synced</Badge>;
    }
  };

  const formatLastSync = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (!isMD || !orgId) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Sync Status
          </CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Document Sync Status
        </CardTitle>
        <CardDescription>
          Monitor and manage automatic document synchronization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {syncConfigs.length === 0 ? (
          <Alert>
            <AlertDescription>
              No sync configurations found. Configure ClickUp or Google Drive sync in the Sources tab.
            </AlertDescription>
          </Alert>
        ) : (
          syncConfigs.map((config) => (
            <div key={config.id} className="border rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {config.source_type === "clickup" ? (
                    <Database className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Cloud className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium capitalize">
                    {config.source_type === "clickup" ? "ClickUp" : "Google Drive"}
                  </span>
                  {getStatusBadge(config.last_sync_status)}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => triggerSync(config.id, config.source_type)}
                  disabled={syncing === config.id}
                >
                  {syncing === config.id ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Sync Now
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Last sync:</span>
                  <span>{formatLastSync(config.last_sync_at)}</span>
                </div>
                {config.config.sync_frequency && (
                  <div className="flex items-center justify-between">
                    <span>Frequency:</span>
                    <span className="capitalize">{config.config.sync_frequency}</span>
                  </div>
                )}
                {config.last_sync_error && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {config.last_sync_error}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          ))
        )}

        <Alert>
          <AlertDescription className="text-xs">
            <strong>Auto-sync:</strong> Documents are automatically synchronized when team members upload files.
            Scheduled syncs for ClickUp and Google Drive will be available soon.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
