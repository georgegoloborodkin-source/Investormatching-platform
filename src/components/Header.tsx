import { Button } from "@/components/ui/button";
import { Plus, Upload, RotateCcw, Download } from "lucide-react";

interface HeaderProps {
  onImportData: () => void;
  onGenerateMatches: () => void;
  onRematch: () => void;
  onExport: () => void;
  isRematching?: boolean;
  hasData: boolean;
}

export function Header({ 
  onImportData, 
  onGenerateMatches,
  onRematch, 
  onExport, 
  isRematching = false,
  hasData
}: HeaderProps) {
  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <h1 className="text-2xl font-bold text-primary">
              InvestorMatch MVP
            </h1>
            <nav className="hidden md:flex space-x-6">
              <span className="text-sm font-medium text-muted-foreground">
                Simple Startup-Investor Matchmaking
              </span>
            </nav>
          </div>

          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onImportData}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            
            <Button 
              size="sm" 
              onClick={onGenerateMatches}
              disabled={!hasData}
              className="gradient-primary"
            >
              Generate Matches
            </Button>
            
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={onRematch}
              disabled={isRematching || !hasData}
            >
              <RotateCcw className={`h-4 w-4 mr-2 ${isRematching ? 'animate-spin' : ''}`} />
              {isRematching ? 'Rematching...' : 'Rematch'}
            </Button>
            
            <Button 
              variant="outline"
              size="sm" 
              onClick={onExport}
              disabled={!hasData}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}