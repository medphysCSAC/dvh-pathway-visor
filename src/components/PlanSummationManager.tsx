import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Calculator,
  Plus,
  FileStack,
} from 'lucide-react';
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
import type { DicomRTStructure, DicomRTData } from '@/types/dicomRT';
import type { DVHData, Structure } from '@/types/dvh';

const MAX_PLANS = 4;
const MIN_PLANS = 2;

interface PlanSlot {
  id: string;
  file: File | null;
  buffer: ArrayBuffer | null;
  structures: Structure[] | null;
  patientId: string | null;
  loading: boolean;
  /** Méta optionnelles depuis un RTPLAN associé */
  rtPlanInfo?: { fractions?: number; dosePerFraction?: number; planLabel?: string };
}

interface PlanSummationManagerProps {
  onSummationComplete: (data: DVHData, result: SummedPlanResult) => void;
}

const newSlot = (): PlanSlot => ({
  id: crypto.randomUUID(),
  file: null,
  buffer: null,
  structures: null,
  patientId: null,
  loading: false,
});

/** Détecte la modalité d'un fichier DICOM rapidement via parseDicomFile. */
async function detectAndParse(file: File): Promise<{ data: DicomRTData; buffer: ArrayBuffer }> {
  const buffer = await file.arrayBuffer();
  const data = await parseDicomFile(file);
  return { data, buffer };
}

