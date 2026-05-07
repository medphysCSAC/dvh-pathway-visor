import { useState, useEffect, useRef } from 'react';
import { Structure } from '@/types/dvh';
import {
  TreatmentProtocol, ValidationReport,
  StructureMapping as StructureMappingType, SummationReportInfo,
} from '@/types/protocol';
import { getAllProtocols } from '@/data/predefinedProtocols';
import { generateValidationReport, findBestStructureMatch } from '@/utils/protocolValidator';
import { generateAndDownloadPDF, ReportTemplate } from '@/utils/pdfGenerator';
import { calculatePTVQualityMetrics } from '@/utils/planQualityMetrics';
import { autoMapStructures, toStructureMappings } from '@/utils/structureMappingUtils';
import type { SummedPlanResult } from '@/utils/planSummationDicom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAnalysisHistory } from '@/hooks/useAnalysisHistory';
import { FileDown, AlertTriangle, CheckCircle2, XCircle, AlertCircle, Target, Zap } from 'lucide-react';
import StructureMapping from './StructureMapping';
import ExportReportDialog from './ExportReportDialog';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProtocolValidationProps {
  structures: Structure[];
  patientId: string;
  summationResult?: SummedPlanResult | null;
  preselectedProtocol?: TreatmentProtocol | null;
  preselectedMapping?: StructureMappingType[];
  onProtocolConfirmed?: (protocol: TreatmentProtocol, mappings: StructureMappingType[]) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getAllProtocolStructureNames = (protocol: TreatmentProtocol): string[] => {
  const oar = protocol.oarConstraints.map(c => c.structure);
  const ptv = protocol.prescriptions.map(p => p.ptvName);
  return [...new Set([...oar, ...ptv])];
};

const buildAutoMappings = (
  protocol: TreatmentProtocol,
  dvhStructures: Structure[]
): StructureMappingType[] => toStructureMappings(autoMapStructures(dvhStructures, protocol));

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ProtocolValidation({
  structures,
  patientId,
  summationResult,
  preselectedProtocol,
  preselectedMapping,
  onProtocolConfirmed,
}: ProtocolValidationProps) {
  const { toast } = useToast();
  const { addToHistory } = useAnalysisHistory();
  const [protocols, setProtocols] = useState<TreatmentProtocol[]>([]);
  const [selectedProtocolId, setSelectedProtocolId] = useState<string>('');
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [mappings, setMappings] = useState<StructureMappingType[]>([]);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // ── GARDE anti-boucle ─────────────────────────────────────────────────────
  // Mémorise le dernier protocolId appliqué depuis preselectedProtocol.
  // Empêche le useEffect de se ré-exécuter si le même protocole est déjà actif.
  const appliedPreselectedIdRef = useRef<string | null>(null);

  // ── Chargement protocoles ─────────────────────────────────────────────────
  useEffect(() => {
    const loadProtocols = async () => {
      const allProtocols = await getAllProtocols();
      const archivedSet = new Set<string>(
        JSON.parse(localStorage.getItem('archived-protocols') || '[]')
      );
      setProtocols(allProtocols.filter(p => !archivedSet.has(p.id)));
    };
    loadProtocols();
  }, []);

  // ── Reset de la garde quand le protocole pré-sélectionné change vraiment ──
  useEffect(() => {
    if (preselectedProtocol?.id !== appliedPreselectedIdRef.current) {
      appliedPreselectedIdRef.current = null;
    }
  }, [preselectedProtocol?.id]);

  // ── Application du protocole pré-sélectionné (FIX 2) ─────────────────────
  // RÈGLES :
  //   • S'exécute UNE SEULE fois par protocole (garde useRef)
  //   • PAS de toast (l'utilisateur l'a déjà vu dans l'onglet DVH)
  //   • Utilise le mapping déjà construit dans l'onglet DVH si disponible
  useEffect(() => {
    if (!preselectedProtocol || protocols.length === 0) return;
    if (appliedPreselectedIdRef.current === preselectedProtocol.id) return;

    const found = protocols.find(p => p.id === preselectedProtocol.id);
    if (!found) return;

    appliedPreselectedIdRef.current = preselectedProtocol.id;
    setSelectedProtocolId(found.id);
    setReport(null);

    const mappingsToApply =
      preselectedMapping && preselectedMapping.length > 0
        ? preselectedMapping
        : buildAutoMappings(found, structures);

    setMappings(mappingsToApply);
  }, [preselectedProtocol, protocols, preselectedMapping, structures]);

  // ── Changement via le Select local ───────────────────────────────────────
  // FIX BUG 1 : AUCUN toast — le bandeau visuel suffit, les toasts créaient la boucle
  const handleProtocolChange = (protocolId: string) => {
    setSelectedProtocolId(protocolId);
    setReport(null);

    const protocol = protocols.find(p => p.id === protocolId);
    if (!protocol) { setMappings([]); return; }

    const autoMappings = buildAutoMappings(protocol, structures);
    setMappings(autoMappings);

    // Synchroniser la garde pour éviter que le useEffect re-applique
    appliedPreselectedIdRef.current = protocolId;

    // Notifier Index (FIX 2 — persistance inter-onglets)
    onProtocolConfirmed?.(protocol, autoMappings);
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const handleValidate = () => {
    const protocol = protocols.find(p => p.id === selectedProtocolId);
    if (!protocol) {
      toast({ title: 'Erreur', description: 'Veuillez sélectionner un protocole', variant: 'destructive' });
      return;
    }

    let summationInfo: SummationReportInfo | undefined;
    if (summationResult && summationResult.info?.planNames?.length >= 2) {
      const totalDose =
        summationResult.info.planDetails?.every(d => d.dose !== undefined)
          ? summationResult.info.planDetails!.reduce((sum, d) => sum + (d.dose ?? 0), 0)
          : summationResult.info.maxDose;
      summationInfo = {
        planNames: summationResult.info.planNames,
        planDetails: summationResult.info.planDetails,
        method: summationResult.summationMethod,
        totalDose: totalDose ? +totalDose.toFixed(2) : undefined,
        warnings: summationResult.warnings,
        matchedStructures: summationResult.info.matchedStructures,
        unmatchedStructures: summationResult.info.unmatchedStructures,
      };
    }

    const validationReport = generateValidationReport(
      protocol, structures, patientId, mappings, summationInfo
    );
    setReport(validationReport);
    addToHistory({ patientId, protocolName: protocol.name, overallStatus: validationReport.overallStatus, report: validationReport });

    toast({
      title: 'Validation terminée',
      description:
        validationReport.overallStatus === 'PASS' ? 'Toutes les contraintes sont respectées ✅' :
        validationReport.overallStatus === 'FAIL' ? 'Contraintes obligatoires non respectées ❌' :
        'Contraintes optimales non atteintes ⚠️',
    });
  };

  const handleExport = async (
    _format: 'pdf', overallStatus: 'PASS' | 'FAIL',
    doctorName: string, template: ReportTemplate, observations?: string
  ) => {
    if (!report) return;
    try {
      setIsExportingPDF(true);
      await generateAndDownloadPDF(report, template, overallStatus, doctorName, observations);
    } catch {
      toast({ title: 'Erreur d\'export', description: 'Impossible de générer le rapport', variant: 'destructive' });
    } finally {
      setIsExportingPDF(false);
    }
  };

  // ── Helpers affichage ─────────────────────────────────────────────────────
  const getStatusIcon = (status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_EVALUATED') => {
    switch (status) {
      case 'PASS':    return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'FAIL':    return <XCircle className="h-4 w-4 text-destructive" />;
      case 'WARNING': return <AlertTriangle className="h-4 w-4 text-warning" />;
      default:        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_EVALUATED') => {
    const variants = { PASS: 'default', FAIL: 'destructive', WARNING: 'secondary', NOT_EVALUATED: 'outline' } as const;
    return <Badge variant={variants[status]} className="gap-1">{getStatusIcon(status)} {status}</Badge>;
  };

  const selectedProtocol = protocols.find(p => p.id === selectedProtocolId);
  const totalProtocolStructures = selectedProtocol ? getAllProtocolStructureNames(selectedProtocol).length : 0;
  const autoMatchedCount = mappings.length;

  const structuresForMappingDialog: string[] = report
    ? report.unmatchedStructures
    : selectedProtocol
    ? getAllProtocolStructureNames(selectedProtocol).filter(
        name => !mappings.some(m => m.protocolStructureName === name)
      )
    : [];

  const allResolved = structuresForMappingDialog.length === 0;

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      <Card>
        <CardHeader>
          <CardTitle>Validation du Plan de Traitement</CardTitle>
          <CardDescription>
            Sélectionnez un protocole — le mapping s'effectue automatiquement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-2 block">Protocole</label>
              <Select value={selectedProtocolId} onValueChange={handleProtocolChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un protocole..." />
                </SelectTrigger>
                <SelectContent>
                  {protocols.map(protocol => (
                    <SelectItem key={protocol.id} value={protocol.id}>
                      {protocol.name}{protocol.isCustom && ' (Personnalisé)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Patient ID</label>
              <div className="h-10 px-3 border rounded-md flex items-center bg-muted">
                <span className="font-mono">{patientId}</span>
              </div>
            </div>
          </div>

          {/* Bandeau statut mapping — remplace tous les toasts de mapping */}
          {selectedProtocol && (
            <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
              allResolved
                ? 'border-success/40 bg-success/5 text-success'
                : 'border-warning/40 bg-warning/5 text-warning-foreground'
            }`}>
              {allResolved ? (
                <><Zap className="h-4 w-4 shrink-0 text-success" />
                  <span><strong>{autoMatchedCount}/{totalProtocolStructures}</strong> structures mappées — prêt pour validation</span>
                </>
              ) : (
                <><AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>{autoMatchedCount}/{totalProtocolStructures}</strong> structures mappées —{' '}
                    <strong>{structuresForMappingDialog.length}</strong> à corriger manuellement ci-dessous
                  </span>
                </>
              )}
            </div>
          )}

          <Button onClick={handleValidate} disabled={!selectedProtocolId} className="w-full">
            Lancer la validation
          </Button>
        </CardContent>
      </Card>

      {/* Mapping manuel — structures non résolues uniquement */}
      {selectedProtocol && (
        <StructureMapping
          unmatchedStructures={structuresForMappingDialog}
          availableStructures={structures}
          onMappingsChange={setMappings}
          protocolId={selectedProtocolId}
          protocol={selectedProtocol}
          currentMappings={mappings}
        />
      )}

      {/* Résultats */}
      {report && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Résultats de la Validation</CardTitle>
                  <CardDescription>Protocole : {report.protocolName} • Patient : {report.patientId}</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(report.overallStatus)}
                  <Button onClick={() => setExportDialogOpen(true)} variant="default" size="sm">
                    <FileDown className="h-4 w-4 mr-2" />Exporter le Rapport
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {selectedProtocol && selectedProtocol.prescriptions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" />Évaluation des PTVs</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const ptvResults = selectedProtocol.prescriptions.map(prescription => {
                    const ptvStructure = findBestStructureMatch(prescription.ptvName, structures, mappings);
                    if (!ptvStructure) return { prescription, structure: null, metrics: null };
                    return { prescription, structure: ptvStructure, metrics: calculatePTVQualityMetrics(ptvStructure, structures, prescription.totalDose) };
                  });
                  if (ptvResults.every(r => !r.structure)) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">Aucun PTV trouvé — utilisez le mapping ci-dessus</p>
                      </div>
                    );
                  }
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead><tr className="border-b">{['PTV','D95%','D98%','D50%','D2%','HI','CI','CN'].map(h=><th key={h} className="text-left p-2">{h}</th>)}</tr></thead>
                        <tbody>
                          {ptvResults.map((r, i) => !r.metrics ? (
                            <tr key={i} className="border-b bg-destructive/5">
                              <td className="p-2 font-medium text-destructive" colSpan={8}>
                                <div className="flex items-center gap-2"><XCircle className="h-4 w-4"/>{r.prescription.ptvName} — Non trouvé</div>
                              </td>
                            </tr>
                          ) : (
                            <tr key={i} className="border-b">
                              <td className="p-2 font-medium">{r.metrics.structureName}</td>
                              <td className="p-2 font-mono">{r.metrics.d95.toFixed(2)} Gy</td>
                              <td className="p-2 font-mono">{r.metrics.d98.toFixed(2)} Gy</td>
                              <td className="p-2 font-mono">{r.metrics.d50.toFixed(2)} Gy</td>
                              <td className="p-2 font-mono">{r.metrics.d2.toFixed(2)} Gy</td>
                              <td className="p-2 font-mono">{r.metrics.hi.toFixed(3)}</td>
                              <td className="p-2 font-mono">{r.metrics.ci.toFixed(3)}</td>
                              <td className="p-2 font-mono">{r.metrics.cn.toFixed(3)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>🛡️ Contraintes OAR</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b">{['Organe','Contrainte','Mesuré','Seuil','Observation'].map(h=><th key={h} className="text-left p-2">{h}</th>)}</tr></thead>
                  <tbody>
                    {report.constraintResults.map((cr, idx) => {
                      const constraintDesc = cr.constraint.constraintType === 'Vx' ? `V${cr.constraint.target}Gy` : cr.constraint.constraintType === 'Dx' ? `D${cr.constraint.target}%` : cr.constraint.constraintType;
                      const measuredUnit = cr.constraint.constraintType === 'Vx' ? (cr.constraint.targetUnit || '%') : cr.constraint.unit;
                      return (
                        <tr key={idx} className="border-b">
                          <td className="p-2">
                            <div className="font-medium">{cr.structureName}</div>
                            {cr.constraint.description && <div className="text-xs text-muted-foreground mt-0.5">{cr.constraint.description}</div>}
                          </td>
                          <td className="p-2 font-mono text-sm">{constraintDesc}</td>
                          <td className="p-2 font-mono">{cr.measuredValue.toFixed(1)} {measuredUnit}</td>
                          <td className="p-2 font-mono">&lt; {cr.constraint.value} {measuredUnit}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={cr.status === 'PASS' ? 'default' : cr.status === 'FAIL' ? 'destructive' : 'secondary'}
                                className={`gap-1 ${cr.status === 'PASS' ? 'bg-green-600 hover:bg-green-700 text-white' : cr.status === 'WARNING' ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}`}>
                                {getStatusIcon(cr.status)} {cr.status}
                              </Badge>
                              {cr.status === 'WARNING' && <span className="text-xs text-muted-foreground">(contrainte optimale)</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {report.unmatchedStructures.length > 0 && (
            <Card className="border-warning">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-5 w-5" />Structures Non Trouvées
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {report.unmatchedStructures.map(s => <Badge key={s} variant="outline">{s}</Badge>)}
                </div>
                <p className="text-sm text-muted-foreground mt-3">💡 Corrigez le mapping ci-dessus puis relancez la validation.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <ExportReportDialog report={report} open={exportDialogOpen} onOpenChange={setExportDialogOpen} onExport={handleExport} isExporting={isExportingPDF} />
    </div>
  );
}
