import { useState, useCallback } from 'react';
import { Upload, FileText, X, CheckCircle2, AlertTriangle, Layers, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { parseDicomFile, convertDicomDVHToAppFormat } from '@/utils/dicomRTParser';
import {
  summateDicomPlans,
  type SummationMethod,
  type SummedPlanResult,
} from '@/utils/planSummationDicom';
import type { DicomRTStructure } from '@/types/dicomRT';
import type { DVHData, Structure } from '@/types/dvh';

interface PlanSlot {
  file: File | null;
  buffer: ArrayBuffer | null;
  structures: Structure[] | null;
  patientId: string | null;
  loading: boolean;
}

interface PlanSummationManagerProps {
  onSummationComplete: (data: DVHData, result: SummedPlanResult) => void;
}

const emptySlot = (): PlanSlot => ({
  file: null,
  buffer: null,
  structures: null,
  patientId: null,
  loading: false,
});

export const PlanSummationManager = ({ onSummationComplete }: PlanSummationManagerProps) => {
  const { toast } = useToast();
  const [plan1, setPlan1] = useState<PlanSlot>(emptySlot());
  const [plan2, setPlan2] = useState<PlanSlot>(emptySlot());
  const [rtStructFile, setRtStructFile] = useState<File | null>(null);
  const [rtStructures, setRtStructures] = useState<DicomRTStructure[] | null>(null);
  const [method, setMethod] = useState<SummationMethod>('dose_grid');
  const [computing, setComputing] = useState(false);
  const [lastResult, setLastResult] = useState<SummedPlanResult | null>(null);

  const loadDoseFile = useCallback(
    async (file: File, slot: 'plan1' | 'plan2') => {
      const setter = slot === 'plan1' ? setPlan1 : setPlan2;
      setter((p) => ({ ...p, file, loading: true }));
      try {
        const buffer = await file.arrayBuffer();
        const data = await parseDicomFile(file);

        let structures: Structure[] | null = null;
        if (data.dose?.dvhs && data.dose.dvhs.length > 0) {
          // Pour DVH direct on a besoin du RTSTRUCT pour les noms ; sinon noms ROI génériques
          const dummyStructs: DicomRTStructure[] = data.dose.dvhs.map((dvh) => ({
            roiNumber: dvh.referencedROINumber ?? -1,
            name: `ROI_${dvh.referencedROINumber ?? '?'}`,
            description: '',
            generationAlgorithm: '',
            color: null,
            contours: [],
          }));
          const converted = convertDicomDVHToAppFormat(
            rtStructures ?? dummyStructs,
            data.dose.dvhs,
          );
          structures = converted.map((dvh) => ({
            name: dvh.name,
            type: 'STANDARD',
            category: dvh.name.toUpperCase().startsWith('PTV') ? 'PTV' : 'OAR',
            relativeVolume: dvh.relativeVolume,
            totalVolume: dvh.absoluteVolume,
          }));
        }

        setter({
          file,
          buffer,
          structures,
          patientId: data.patientId || null,
          loading: false,
        });

        toast({
          title: `Plan ${slot === 'plan1' ? '1' : '2'} chargé`,
          description: `${file.name}${structures ? ` — ${structures.length} DVH` : ' — sans DVH pré-calculés'}`,
        });
      } catch (err) {
        console.error('[PlanSummation] erreur chargement RTDOSE:', err);
        setter(emptySlot());
        toast({
          title: 'Erreur de lecture RTDOSE',
          description: (err as Error).message,
          variant: 'destructive',
        });
      }
    },
    [rtStructures, toast],
  );

  const loadStructFile = useCallback(
    async (file: File) => {
      try {
        const data = await parseDicomFile(file);
        if (!data.structures || data.structures.length === 0) {
          throw new Error('Aucune structure trouvée dans ce fichier (pas un RTSTRUCT ?).');
        }
        setRtStructFile(file);
        setRtStructures(data.structures);
        toast({
          title: 'RTSTRUCT chargé',
          description: `${data.structures.length} structures disponibles pour recalcul DVH.`,
        });
      } catch (err) {
        toast({
          title: 'Erreur RTSTRUCT',
          description: (err as Error).message,
          variant: 'destructive',
        });
      }
    },
    [toast],
  );

  const reset = () => {
    setPlan1(emptySlot());
    setPlan2(emptySlot());
    setRtStructFile(null);
    setRtStructures(null);
    setLastResult(null);
  };

  const canCompute =
    plan1.file && plan2.file && !plan1.loading && !plan2.loading &&
    (method === 'dose_grid'
      ? !!plan1.buffer && !!plan2.buffer
      : !!plan1.structures && !!plan2.structures);

  const compute = async () => {
    if (!canCompute) return;
    setComputing(true);
    setLastResult(null);
    try {
      const result = await summateDicomPlans({
        plan1Name: plan1.file!.name,
        plan2Name: plan2.file!.name,
        rtDose1Buffer: plan1.buffer ?? undefined,
        rtDose2Buffer: plan2.buffer ?? undefined,
        rtStructures: rtStructures ?? undefined,
        plan1Structures: plan1.structures ?? undefined,
        plan2Structures: plan2.structures ?? undefined,
        preferredMethod: method,
      });
      setLastResult(result);
      toast({
        title: 'Sommation calculée',
        description: `${result.structures.length} structures · méthode ${result.summationMethod === 'dose_grid' ? 'grille de dose' : 'DVH direct'}`,
      });
    } catch (err) {
      console.error('[PlanSummation] erreur sommation:', err);
      toast({
        title: 'Erreur de sommation',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setComputing(false);
    }
  };

  const apply = () => {
    if (!lastResult) return;
    const dvhData: DVHData = {
      patientId:
        plan1.patientId ||
        plan2.patientId ||
        `Sommation ${plan1.file?.name ?? ''} + ${plan2.file?.name ?? ''}`,
      structures: lastResult.structures,
    };
    onSummationComplete(dvhData, lastResult);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="w-5 h-5" />
          Sommation de plans (DICOM RT)
        </CardTitle>
        <CardDescription>
          Sommez deux plans RTDOSE (ex : 46 Gy + 14 Gy boost = 60 Gy) avec recalcul DVH depuis la grille sommée
          ou approximation DVH direct.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Méthode */}
        <div className="space-y-2">
          <Label>Méthode de sommation</Label>
          <RadioGroup value={method} onValueChange={(v) => setMethod(v as SummationMethod)} className="grid gap-3">
            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
              <RadioGroupItem value="dose_grid" id="method-grid" className="mt-1" />
              <div className="space-y-1">
                <div className="font-medium text-sm">Grille de dose (précis)</div>
                <p className="text-xs text-muted-foreground">
                  Sommation voxel-par-voxel des RTDOSE puis recalcul DVH cumulatif via les contours du RTSTRUCT.
                  Nécessite des grilles compatibles (mêmes dimensions, origine, spacing).
                </p>
              </div>
            </label>
            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
              <RadioGroupItem value="dvh_direct" id="method-dvh" className="mt-1" />
              <div className="space-y-1">
                <div className="font-medium text-sm">DVH direct (approximatif)</div>
                <p className="text-xs text-muted-foreground">
                  Combinaison borne-supérieure des courbes DVH déjà calculées dans chaque RTDOSE. Plus rapide,
                  utile en fallback, mais à valider avec une sommation TPS pour usage clinique.
                </p>
              </div>
            </label>
          </RadioGroup>
        </div>

        <Separator />

        {/* Slots fichiers */}
        <div className="grid gap-4 md:grid-cols-2">
          <FileSlot
            label="Plan 1 — RTDOSE"
            slot={plan1}
            onPick={(f) => loadDoseFile(f, 'plan1')}
            onClear={() => setPlan1(emptySlot())}
          />
          <FileSlot
            label="Plan 2 — RTDOSE"
            slot={plan2}
            onPick={(f) => loadDoseFile(f, 'plan2')}
            onClear={() => setPlan2(emptySlot())}
          />
        </div>

        {/* RTSTRUCT optionnel */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            RTSTRUCT
            {method === 'dose_grid' ? (
              <Badge variant="outline" className="text-xs">requis</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">optionnel</Badge>
            )}
          </Label>
          {rtStructFile ? (
            <div className="flex items-center gap-2 rounded-lg border p-3 bg-muted/30">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{rtStructFile.name}</div>
                <div className="text-xs text-muted-foreground">
                  {rtStructures?.length ?? 0} structures disponibles
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRtStructFile(null);
                  setRtStructures(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed p-4 text-center">
              <Input
                type="file"
                accept=".dcm,application/dicom"
                onChange={(e) => e.target.files?.[0] && loadStructFile(e.target.files[0])}
                className="hidden"
                id="rtstruct-input"
              />
              <Button asChild variant="outline" size="sm">
                <label htmlFor="rtstruct-input" className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />
                  Charger RTSTRUCT
                </label>
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Pour la méthode "grille de dose" — fournit les contours des structures.
              </p>
            </div>
          )}
        </div>

        {/* Avertissements pré-calcul */}
        {plan1.patientId && plan2.patientId && plan1.patientId !== plan2.patientId && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertTitle>Patients différents</AlertTitle>
            <AlertDescription>
              Plan 1 : {plan1.patientId} · Plan 2 : {plan2.patientId}. La sommation n'a de sens que pour le même patient.
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={compute} disabled={!canCompute || computing} size="lg">
            {computing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-background border-t-transparent mr-2" />
                Calcul en cours...
              </>
            ) : (
              <>
                <Calculator className="w-4 h-4 mr-2" />
                Calculer la sommation
              </>
            )}
          </Button>
          <Button variant="outline" onClick={reset}>
            Réinitialiser
          </Button>
        </div>

        {/* Résultat */}
        {lastResult && (
          <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span className="font-semibold">Résultat de la sommation</span>
              </div>
              <Badge variant={lastResult.summationMethod === 'dose_grid' ? 'default' : 'secondary'}>
                {lastResult.summationMethod === 'dose_grid' ? 'Grille de dose' : 'DVH direct'}
              </Badge>
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <InfoRow label="Plan 1" value={lastResult.info.plan1Name} />
              <InfoRow label="Plan 2" value={lastResult.info.plan2Name} />
              <InfoRow label="Structures" value={`${lastResult.structures.length}`} />
              {lastResult.info.maxDose !== undefined && (
                <InfoRow label="Dose max sommée" value={`${lastResult.info.maxDose.toFixed(2)} Gy`} />
              )}
            </div>

            {lastResult.info.unmatchedStructures.length > 0 && (
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertTitle>Structures non appariées</AlertTitle>
                <AlertDescription className="text-xs">
                  {lastResult.info.unmatchedStructures.join(', ')}
                </AlertDescription>
              </Alert>
            )}

            {lastResult.warnings.map((w, i) => (
              <Alert key={i}>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription className="text-xs">{w}</AlertDescription>
              </Alert>
            ))}

            <Button onClick={apply} className="w-full" size="lg">
              <FileText className="w-4 h-4 mr-2" />
              Utiliser ce DVH sommé pour l'analyse
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ────────── sous-composants ──────────

const FileSlot = ({
  label,
  slot,
  onPick,
  onClear,
}: {
  label: string;
  slot: PlanSlot;
  onPick: (f: File) => void;
  onClear: () => void;
}) => {
  const inputId = `slot-${label.replace(/\s+/g, '-')}`;
  if (slot.file) {
    return (
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center gap-2">
          {slot.loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-primary" />
          )}
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <Button variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0" onClick={onClear}>
            <X className="w-3 h-3" />
          </Button>
        </div>
        <div className="text-sm font-medium truncate">{slot.file.name}</div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {slot.patientId && <Badge variant="outline">Patient {slot.patientId}</Badge>}
          {slot.structures && <Badge variant="outline">{slot.structures.length} DVH</Badge>}
          {!slot.structures && !slot.loading && (
            <Badge variant="outline" className="text-amber-600">sans DVH pré-calculés</Badge>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border-2 border-dashed p-6 text-center space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="file"
        accept=".dcm,application/dicom"
        onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
        className="hidden"
        id={inputId}
      />
      <div>
        <Button asChild variant="outline" size="sm">
          <label htmlFor={inputId} className="cursor-pointer">
            <Upload className="w-4 h-4 mr-2" />
            Sélectionner RTDOSE
          </label>
        </Button>
      </div>
    </div>
  );
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-2">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium truncate text-right">{value}</span>
  </div>
);