export const PlanSummationManager = ({ onSummationComplete }: PlanSummationManagerProps) => {
  const { toast } = useToast();
  const [plans, setPlans] = useState<PlanSlot[]>([newSlot(), newSlot()]);
  const [rtStructFile, setRtStructFile] = useState<File | null>(null);
  const [rtStructures, setRtStructures] = useState<DicomRTStructure[] | null>(null);
  const [method, setMethod] = useState<SummationMethod>('dose_grid');
  const [computing, setComputing] = useState(false);
  const [lastResult, setLastResult] = useState<SummedPlanResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // ─────────── Mutations slots ───────────

  const updateSlot = (id: string, patch: Partial<PlanSlot>) => {
    setPlans((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeSlot = (id: string) => {
    setPlans((prev) => {
      const next = prev.filter((s) => s.id !== id);
      // Garantir au moins MIN_PLANS slots affichés
      while (next.length < MIN_PLANS) next.push(newSlot());
      return next;
    });
  };

  const addSlot = () => {
    setPlans((prev) => (prev.length >= MAX_PLANS ? prev : [...prev, newSlot()]));
  };

  /** Trouve le 1er slot vide, sinon en crée un (si limite non atteinte). */
  const findOrCreateEmptySlot = (currentPlans: PlanSlot[]): { slots: PlanSlot[]; targetId: string | null } => {
    const empty = currentPlans.find((s) => !s.file);
    if (empty) return { slots: currentPlans, targetId: empty.id };
    if (currentPlans.length >= MAX_PLANS) return { slots: currentPlans, targetId: null };
    const fresh = newSlot();
    return { slots: [...currentPlans, fresh], targetId: fresh.id };
  };

  // ─────────── Chargement RTDOSE dans un slot précis ───────────

  const loadDoseIntoSlot = useCallback(
    async (file: File, slotId: string, parsed?: { data: DicomRTData; buffer: ArrayBuffer }) => {
      updateSlot(slotId, { file, loading: true });
      try {
        const { data, buffer } = parsed ?? (await detectAndParse(file));

        let structures: Structure[] | null = null;
        if (data.dose?.dvhs && data.dose.dvhs.length > 0) {
          const dummyStructs: DicomRTStructure[] = data.dose.dvhs.map((dvh) => ({
            roiNumber: dvh.referencedROINumber ?? -1,
            name: `ROI_${dvh.referencedROINumber ?? '?'}`,
            description: '',
            generationAlgorithm: '',
            color: null,
            contours: [],
          }));
          const converted = convertDicomDVHToAppFormat(rtStructures ?? dummyStructs, data.dose.dvhs);
          structures = converted.map((dvh) => ({
            name: dvh.name,
            type: 'STANDARD',
            category: dvh.name.toUpperCase().startsWith('PTV') ? 'PTV' : 'OAR',
            relativeVolume: dvh.relativeVolume,
            totalVolume: dvh.absoluteVolume,
          }));
        }

        updateSlot(slotId, {
          file,
          buffer,
          structures,
          patientId: data.patientId || null,
          loading: false,
        });
      } catch (err) {
        console.error('[PlanSummation] erreur chargement RTDOSE:', err);
        updateSlot(slotId, { ...newSlot(), id: slotId });
        toast({
          title: 'Erreur de lecture RTDOSE',
          description: (err as Error).message,
          variant: 'destructive',
        });
      }
    },
    [rtStructures, toast],
  );

  // ─────────── Chargement RTSTRUCT ───────────

  const loadStructFile = useCallback(
    async (file: File, parsedData?: DicomRTData) => {
      try {
        const data = parsedData ?? (await parseDicomFile(file));
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

  // ─────────── Routing automatique multi-fichiers ───────────

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      // Parse tous les fichiers en parallèle pour détecter leur modalité
      const parsedAll = await Promise.allSettled(files.map((f) => detectAndParse(f)));

      let workingPlans = plans;
      let doseLoaded = 0;
      let structLoaded = 0;
      let planMetaApplied = 0;
      let skipped = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const result = parsedAll[i];
        if (result.status === 'rejected') {
          console.warn('[PlanSummation] parse échec', file.name, result.reason);
          skipped++;
          continue;
        }
        const { data, buffer } = result.value;
        const modality = data.modality?.toUpperCase();

        if (modality === 'RTSTRUCT' && data.structures?.length) {
          await loadStructFile(file, data);
          structLoaded++;
          continue;
        }

        if (modality === 'RTDOSE' || data.dose) {
          const { slots, targetId } = findOrCreateEmptySlot(workingPlans);
          if (!targetId) {
            skipped++;
            continue;
          }
          workingPlans = slots;
          // Synchroniser le state des slots (création éventuelle)
          setPlans(workingPlans);
          // Charger sans re-parser
          // eslint-disable-next-line no-await-in-loop
          await loadDoseIntoSlot(file, targetId, { data, buffer });
          // refresh local working ref
          workingPlans = workingPlans.map((s) =>
            s.id === targetId ? { ...s, file, buffer, patientId: data.patientId || null } : s,
          );
          doseLoaded++;
          continue;
        }

        if (modality === 'RTPLAN' && data.plan) {
          // Enrichit le 1er slot RTDOSE sans rtPlanInfo, sinon le plus récent
          const fractions = data.plan.fractionGroups?.[0]?.numberOfFractionsPlanned;
          const target = workingPlans.find((s) => s.file && !s.rtPlanInfo);
          if (target) {
            updateSlot(target.id, {
              rtPlanInfo: {
                fractions,
                planLabel: data.plan.planName || data.plan.planDescription,
              },
            });
            planMetaApplied++;
          } else {
            skipped++;
          }
          continue;
        }

        skipped++;
      }

      const summary: string[] = [];
      if (doseLoaded) summary.push(`${doseLoaded} RTDOSE`);
      if (structLoaded) summary.push(`${structLoaded} RTSTRUCT`);
      if (planMetaApplied) summary.push(`${planMetaApplied} RTPLAN`);
      if (skipped) summary.push(`${skipped} ignoré(s)`);
      if (summary.length) {
        toast({
          title: 'Fichiers traités',
          description: summary.join(' · '),
        });
      }
    },
    [plans, loadDoseIntoSlot, loadStructFile, toast],
  );

  // ─────────── Drag & drop ───────────

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === dropRef.current) setIsDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.toLowerCase().endsWith('.dcm') || f.type === 'application/dicom',
    );
    if (files.length === 0) {
      toast({
        title: 'Aucun fichier DICOM détecté',
        description: 'Déposez des fichiers .dcm (RTDOSE, RTSTRUCT, RTPLAN).',
        variant: 'destructive',
      });
      return;
    }
    handleFiles(files);
  };

  // ─────────── Validations ───────────

  const filledPlans = plans.filter((p) => p.file && !p.loading);
  const patientIds = Array.from(
    new Set(filledPlans.map((p) => p.patientId).filter((id): id is string => !!id)),
  );
  const patientsDiffer = patientIds.length > 1;
  const anyLoading = plans.some((p) => p.loading);

  const canCompute =
    !anyLoading &&
    filledPlans.length >= MIN_PLANS &&
    (method === 'dose_grid'
      ? filledPlans.every((p) => !!p.buffer)
      : filledPlans.every((p) => !!p.structures));

  // ─────────── Calcul ───────────

  const reset = () => {
    setPlans([newSlot(), newSlot()]);
    setRtStructFile(null);
    setRtStructures(null);
    setLastResult(null);
  };

  const compute = async () => {
    if (!canCompute) return;
    setComputing(true);
    setLastResult(null);
    try {
      const result = await summateDicomPlans({
        plans: filledPlans.map((p, idx) => ({
          name: p.rtPlanInfo?.planLabel || p.file!.name || `Plan ${idx + 1}`,
          rtDoseBuffer: p.buffer ?? undefined,
          structures: p.structures ?? undefined,
          rtPlanInfo: p.rtPlanInfo,
        })),
        rtStructures: rtStructures ?? undefined,
        preferredMethod: method,
      });
      setLastResult(result);
      toast({
        title: 'Sommation calculée',
        description: `${filledPlans.length} plans · ${result.structures.length} structures · méthode ${result.summationMethod === 'dose_grid' ? 'grille de dose' : 'DVH direct'}`,
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
        patientIds[0] ||
        `Sommation ${filledPlans.map((p) => p.file?.name ?? '').join(' + ')}`,
      structures: lastResult.structures,
    };
    onSummationComplete(dvhData, lastResult);
  };

  // ─────────── Rendu ───────────

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="w-5 h-5" />
          Sommation de plans (DICOM RT)
        </CardTitle>
        <CardDescription>
          Sommez jusqu'à {MAX_PLANS} plans RTDOSE (ex&nbsp;: 46&nbsp;Gy + 14&nbsp;Gy boost = 60&nbsp;Gy) avec recalcul DVH
          depuis la grille sommée ou approximation DVH direct. L'ordre des plans n'a pas d'importance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Méthode */}
        <div className="space-y-2">
          <Label>Méthode de sommation</Label>
          <RadioGroup
            value={method}
            onValueChange={(v) => setMethod(v as SummationMethod)}
            className="grid gap-3"
          >
            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
              <RadioGroupItem value="dose_grid" id="method-grid" className="mt-1" />
              <div className="space-y-1">
                <div className="font-medium text-sm">Grille de dose (précis)</div>
                <p className="text-xs text-muted-foreground">
                  Sommation voxel-par-voxel des RTDOSE puis recalcul DVH cumulatif via les contours du RTSTRUCT.
                  Nécessite des grilles compatibles (mêmes dimensions, origine, spacing) pour tous les plans.
                </p>
              </div>
            </label>
            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
              <RadioGroupItem value="dvh_direct" id="method-dvh" className="mt-1" />
              <div className="space-y-1">
                <div className="font-medium text-sm">DVH direct (approximatif)</div>
                <p className="text-xs text-muted-foreground">
                  Combinaison borne-supérieure des courbes DVH déjà calculées dans chaque RTDOSE
                  (V_sum(d) = max_i(V_i(d))). Utile en fallback, à valider avec une sommation TPS pour usage clinique.
                </p>
              </div>
            </label>
          </RadioGroup>
        </div>

        <Separator />

        {/* Drop zone multi-fichiers */}
        <div
          ref={dropRef}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border'
          }`}
        >
          <FileStack className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">
            Glissez plusieurs fichiers DICOM ici (RTDOSE, RTSTRUCT, RTPLAN)
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Tri automatique : les RTDOSE remplissent les emplacements, le RTSTRUCT et les RTPLAN enrichissent
            les métadonnées.
          </p>
          <div className="mt-3">
            <Input
              type="file"
              multiple
              accept=".dcm,application/dicom"
              onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
              className="hidden"
              id="multi-dicom-input"
            />
            <Button asChild variant="outline" size="sm">
              <label htmlFor="multi-dicom-input" className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                Ou sélectionner des fichiers
              </label>
            </Button>
          </div>
        </div>

        {/* Slots dynamiques */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Plans à sommer ({filledPlans.length}/{MAX_PLANS})</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={addSlot}
              disabled={plans.length >= MAX_PLANS}
            >
              <Plus className="w-4 h-4 mr-1" />
              Ajouter un plan
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {plans.map((slot, idx) => (
              <FileSlot
                key={slot.id}
                index={idx + 1}
                slot={slot}
                canRemove={plans.length > MIN_PLANS}
                onPick={(f) => loadDoseIntoSlot(f, slot.id)}
                onClear={() =>
                  slot.file
                    ? updateSlot(slot.id, { ...newSlot(), id: slot.id })
                    : removeSlot(slot.id)
                }
              />
            ))}
          </div>
        </div>

        {/* RTSTRUCT */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            RTSTRUCT commun
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
        {patientsDiffer && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertTitle>Patients différents détectés</AlertTitle>
            <AlertDescription>
              IDs trouvés : {patientIds.join(', ')}. La sommation n'a de sens que pour le même patient.
            </AlertDescription>
          </Alert>
        )}

        {filledPlans.length >= MIN_PLANS && !patientsDiffer && (
          <div className="rounded-lg border bg-muted/20 p-3 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span>
              {filledPlans.length} plans prêts
              {patientIds[0] ? ` · patient ${patientIds[0]}` : ''}
              {method === 'dose_grid' && rtStructures ? ` · ${rtStructures.length} structures` : ''}
            </span>
          </div>
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
              {lastResult.info.planNames.map((name, idx) => (
                <InfoRow key={idx} label={`Plan ${idx + 1}`} value={name} />
              ))}
              <InfoRow label="Structures" value={`${lastResult.structures.length}`} />
              {lastResult.info.maxDose !== undefined && (
                <InfoRow label="Dose max sommée" value={`${lastResult.info.maxDose.toFixed(2)} Gy`} />
              )}
            </div>

            {lastResult.info.unmatchedStructures.length > 0 && (
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertTitle>Structures partiellement présentes</AlertTitle>
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
  index,
  slot,
  canRemove,
  onPick,
  onClear,
}: {
  index: number;
  slot: PlanSlot;
  canRemove: boolean;
  onPick: (f: File) => void;
  onClear: () => void;
}) => {
  const inputId = `slot-${slot.id}`;
  const label = `Plan ${index} — RTDOSE`;

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
          {slot.rtPlanInfo?.fractions && (
            <Badge variant="outline">{slot.rtPlanInfo.fractions} fx</Badge>
          )}
          {!slot.structures && !slot.loading && (
            <Badge variant="outline" className="text-warning">sans DVH pré-calculés</Badge>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-dashed p-4 text-center space-y-2 relative">
      {canRemove && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-1 right-1 h-6 w-6 p-0"
          onClick={onClear}
          aria-label="Supprimer cet emplacement"
        >
          <X className="w-3 h-3" />
        </Button>
      )}
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
