import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Download, FileText, AlertCircle, CheckCircle, Eye, X, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { generateStartupCSVTemplate, generateInvestorCSVTemplate, downloadCSV } from "@/utils/csvUtils";
import { smartConvertStartupCSV, smartConvertInvestorCSV, detectCSVType, detectMixedCSV, parseMixedCSV } from "@/utils/smartCsvConverter";
import { convertWithOllama, convertFileWithOllama, checkOllamaHealth } from "@/utils/ollamaConverter";
import { Startup, Investor, Mentor, CorporatePartner } from "@/types";

interface CSVUploadProps {
  onStartupsImported: (startups: Startup[]) => void;
  onInvestorsImported: (investors: Investor[]) => void;
  onMentorsImported: (mentors: Mentor[]) => void;
  onCorporatesImported: (corporates: CorporatePartner[]) => void;
  onClose: () => void;
}

export function CSVUpload({ onStartupsImported, onInvestorsImported, onMentorsImported, onCorporatesImported, onClose }: CSVUploadProps) {
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ollamaAvailable, setOllamaAvailable] = useState<boolean | null>(null);
  const [previewData, setPreviewData] = useState<{
    type: 'startups' | 'investors' | 'mentors' | 'corporates' | 'mixed';
    data: Array<Startup | Investor | Mentor | CorporatePartner>;
    startups?: Startup[];
    investors?: Investor[];
    mentors?: Mentor[];
    corporates?: CorporatePartner[];
    mappings: Array<{ originalName: string; mappedField: string; confidence: number }>;
    warnings: string[];
    errors: string[];
    stats: { totalRows: number; validRows: number; skippedRows: number };
    confidence?: number;
  } | null>(null);

  // Check Ollama availability on mount
  useEffect(() => {
    checkOllamaHealth().then((health) => {
      setOllamaAvailable(health.available);
    });
  }, []);

  const handleAutoDetect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setIsProcessing(true);
    setPreviewData(null);

    try {
      const isCsv = file.name.toLowerCase().endsWith('.csv');

      // Helper to build preview from Ollama result (supports mentors & corporates too)
      const buildPreviewFromOllama = (result: Awaited<ReturnType<typeof convertFileWithOllama>>) => {
        const startups = result.startups || [];
        const investors = result.investors || [];
        const mentors = (result.mentors as Mentor[] | undefined) || [];
        const corporates = (result.corporates as CorporatePartner[] | undefined) || [];

        const kinds: Array<'startups' | 'investors' | 'mentors' | 'corporates'> = [];
        if (startups.length) kinds.push('startups');
        if (investors.length) kinds.push('investors');
        if (mentors.length) kinds.push('mentors');
        if (corporates.length) kinds.push('corporates');

        if (kinds.length === 0) {
          setError(result.errors.join('; ') || 'Ollama AI returned no rows. Please check the file contents.');
          return;
        }

        const previewType = kinds.length === 1 ? kinds[0] : 'mixed';
        const totalRows = startups.length + investors.length + mentors.length + corporates.length;

        setPreviewData({
          type: previewType,
          data: [...startups, ...investors, ...mentors, ...corporates],
          startups: startups.length ? startups : undefined,
          investors: investors.length ? investors : undefined,
          mentors: mentors.length ? mentors : undefined,
          corporates: corporates.length ? corporates : undefined,
          mappings: [],
          warnings: [
            ...(result.warnings || []),
            isCsv ? 'Used AI converter (Ollama) due to unclear CSV format' : `Used AI converter (Ollama) to convert ${file.name}`
          ],
          errors: result.errors || [],
          stats: {
            totalRows,
            validRows: totalRows,
            skippedRows: 0
          },
          confidence: result.confidence
        });
      };

      // AUTO: For any non-CSV file, use Ollama AI immediately (if available)
      if (!isCsv && ollamaAvailable) {
        const result = await convertFileWithOllama(file);
        if (result.errors.length > 0) {
          setError(result.errors.join('; '));
          return;
        }
        buildPreviewFromOllama(result);
        return;
      }

      // Default: try rule-based converter first (fast for CSV)
      const content = await file.text();
      
      // First check if it's a mixed CSV (contains both)
      const isMixed = detectMixedCSV(content);
      
      let ruleBasedWorked = false;
      let shouldTryOllama = false;
      
      if (isMixed) {
        // Parse mixed CSV
        const mixedResult = parseMixedCSV(content);
        
        // Check if rule-based worked well
        const hasErrors = mixedResult.errors.length > 0;
        const hasLowValidRows = mixedResult.startups.length + mixedResult.investors.length === 0;
        const hasManyWarnings = mixedResult.warnings.length > mixedResult.startups.length + mixedResult.investors.length;
        
        if (hasErrors || hasLowValidRows || hasManyWarnings) {
          shouldTryOllama = true;
        } else {
          ruleBasedWorked = true;
          setPreviewData({
            type: 'mixed',
            data: [...mixedResult.startups, ...mixedResult.investors] as any,
            startups: mixedResult.startups,
            investors: mixedResult.investors,
            mappings: [...mixedResult.mappings.startups, ...mixedResult.mappings.investors],
            warnings: mixedResult.warnings,
            errors: mixedResult.errors,
            stats: {
              totalRows: mixedResult.startups.length + mixedResult.investors.length,
              validRows: mixedResult.startups.length + mixedResult.investors.length,
              skippedRows: 0
            }
          });
        }
      } else {
        // Try to detect single type
        const detectedType = detectCSVType(content);

        if (detectedType === 'unknown') {
          // Try both and see which one works better
          const startupResult = smartConvertStartupCSV(content);
          const investorResult = smartConvertInvestorCSV(content);
          
          const startupHasErrors = startupResult.errors.length > 0 || startupResult.validRows === 0;
          const investorHasErrors = investorResult.errors.length > 0 || investorResult.validRows === 0;
          
          if (startupHasErrors && investorHasErrors) {
            shouldTryOllama = true;
          } else if (startupResult.data.length > 0 && investorResult.data.length === 0) {
            // Definitely startups
            ruleBasedWorked = true;
            setPreviewData({
              type: 'startups',
              data: startupResult.data,
              mappings: startupResult.mappings,
              warnings: startupResult.warnings,
              errors: startupResult.errors,
              stats: {
                totalRows: startupResult.totalRows,
                validRows: startupResult.validRows,
                skippedRows: startupResult.skippedRows
              }
            });
          } else if (investorResult.data.length > 0 && startupResult.data.length === 0) {
            // Definitely investors
            ruleBasedWorked = true;
            setPreviewData({
              type: 'investors',
              data: investorResult.data,
              mappings: investorResult.mappings,
              warnings: investorResult.warnings,
              errors: investorResult.errors,
              stats: {
                totalRows: investorResult.totalRows,
                validRows: investorResult.validRows,
                skippedRows: investorResult.skippedRows
              }
            });
          } else {
            shouldTryOllama = true;
          }
        } else {
          // Process with detected type
          if (detectedType === 'startups') {
            const result = smartConvertStartupCSV(content);
            const hasErrors = result.errors.length > 0;
            const hasLowValidRows = result.validRows === 0;
            const hasManyWarnings = result.warnings.length > result.validRows * 2;
            
            if (hasErrors || hasLowValidRows || hasManyWarnings) {
              shouldTryOllama = true;
            } else {
              ruleBasedWorked = true;
              setPreviewData({
                type: 'startups',
                data: result.data,
                mappings: result.mappings,
                warnings: result.warnings,
                errors: result.errors,
                stats: {
                  totalRows: result.totalRows,
                  validRows: result.validRows,
                  skippedRows: result.skippedRows
                }
              });
            }
          } else {
            const result = smartConvertInvestorCSV(content);
            const hasErrors = result.errors.length > 0;
            const hasLowValidRows = result.validRows === 0;
            const hasManyWarnings = result.warnings.length > result.validRows * 2;
            
            if (hasErrors || hasLowValidRows || hasManyWarnings) {
              shouldTryOllama = true;
            } else {
              ruleBasedWorked = true;
              setPreviewData({
                type: 'investors',
                data: result.data,
                mappings: result.mappings,
                warnings: result.warnings,
                errors: result.errors,
                stats: {
                  totalRows: result.totalRows,
                  validRows: result.validRows,
                  skippedRows: result.skippedRows
                }
              });
            }
          }
        }
      }
      
      // Fallback to Ollama if rule-based failed or had poor results, OR if file is not CSV
      if ((!ruleBasedWorked && shouldTryOllama) || !isCsv) {
        if (ollamaAvailable) {
          console.log('Using Ollama AI converter for file:', file.name);
          try {
            const result = await convertFileWithOllama(file);
            if (result.errors.length > 0) {
              setError(result.errors.join('; '));
              return;
            }
            buildPreviewFromOllama(result);
            return;
          } catch (ollamaError) {
            console.warn('Ollama conversion failed:', ollamaError);
            setError(`Ollama AI conversion failed: ${ollamaError instanceof Error ? ollamaError.message : 'Unknown error'}. Please check that Ollama is running and the file format is supported.`);
            return;
          }
        } else {
          // Ollama not available
          if (!isCsv) {
            setError(`File format "${file.name.split('.').pop()?.toUpperCase()}" requires Ollama AI converter. Please start Ollama (see OLLAMA_SETUP_GUIDE.md) or convert to CSV first.`);
          } else {
            setError('CSV format is messy/unclear. Rule-based converter failed. Enable Ollama AI converter to handle this file. See OLLAMA_SETUP_GUIDE.md');
          }
          return;
        }
      }
      
      // If we get here and rule-based didn't work, show the error
      if (!ruleBasedWorked && !shouldTryOllama) {
        setError('Could not auto-detect CSV type. The file may contain both startups and investors, or the format is unclear. Please ensure your CSV has clear column names.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to auto-detect CSV type');
    } finally {
      setIsProcessing(false);
    }
  }, [ollamaAvailable]);

  const handleConfirmImport = useCallback(() => {
    if (!previewData) return;

    if (previewData.type === 'mixed') {
      if (previewData.startups && previewData.startups.length > 0) {
        onStartupsImported(previewData.startups);
      }
      if (previewData.investors && previewData.investors.length > 0) {
        onInvestorsImported(previewData.investors);
      }
      if (previewData.mentors && previewData.mentors.length > 0) {
        onMentorsImported(previewData.mentors);
      }
      if (previewData.corporates && previewData.corporates.length > 0) {
        onCorporatesImported(previewData.corporates);
      }
    } else if (previewData.type === 'startups') {
      onStartupsImported(previewData.data as Startup[]);
    } else if (previewData.type === 'investors') {
      onInvestorsImported(previewData.data as Investor[]);
    } else if (previewData.type === 'mentors') {
      onMentorsImported(previewData.data as Mentor[]);
    } else if (previewData.type === 'corporates') {
      onCorporatesImported(previewData.data as CorporatePartner[]);
    }
    
    onClose();
  }, [previewData, onStartupsImported, onInvestorsImported, onMentorsImported, onCorporatesImported, onClose]);

  const downloadTemplate = useCallback((type: 'startups' | 'investors') => {
    const template = type === 'startups' 
      ? generateStartupCSVTemplate() 
      : generateInvestorCSVTemplate();
    
    downloadCSV(template, `${type}_template.csv`);
  }, []);

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Smart CSV Import
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Upload any CSV format - we'll automatically detect and convert it to the right format!
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!previewData ? (
          <div className="space-y-6">
            {/* Auto-detect (always available, not a tab) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Auto‑Detect Upload
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Upload CSV, Excel, PDF, or text files. We'll detect startups, investors, mentors, and corporates.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = '/templates/startup-template.csv';
                      link.download = 'startup-template.csv';
                      link.click();
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Startup
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = '/templates/investor-template.csv';
                      link.download = 'investor-template.csv';
                      link.click();
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Investor
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = '/templates/mentor-template.csv';
                      link.download = 'mentor-template.csv';
                      link.click();
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Mentor
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = '/templates/corporate-template.csv';
                      link.download = 'corporate-template.csv';
                      link.click();
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Corporate
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-csv">Select any file format</Label>
                  <span className="text-xs text-muted-foreground">
                    AI converter: {ollamaAvailable ? 'online' : 'offline'}
                  </span>
                </div>

                <Input
                  id="auto-csv"
                  type="file"
                  accept="*/*"
                  onChange={handleAutoDetect}
                  disabled={isProcessing}
                />
                <p className="text-xs text-muted-foreground">
                  Upload any file format (CSV, TXT, JSON, PDF, DOCX, XLSX, etc.) — Ollama AI will automatically convert it to structured data.
                </p>
              </div>

              {ollamaAvailable === false && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <div>
                        <strong>AI converter is offline.</strong>
                      </div>
                      <div className="text-sm">
                        <div><strong>1)</strong> Confirm Ollama is running:</div>
                        <div><code>ollama list</code> (if it works, Ollama is already running — don’t run <code>ollama serve</code> again)</div>
                      </div>
                      <div className="text-sm">
                        <div><strong>2)</strong> Start the converter API (new terminal):</div>
                        <div>
                          Run <code>ollama-converter\\start.bat</code>
                        </div>
                      </div>
                      <div className="text-sm">
                        <div><strong>3)</strong> Refresh this page.</div>
                      </div>
                      <div className="text-sm">
                        Full guide: <code>OLLAMA_SETUP_GUIDE.md</code>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Preview Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">
                  Preview: {
                    previewData.type === 'mixed' 
                      ? `Mixed (${[
                          previewData.startups ? `${previewData.startups.length} startups` : null,
                          previewData.investors ? `${previewData.investors.length} investors` : null,
                          previewData.mentors ? `${previewData.mentors.length} mentors` : null,
                          previewData.corporates ? `${previewData.corporates.length} corporates` : null,
                        ].filter(Boolean).join(', ')})`
                      : previewData.type === 'startups'
                        ? 'Startups'
                        : previewData.type === 'investors'
                          ? 'Investors'
                          : previewData.type === 'mentors'
                            ? 'Mentors'
                            : 'Corporates'
                  }
                </h3>
                <p className="text-sm text-muted-foreground">
                  {previewData.stats.validRows} valid rows • {previewData.stats.skippedRows} skipped
                  {previewData.confidence !== undefined && (
                    <span className="ml-2">
                      • Confidence: {Math.round(previewData.confidence * 100)}%
                    </span>
                  )}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setPreviewData(null)}>
                <X className="h-4 w-4 mr-2" />
                Change File
              </Button>
            </div>

            {/* Column Mappings */}
            {previewData.mappings.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Column Mappings Detected:</h4>
                <div className="flex flex-wrap gap-2">
                  {previewData.mappings.map((mapping, idx) => (
                    <Badge key={idx} variant={mapping.confidence >= 0.7 ? "default" : "secondary"}>
                      {mapping.originalName} → {mapping.mappedField}
                      {mapping.confidence < 0.7 && " (low confidence)"}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {previewData.warnings.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-1">Warnings:</div>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {previewData.warnings.slice(0, 5).map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                    {previewData.warnings.length > 5 && (
                      <li>... and {previewData.warnings.length - 5} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Errors (block import) */}
            {previewData.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-1">Fix these issues before importing:</div>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {previewData.errors.slice(0, 8).map((msg, idx) => (
                      <li key={idx}>{msg}</li>
                    ))}
                    {previewData.errors.length > 8 && (
                      <li>... and {previewData.errors.length - 8} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Preview Table */}
            {previewData.type === 'mixed' ? (
              <div className="space-y-4">
                {previewData.startups && previewData.startups.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Startups ({previewData.startups.length})</h4>
                    <div className="border rounded-lg max-h-64 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Company Name</TableHead>
                            <TableHead>Industry</TableHead>
                            <TableHead>Funding Stage</TableHead>
                            <TableHead>Funding Target</TableHead>
                            <TableHead>Geo Markets</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.startups.slice(0, 5).map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{item.companyName}</TableCell>
                              <TableCell>{item.industry}</TableCell>
                              <TableCell>{item.fundingStage}</TableCell>
                              <TableCell>${(item.fundingTarget / 1000000).toFixed(1)}M</TableCell>
                              <TableCell>{item.geoMarkets.join(', ')}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {previewData.startups.length > 5 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Showing first 5 of {previewData.startups.length} startups
                      </p>
                    )}
                  </div>
                )}
                {previewData.investors && previewData.investors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Investors ({previewData.investors.length})</h4>
                    <div className="border rounded-lg max-h-64 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Firm Name</TableHead>
                            <TableHead>Investment Member</TableHead>
                            <TableHead>Geo Focus</TableHead>
                            <TableHead>Industries</TableHead>
                            <TableHead>Stages</TableHead>
                            <TableHead>Ticket Size</TableHead>
                            <TableHead>Slots</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.investors.slice(0, 5).map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{item.firmName}</TableCell>
                              <TableCell>{item.memberName}</TableCell>
                              <TableCell>{item.geoFocus.join(', ')}</TableCell>
                              <TableCell>{item.industryPreferences.join(', ')}</TableCell>
                              <TableCell>{item.stagePreferences.join(', ')}</TableCell>
                              <TableCell>${(item.minTicketSize / 1000000).toFixed(1)}M - ${(item.maxTicketSize / 1000000).toFixed(1)}M</TableCell>
                              <TableCell>{item.totalSlots}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {previewData.investors.length > 5 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Showing first 5 of {previewData.investors.length} investors
                      </p>
                    )}
                  </div>
                )}
                {previewData.mentors && previewData.mentors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Mentors ({previewData.mentors.length})</h4>
                    <div className="border rounded-lg max-h-64 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Full Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>LinkedIn</TableHead>
                            <TableHead>Geo Focus</TableHead>
                            <TableHead>Industries</TableHead>
                            <TableHead>Expertise</TableHead>
                            <TableHead>Slots</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.mentors.slice(0, 5).map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{item.fullName}</TableCell>
                              <TableCell>{item.email}</TableCell>
                              <TableCell>{item.linkedinUrl}</TableCell>
                              <TableCell>{item.geoFocus.join(', ')}</TableCell>
                              <TableCell>{item.industryPreferences.join(', ')}</TableCell>
                              <TableCell>{item.expertiseAreas.join(', ')}</TableCell>
                              <TableCell>{item.totalSlots}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {previewData.mentors.length > 5 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Showing first 5 of {previewData.mentors.length} mentors
                      </p>
                    )}
                  </div>
                )}
                {previewData.corporates && previewData.corporates.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Corporates ({previewData.corporates.length})</h4>
                    <div className="border rounded-lg max-h-64 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Firm Name</TableHead>
                            <TableHead>Contact Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Geo Focus</TableHead>
                            <TableHead>Industries</TableHead>
                            <TableHead>Partnership Types</TableHead>
                            <TableHead>Stages</TableHead>
                            <TableHead>Slots</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.corporates.slice(0, 5).map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{item.firmName}</TableCell>
                              <TableCell>{item.contactName}</TableCell>
                              <TableCell>{item.email}</TableCell>
                              <TableCell>{item.geoFocus.join(', ')}</TableCell>
                              <TableCell>{item.industryPreferences.join(', ')}</TableCell>
                              <TableCell>{item.partnershipTypes.join(', ')}</TableCell>
                              <TableCell>{item.stages.join(', ')}</TableCell>
                              <TableCell>{item.totalSlots}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {previewData.corporates.length > 5 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Showing first 5 of {previewData.corporates.length} corporates
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="border rounded-lg max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {previewData.type === 'startups' ? (
                          <>
                            <TableHead>Company Name</TableHead>
                            <TableHead>Industry</TableHead>
                            <TableHead>Funding Stage</TableHead>
                            <TableHead>Funding Target</TableHead>
                            <TableHead>Geo Markets</TableHead>
                          </>
                        ) : previewData.type === 'investors' ? (
                          <>
                            <TableHead>Firm Name</TableHead>
                            <TableHead>Investment Member</TableHead>
                            <TableHead>Geo Focus</TableHead>
                            <TableHead>Industries</TableHead>
                            <TableHead>Stages</TableHead>
                            <TableHead>Ticket Size</TableHead>
                            <TableHead>Slots</TableHead>
                          </>
                        ) : previewData.type === 'mentors' ? (
                          <>
                            <TableHead>Full Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>LinkedIn</TableHead>
                            <TableHead>Geo Focus</TableHead>
                            <TableHead>Industries</TableHead>
                            <TableHead>Expertise</TableHead>
                            <TableHead>Slots</TableHead>
                          </>
                        ) : (
                          <>
                            <TableHead>Firm Name</TableHead>
                            <TableHead>Contact Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Geo Focus</TableHead>
                            <TableHead>Industries</TableHead>
                            <TableHead>Partnership Types</TableHead>
                            <TableHead>Stages</TableHead>
                            <TableHead>Slots</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.data.slice(0, 10).map((item, idx) => (
                        <TableRow key={idx}>
                          {previewData.type === 'startups' ? (
                            <>
                              <TableCell>{(item as Startup).companyName}</TableCell>
                              <TableCell>{(item as Startup).industry}</TableCell>
                              <TableCell>{(item as Startup).fundingStage}</TableCell>
                              <TableCell>${((item as Startup).fundingTarget / 1000000).toFixed(1)}M</TableCell>
                              <TableCell>{(item as Startup).geoMarkets.join(', ')}</TableCell>
                            </>
                          ) : previewData.type === 'investors' ? (
                            <>
                              <TableCell>{(item as Investor).firmName}</TableCell>
                              <TableCell>{(item as Investor).memberName}</TableCell>
                              <TableCell>{(item as Investor).geoFocus.join(', ')}</TableCell>
                              <TableCell>{(item as Investor).industryPreferences.join(', ')}</TableCell>
                              <TableCell>{(item as Investor).stagePreferences.join(', ')}</TableCell>
                              <TableCell>${((item as Investor).minTicketSize / 1000000).toFixed(1)}M - ${((item as Investor).maxTicketSize / 1000000).toFixed(1)}M</TableCell>
                              <TableCell>{(item as Investor).totalSlots}</TableCell>
                            </>
                          ) : previewData.type === 'mentors' ? (
                            <>
                              <TableCell>{(item as Mentor).fullName}</TableCell>
                              <TableCell>{(item as Mentor).email}</TableCell>
                              <TableCell>{(item as Mentor).linkedinUrl}</TableCell>
                              <TableCell>{(item as Mentor).geoFocus.join(', ')}</TableCell>
                              <TableCell>{(item as Mentor).industryPreferences.join(', ')}</TableCell>
                              <TableCell>{(item as Mentor).expertiseAreas.join(', ')}</TableCell>
                              <TableCell>{(item as Mentor).totalSlots}</TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell>{(item as CorporatePartner).firmName}</TableCell>
                              <TableCell>{(item as CorporatePartner).contactName}</TableCell>
                              <TableCell>{(item as CorporatePartner).email}</TableCell>
                              <TableCell>{(item as CorporatePartner).geoFocus.join(', ')}</TableCell>
                              <TableCell>{(item as CorporatePartner).industryPreferences.join(', ')}</TableCell>
                              <TableCell>{(item as CorporatePartner).partnershipTypes.join(', ')}</TableCell>
                              <TableCell>{(item as CorporatePartner).stages.join(', ')}</TableCell>
                              <TableCell>{(item as CorporatePartner).totalSlots}</TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {previewData.data.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center">
                    Showing first 10 of {previewData.data.length} rows
                  </p>
                )}
              </>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPreviewData(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={
                  previewData.errors.length > 0 ||
                  (previewData.type === 'mixed'
                    ? ((!previewData.startups || previewData.startups.length === 0) &&
                      (!previewData.investors || previewData.investors.length === 0))
                    : previewData.data.length === 0)
                }
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Import {
                  previewData.type === 'mixed' 
                    ? `${previewData.startups?.length || 0} startups, ${previewData.investors?.length || 0} investors`
                    : `${previewData.data.length} ${previewData.type === 'startups' ? 'Startups' : 'Investors'}`
                }
              </Button>
            </div>
          </div>
        )}

        {!previewData && (
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}