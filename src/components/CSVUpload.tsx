import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Download, FileText, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { parseStartupCSV, parseInvestorCSV, generateStartupCSVTemplate, generateInvestorCSVTemplate, downloadCSV } from "@/utils/csvUtils";
import { Startup, Investor } from "@/types";

interface CSVUploadProps {
  onStartupsImported: (startups: Startup[]) => void;
  onInvestorsImported: (investors: Investor[]) => void;
  onClose: () => void;
}

export function CSVUpload({ onStartupsImported, onInvestorsImported, onClose }: CSVUploadProps) {
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: 'startups' | 'investors'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setIsProcessing(true);

    try {
      const content = await file.text();
      
      if (type === 'startups') {
        const startups = parseStartupCSV(content);
        if (startups.length === 0) {
          throw new Error('No valid startup data found in CSV');
        }
        onStartupsImported(startups);
      } else {
        const investors = parseInvestorCSV(content);
        if (investors.length === 0) {
          throw new Error('No valid investor data found in CSV');
        }
        onInvestorsImported(investors);
      }
      
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process CSV file');
    } finally {
      setIsProcessing(false);
    }
  }, [onStartupsImported, onInvestorsImported, onClose]);

  const downloadTemplate = useCallback((type: 'startups' | 'investors') => {
    const template = type === 'startups' 
      ? generateStartupCSVTemplate() 
      : generateInvestorCSVTemplate();
    
    downloadCSV(template, `${type}_template.csv`);
  }, []);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Import Data from CSV
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="startups" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="startups">Startups</TabsTrigger>
            <TabsTrigger value="investors">Investors</TabsTrigger>
          </TabsList>
          
          <TabsContent value="startups" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Upload Startup Data</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadTemplate('startups')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="startup-csv">Select CSV file</Label>
                <Input
                  id="startup-csv"
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileUpload(e, 'startups')}
                  disabled={isProcessing}
                />
                <p className="text-sm text-muted-foreground">
                  CSV should include: company_name, geo_markets, industry, funding_target, funding_stage
                </p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="investors" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Upload Investor Data</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadTemplate('investors')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="investor-csv">Select CSV file</Label>
                <Input
                  id="investor-csv"
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileUpload(e, 'investors')}
                  disabled={isProcessing}
                />
                <p className="text-sm text-muted-foreground">
                  CSV should include: firm_name, geo_focus, industry_preferences, min_ticket_size, max_ticket_size, total_slots
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}