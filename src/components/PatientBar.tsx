import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Target, X } from 'lucide-react';
import { DVHData } from '@/types/dvh';
import { TreatmentProtocol } from '@/types/protocol';
import { findMaxDoseAcrossStructures } from '@/utils/dvhParser';

interface PatientBarProps {
  dvhData: DVHData;
  selectedCount: number;
  activeProtocol: TreatmentProtocol | null;
  comparisonMode?: 'summation' | 'comparison' | 'multi-patient' | null;
  comparisonPlanCount?: number;
  onChangePlan: () => void;
  onClearProtocol: () => void;
  onPickProtocol: () => void;
}

export const PatientBar = ({
  dvhData,
  selectedCount,
  activeProtocol,
  comparisonMode,
  comparisonPlanCount = 0,
  onChangePlan,
  onClearProtocol,
  onPickProtocol,
}: PatientBarProps) => {
  const maxDose = findMaxDoseAcrossStructures(dvhData.structures);

  return (
    <div className="bg-card border rounded-lg px-5 py-3 space-y-2">
      {/* Ligne 1 — infos clés */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-baseline gap-6 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Patient</p>
            <p className="text-lg font-semibold leading-tight">{dvhData.patientId}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Dose max</p>
            <p className="text-lg font-semibold leading-tight text-accent">
              {maxDose.toFixed(2)} <span className="text-xs font-normal">Gy</span>
            </p>
          </div>
          {comparisonMode === 'comparison' && (
            <Badge variant="outline" className="text-blue-500 border-blue-500/40">
              Comparaison · {comparisonPlanCount} plans
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onChangePlan} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Changer de plan
        </Button>
      </div>

      {/* Ligne 2 — métadonnées */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground border-t pt-2">
        <span>
          <span className="font-medium text-foreground">{dvhData.structures.length}</span> structures
        </span>
        <span>·</span>
        <span>
          <span className="font-medium text-foreground">{selectedCount}</span> sélectionnée{selectedCount > 1 ? 's' : ''}
        </span>
        <span>·</span>
        {activeProtocol ? (
          <span className="flex items-center gap-1.5">
            Protocole :
            <button
              type="button"
              onClick={onPickProtocol}
              className="inline-flex items-center gap-1 rounded bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 hover:bg-primary/25 transition-colors"
            >
              <Target className="w-3 h-3" />
              {activeProtocol.name}
            </button>
            <button
              type="button"
              onClick={onClearProtocol}
              className="text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Retirer le protocole"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={onPickProtocol}
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <Target className="w-3 h-3" />
            Associer un protocole
          </button>
        )}
      </div>
    </div>
  );
};

export default PatientBar;
