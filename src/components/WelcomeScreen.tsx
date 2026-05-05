import { useState } from 'react';
import { FileUp, GitCompare, Layers, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UnifiedPlanUpload } from './UnifiedPlanUpload';
import { MultiFileUpload } from './MultiFileUpload';
import { PlanSummationManager } from './PlanSummationManager';
import { DVHData, PlanData } from '@/types/dvh';
import { DicomRTData } from '@/types/dicomRT';
import type { SummedPlanResult } from '@/utils/planSummationDicom';

interface WelcomeScreenProps {
  onCsvLoaded: (rel: File, abs?: File) => void;
  onDicomLoaded: (data: DicomRTData) => void;
  onPlansLoaded: (plans: PlanData[], mode: 'summation' | 'comparison' | 'multi-patient') => void;
  onSummationComplete: (data: DVHData, result?: SummedPlanResult) => void;
}

export const WelcomeScreen = ({
  onCsvLoaded, onDicomLoaded, onPlansLoaded, onSummationComplete,
}: WelcomeScreenProps) => {
  const [compareOpen, setCompareOpen] = useState(false);
  const [sumOpen, setSumOpen] = useState(false);

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-2">
      {/* Titre */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold">Commencer une analyse</h2>
        <p className="text-sm text-muted-foreground">
          Importez un plan, ou choisissez un cas d'usage avancé.
        </p>
      </div>

      {/* Carte principale — Analyser un plan */}
      <Card className="border-2 border-primary/50 shadow-md">
        <CardContent className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="rounded-lg bg-primary/10 p-3 flex-shrink-0">
              <FileUp className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">Analyser un plan</h3>
                <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20 gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Le plus fréquent
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                DICOM RT (RT Dose + RT Structure) ou CSV TomoTherapy
              </p>
            </div>
          </div>
          <UnifiedPlanUpload onCsvLoaded={onCsvLoaded} onDicomLoaded={onDicomLoaded} />
        </CardContent>
      </Card>

      {/* Cartes secondaires — compactes, ouvrent en Dialog */}
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setCompareOpen(true)}
          className="text-left rounded-lg border-2 border-transparent bg-card hover:border-blue-500/40 hover:shadow-sm transition-all p-4"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2 flex-shrink-0">
              <GitCompare className="w-4 h-4 text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm">Comparer des plans</p>
              <p className="text-xs text-muted-foreground truncate">Initial vs replanning</p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSumOpen(true)}
          className="text-left rounded-lg border-2 border-transparent bg-card hover:border-green-500/40 hover:shadow-sm transition-all p-4"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-500/10 p-2 flex-shrink-0">
              <Layers className="w-4 h-4 text-green-500" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm">Sommer des plans</p>
              <p className="text-xs text-muted-foreground truncate">Plan cumulatif DICOM</p>
            </div>
          </div>
        </button>
      </div>

      {/* Dialog Comparaison */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comparer des plans</DialogTitle>
          </DialogHeader>
          <MultiFileUpload
            onPlansLoaded={(plans, mode) => {
              onPlansLoaded(plans, mode);
              setCompareOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog Sommation */}
      <Dialog open={sumOpen} onOpenChange={setSumOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sommation de plans</DialogTitle>
          </DialogHeader>
          <PlanSummationManager
            onSummationComplete={(data, result) => {
              onSummationComplete(data, result);
              setSumOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WelcomeScreen;
