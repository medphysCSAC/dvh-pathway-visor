import { useState } from 'react';
import { Upload, Plus, X, CheckCircle2, Loader2, Edit2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PlanData, Structure } from '@/types/dvh';
import { UnifiedPlanUpload } from './UnifiedPlanUpload';
import { parseTomoTherapyDVH } from '@/utils/dvhParser';
import { convertDicomToStructures } from '@/utils/dicomRTParser';
import { DicomRTData } from '@/types/dicomRT';
import { toast } from 'sonner';

interface MultiFileUploadProps {
  onPlansLoaded: (plans: PlanData[], mode: 'comparison') => void;
}

interface PlanSlotData {
  id: string;
  label: string;
  structures: Structure[] | null;
  patientId: string;
  sourceType: 'csv' | 'dicom' | null;
}

const PlanSlot = ({
  slot,
  index,
  onLoaded,
  onReset,
  onRemove,
  onLabelChange,
  canRemove,
}: {
  slot: PlanSlotData;
  index: number;
  onLoaded: (id: string, structures: Structure[], patientId: string, type: 'csv' | 'dicom') => void;
  onReset: (id: string) => void;
  onRemove: (id: string) => void;
  onLabelChange: (id: string, label: string) => void;
  canRemove: boolean;
}) => {
  const [editingLabel, setEditingLabel] = useState(false);

  const handleCsvLoaded = async (relFile: File, absFile?: File) => {
    try {
      const relContent = await relFile.text();
      const absContent = absFile ? await absFile.text() : undefined;
      const data = parseTomoTherapyDVH(relContent, absContent);
      onLoaded(slot.id, data.structures, data.patientId || relFile.name, 'csv');
      toast.success(`Plan ${index + 1} chargé`, {
        description: `${data.structures.length} structures (CSV)`,
      });
    } catch {
      toast.error('Erreur CSV', { description: 'Impossible de lire les fichiers DVH' });
    }
  };

  const handleDicomLoaded = (data: DicomRTData) => {
    const structures = convertDicomToStructures(data);
    if (structures.length > 0) {
      onLoaded(slot.id, structures, data.patientId || 'DICOM', 'dicom');
      toast.success(`Plan ${index + 1} chargé`, {
        description: `${structures.length} structures (DICOM)`,
      });
    } else {
      toast.error('Aucune structure DVH', {
        description: 'Vérifiez que RTSTRUCT + RTDOSE sont présents',
      });
    }
  };

  return (
    <Card className={slot.structures ? 'border-success/40 bg-success/5' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Badge variant="outline" className="font-mono">Plan {index + 1}</Badge>
            {editingLabel ? (
              <Input
                value={slot.label}
                onChange={(e) => onLabelChange(slot.id, e.target.value)}
                onBlur={() => setEditingLabel(false)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingLabel(false)}
                className="h-7 text-sm w-48"
                autoFocus
              />
            ) : (
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-medium hover:text-primary"
                onClick={() => setEditingLabel(true)}
              >
                {slot.label}
                <Edit2 className="w-3 h-3 opacity-50" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {slot.structures && (
              <Badge variant="outline" className="bg-success/15 text-success border-success/30">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {slot.structures.length} structures · {slot.sourceType?.toUpperCase()}
              </Badge>
            )}
            {canRemove && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onRemove(slot.id)}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!slot.structures ? (
          <UnifiedPlanUpload
            key={slot.id + '-empty'}
            onCsvLoaded={handleCsvLoaded}
            onDicomLoaded={handleDicomLoaded}
          />
        ) : (
          <div className="flex items-center justify-between p-3 rounded-md bg-muted/40 border">
            <p className="text-sm">
              <span className="text-muted-foreground">Patient :</span>{' '}
              <span className="font-mono">{slot.patientId}</span>
            </p>
            <Button variant="outline" size="sm" onClick={() => onReset(slot.id)}>
              Changer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const MultiFileUpload = ({ onPlansLoaded }: MultiFileUploadProps) => {
  const [slots, setSlots] = useState<PlanSlotData[]>([
    { id: 'slot_1', label: 'Plan Initial', structures: null, patientId: '', sourceType: null },
    { id: 'slot_2', label: 'Replanning', structures: null, patientId: '', sourceType: null },
  ]);

  const addSlot = () => {
    if (slots.length >= 4) return;
    setSlots((prev) => [
      ...prev,
      {
        id: `slot_${Date.now()}`,
        label: `Plan ${prev.length + 1}`,
        structures: null,
        patientId: '',
        sourceType: null,
      },
    ]);
  };

  const removeSlot = (id: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  };

  const handleLoaded = (
    id: string,
    structures: Structure[],
    patientId: string,
    sourceType: 'csv' | 'dicom',
  ) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, structures, patientId, sourceType } : s)),
    );
  };

  const handleReset = (id: string) => {
    setSlots((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, structures: null, patientId: '', sourceType: null } : s,
      ),
    );
  };

  const handleLabelChange = (id: string, label: string) => {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, label } : s)));
  };

  const loadedSlots = slots.filter((s) => s.structures !== null);
  const canCompare = loadedSlots.length >= 2;

  const handleCompare = () => {
    const plans: PlanData[] = loadedSlots.map((s) => ({
      id: s.id,
      name: s.label,
      patientId: s.patientId,
      structures: s.structures!,
      uploadDate: new Date(),
    }));
    onPlansLoaded(plans, 'comparison');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Comparaison de plans
        </CardTitle>
        <CardDescription>
          Chargez 2 à 4 plans (CSV TomoTherapy ou DICOM RT) pour les superposer sur le même graphique DVH.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          {slots.map((slot, index) => (
            <PlanSlot
              key={slot.id}
              slot={slot}
              index={index}
              onLoaded={handleLoaded}
              onReset={handleReset}
              onRemove={removeSlot}
              onLabelChange={handleLabelChange}
              canRemove={slots.length > 2}
            />
          ))}
        </div>

        {slots.length < 4 && (
          <Button variant="outline" className="w-full" onClick={addSlot}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un plan ({slots.length}/4)
          </Button>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <p className="text-sm text-muted-foreground">
            {loadedSlots.length < 2
              ? `${loadedSlots.length}/2 plans chargés (minimum)`
              : `${loadedSlots.length} plans prêts à comparer`}
          </p>
          <Button
            size="lg"
            onClick={handleCompare}
            disabled={!canCompare}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            {!canCompare ? (
              <>
                <Loader2 className="w-4 h-4 mr-2" />
                En attente...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Comparer {loadedSlots.length} plans
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
