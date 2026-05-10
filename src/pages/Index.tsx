import { useState, useEffect } from 'react';
import { UnifiedPlanUpload } from '@/components/UnifiedPlanUpload';
import { MultiFileUpload } from '@/components/MultiFileUpload';
import { PlanComparison } from '@/components/PlanComparison';
import { ProtocolDocumentConverter } from '@/components/ProtocolDocumentConverter';
import { DVHChart } from '@/components/DVHChart';
import { StructureTable } from '@/components/StructureTable';
import { FilterBar } from '@/components/FilterBar';
import { PlanEvaluation } from '@/components/PlanEvaluation';
import UnifiedMetricsCalculator from '@/components/UnifiedMetricsCalculator';
import ProtocolValidation from '@/components/ProtocolValidation';
import ProtocolManager from '@/components/ProtocolManager';
import AnalysisHistory from '@/components/AnalysisHistory';
import HelpGuide from '@/components/HelpGuide';
import { ThemeToggle } from '@/components/ThemeToggle';
import { InteractiveTour } from '@/components/InteractiveTour';
import { ContextualHelp } from '@/components/ContextualHelp';
import { CriticalDoseAlerts } from '@/components/CriticalDoseAlerts';
import DVHComparisonDebug from '@/components/DVHComparisonDebug';
import DVHSourceComparison from '@/components/DVHSourceComparison';
import { PlanSummationManager } from '@/components/PlanSummationManager';
import PatientBar from '@/components/PatientBar';
import { ProtocolPromptBanner } from '@/components/ProtocolPromptBanner';
import { ProtocolSelectorDialog } from '@/components/ProtocolSelectorDialog';
import { WelcomeScreen } from '@/components/WelcomeScreen';
// FIX BUG 2 : StructureMapping importé ici pour l'afficher dans l'onglet DVH
import StructureMapping from '@/components/StructureMapping';
import NTCPTCPAnalysis from '@/components/NTCPTCPAnalysis';
import type { SummedPlanResult } from '@/utils/planSummationDicom';
import { DVHData, StructureCategory, PlanData, Structure } from '@/types/dvh';
import { TreatmentProtocol, StructureMapping as StructureMappingType } from '@/types/protocol';
import { autoMapStructures, toStructureMappings, getUnresolvedStructures } from '@/utils/structureMappingUtils';
import { summatePlans } from '@/utils/planSummation';
import { parseTomoTherapyDVH, findMaxDoseAcrossStructures } from '@/utils/dvhParser';
import { checkCriticalDoses, DoseAlert } from '@/utils/criticalDoseAlerts';
import { convertDicomDVHToAppFormat } from '@/utils/dicomRTParser';
import { DicomRTData } from '@/types/dicomRT';
import { toast } from 'sonner';
import { Activity, Bug } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Index = () => {
  const [dvhData, setDvhData] = useState<DVHData | null>(null);
  const [selectedStructures, setSelectedStructures] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<StructureCategory | 'ALL'>('ALL');
  const [comparisonPlans, setComparisonPlans] = useState<PlanData[]>([]);
  const [comparisonMode, setComparisonMode] = useState<'summation' | 'comparison' | 'multi-patient' | null>(null);
  const [criticalAlerts, setCriticalAlerts] = useState<DoseAlert[]>([]);
  const [lastSummationResult, setLastSummationResult] = useState<SummedPlanResult | null>(null);
  const [dvhParserStructures, setDvhParserStructures] = useState<Structure[] | null>(null);
  const [dicomRTStructures, setDicomRTStructures] = useState<Structure[] | null>(null);

  // ── Store partagé protocole + mapping (source de vérité unique) ───────────
  const [sharedProtocol, setSharedProtocol] = useState<TreatmentProtocol | null>(null);
  const [sharedMappings, setSharedMappings] = useState<StructureMappingType[]>([]);
  const [protocolSelectorOpen, setProtocolSelectorOpen] = useState(false);

  // Structures non résolues par l'auto-mapping (calculées à partir du store partagé)
  // Affichées dans l'onglet DVH pour mapping manuel immédiat
  const unresolvedStructureNames: string[] = sharedProtocol && dvhData
    ? getUnresolvedStructures(autoMapStructures(dvhData.structures, sharedProtocol))
      .filter(name => !sharedMappings.some(m => m.protocolStructureName === name))
    : [];

  // ── Alertes doses critiques ───────────────────────────────────────────────
  useEffect(() => {
    if (!dvhData?.structures) { setCriticalAlerts([]); return; }
    const alerts = checkCriticalDoses(dvhData.structures);
    setCriticalAlerts(alerts);
    const criticalCount = alerts.filter(a => a.severity === 'critical').length;
    if (criticalCount > 0) {
      toast.error(`${criticalCount} dépassement${criticalCount > 1 ? 's' : ''} critique${criticalCount > 1 ? 's' : ''} détecté${criticalCount > 1 ? 's' : ''}`, {
        description: 'Vérifiez les alertes de dose en haut de la page',
      });
    } else if (alerts.length > 0) {
      toast.warning(`${alerts.length} avertissement${alerts.length > 1 ? 's' : ''} de dose`);
    }
  }, [dvhData]);

  // ── Sélection protocole depuis PatientBar / ProtocolPromptBanner ──────────
  /**
   * Point d'entrée UNIQUE pour tout changement de protocole.
   * 1. Lance l'auto-mapping
   * 2. Met à jour le store partagé
   * 3. Affiche UN SEUL toast informatif
   */
  const handleProtocolSelected = (protocol: TreatmentProtocol) => {
    if (!dvhData) return;

    const results = autoMapStructures(dvhData.structures, protocol);
    const autoMappings = toStructureMappings(results);
    const unresolved = getUnresolvedStructures(results);

    setSharedProtocol(protocol);
    setSharedMappings(autoMappings);
    setProtocolSelectorOpen(false);

    // UN SEUL toast — pas de doublon
    if (unresolved.length === 0) {
      toast.success(`Protocole "${protocol.name}" associé`, {
        description: `${autoMappings.length} structures mappées automatiquement ✓`,
      });
    } else {
      toast.info(`Protocole "${protocol.name}" associé`, {
        description: `${autoMappings.length} structures mappées — ${unresolved.length} à corriger dans le mapping ci-dessous`,
      });
    }
  };

  /** Callback remontant depuis ProtocolValidation si l'utilisateur change de protocole dans cet onglet */
  const handleProtocolConfirmedFromValidation = (
    protocol: TreatmentProtocol,
    mappings: StructureMappingType[]
  ) => {
    setSharedProtocol(protocol);
    setSharedMappings(mappings);
    // Pas de toast : ProtocolValidation gère son propre retour visuel (bandeau)
  };

  const handleClearProtocol = () => {
    setSharedProtocol(null);
    setSharedMappings([]);
  };

  // ── Reset quand un nouveau plan est chargé ────────────────────────────────
  const resetSession = () => {
    setSharedProtocol(null);
    setSharedMappings([]);
    setLastSummationResult(null);
  };

  // ── Handlers fichiers ─────────────────────────────────────────────────────
  const handleFilesUploaded = async (relFile: File, absFile?: File) => {
    try {
      const relContent = await relFile.text();
      const absContent = absFile ? await absFile.text() : undefined;
      const data = parseTomoTherapyDVH(relContent, absContent);
      const patientIdMatch = relFile.name.match(/(\d+-\d+)/);
      if (patientIdMatch) data.patientId = patientIdMatch[1];
      setDvhData(data);
      setSelectedStructures([]);
      setDvhParserStructures(data.structures);
      resetSession();
      toast.success('Fichiers DVH chargés', {
        description: `${data.structures.length} structures détectées`,
      });
      if (!absFile) {
        toast.warning('DVH ABS non fourni', {
          description: 'Certaines métriques en cc nécessiteront le fichier ABS.',
        });
      }
    } catch (error) {
      console.error('Error parsing DVH files:', error);
      toast.error('Erreur lors du chargement', { description: 'Vérifiez le format des fichiers DVH' });
    }
  };

  const handleStructureToggle = (structureName: string) => {
    setSelectedStructures(prev =>
      prev.includes(structureName) ? prev.filter(n => n !== structureName) : [...prev, structureName]
    );
  };

  const handleFilterChange = (category: StructureCategory | 'ALL') => {
    setActiveFilter(category);
    if (!dvhData) return;
    setSelectedStructures(
      category === 'ALL' ? [] : dvhData.structures.filter(s => s.category === category).map(s => s.name)
    );
  };

  const handleSelectAll = () => { if (dvhData) setSelectedStructures(dvhData.structures.map(s => s.name)); };
  const handleDeselectAll = () => setSelectedStructures([]);

  const handleCategoryChange = (structureName: string, newCategory: StructureCategory) => {
    if (!dvhData) return;
    setDvhData({
      ...dvhData,
      structures: dvhData.structures.map(s =>
        s.name === structureName ? { ...s, category: newCategory } : s
      ),
    });
  };

  const handlePlansLoaded = (plans: PlanData[], mode: 'summation' | 'comparison' | 'multi-patient') => {
    setComparisonPlans(plans);
    setComparisonMode(mode);
    resetSession();
    if (mode === 'summation') {
      const summatedPlan = summatePlans(plans);
      setDvhData({ patientId: summatedPlan.patientId, structures: summatedPlan.structures });
      setSelectedStructures([]);
    } else if (mode === 'comparison') {
      setDvhData({ patientId: plans[0].patientId, structures: plans[0].structures });
      setSelectedStructures([]);
    }
  };

  const handleDicomRTLoaded = (data: DicomRTData) => {
    if (data.structures && data.dose?.dvhs) {
      const convertedDVH = convertDicomDVHToAppFormat(data.structures, data.dose.dvhs);
      const newDvhData: DVHData = {
        patientId: data.patientId || 'DICOM Patient',
        structures: convertedDVH.map(dvh => {
          const totalVol = dvh.absoluteVolume || 0;
          const absoluteCumulative = totalVol > 0
            ? dvh.relativeVolume.map(p => ({ dose: p.dose, volume: (p.volume / 100) * totalVol }))
            : [];
          return {
            name: dvh.name,
            type: 'STANDARD' as const,
            category: dvh.name.toUpperCase().startsWith('PTV') ? 'PTV' as const : 'OAR' as const,
            relativeVolume: dvh.relativeVolume,
            absoluteVolume: absoluteCumulative,
            differentialRelativeVolume: dvh.differentialRelativeVolume,
            differentialAbsoluteVolume: dvh.differentialAbsoluteVolume,
            totalVolume: totalVol,
          };
        }),
      };
      setDvhData(newDvhData);
      setSelectedStructures([]);
      setDicomRTStructures(newDvhData.structures);
      resetSession();
      toast.success('DICOM RT importé', { description: `${newDvhData.structures.length} structures chargées` });
    } else if (data.structures) {
      toast.info('Structures détectées sans DVH', {
        description: `${data.structures.length} structures. Chargez un fichier RTDOSE.`,
      });
    }
  };

  const handleDicomSummationComplete = (data: DVHData, result?: SummedPlanResult) => {
    setDvhData(data);
    setSelectedStructures([]);
    setDicomRTStructures(data.structures);
    setLastSummationResult(result ?? null);
    resetSession();
    toast.success('Sommation DICOM appliquée', { description: `${data.structures.length} structures sommées` });
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <InteractiveTour />

      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-gradient-to-br from-primary to-accent p-2.5">
                <Activity className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  DVH Analyzer & Tomo-Plan validation tool
                </h1>
                <p className="text-sm text-muted-foreground">
                  Analyse des courbes Dose-Volume-Histogrames et validation des plans pour tomotherapy
                </p>
              </div>
            </div>
            <div data-tour="theme-toggle"><ThemeToggle /></div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">

          {/* Upload — affiché uniquement sans données */}
          {!dvhData && (
            <div className="max-w-5xl mx-auto space-y-6">
              <Tabs defaultValue="upload" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="upload">Charger un plan</TabsTrigger>
                  <TabsTrigger value="debug-compare" className="text-amber-600">
                    <Bug className="w-4 h-4 mr-1" />Debug Comparaison
                  </TabsTrigger>
                  <TabsTrigger value="multi">Comparer plans</TabsTrigger>
                  <TabsTrigger value="dicom-sum">Sommation DICOM</TabsTrigger>
                  <TabsTrigger value="converter">Convertisseur</TabsTrigger>
                </TabsList>
                <TabsContent value="upload" className="mt-6">
                  <div data-tour="file-upload">
                    <UnifiedPlanUpload onCsvLoaded={handleFilesUploaded} onDicomLoaded={handleDicomRTLoaded} />
                  </div>
                </TabsContent>
                <TabsContent value="debug-compare" className="mt-6 space-y-6">
                  <DVHSourceComparison
                    onDvhParserLoaded={s => setDvhParserStructures(s.length > 0 ? s : null)}
                    onDicomRTLoaded={s => setDicomRTStructures(s.length > 0 ? s : null)}
                    dvhParserStructures={dvhParserStructures}
                    dicomRTStructures={dicomRTStructures}
                  />
                  {(dvhParserStructures || dicomRTStructures) && (
                    <DVHComparisonDebug dvhParserStructures={dvhParserStructures} dicomRTStructures={dicomRTStructures} />
                  )}
                </TabsContent>
                <TabsContent value="multi" className="mt-6">
                  <MultiFileUpload onPlansLoaded={handlePlansLoaded} />
                </TabsContent>
                <TabsContent value="dicom-sum" className="mt-6">
                  <PlanSummationManager onSummationComplete={handleDicomSummationComplete} />
                </TabsContent>
                <TabsContent value="converter" className="mt-6">
                  <ProtocolDocumentConverter />
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Tabs principales */}
          <Tabs
            defaultValue={dvhData && comparisonMode === 'comparison' ? 'comparison' : dvhData ? 'dvh' : 'protocols'}
            className="w-full"
          >
            <TabsList data-tour="tabs" className="grid w-full max-w-6xl mx-auto grid-cols-9">
              <TabsTrigger value="dvh" disabled={!dvhData} className="flex items-center gap-1">
                Analyse DVH
                <ContextualHelp content="Visualisez et analysez les courbes dose-volume." side="bottom" />
              </TabsTrigger>
              <TabsTrigger value="comparison" disabled={comparisonMode !== 'comparison'} className="flex items-center gap-1">
                Comparaison
              </TabsTrigger>
              <TabsTrigger value="evaluation" disabled={!dvhData} className="flex items-center gap-1">
                Évaluation de plan
              </TabsTrigger>
              <TabsTrigger value="ntcp" disabled={!dvhData} className="flex items-center gap-1">
                NTCP / TCP
              </TabsTrigger>
              <TabsTrigger value="validation" disabled={!dvhData} className="flex items-center gap-1">
                Validation Protocole
                {/* Indicateur visuel : protocole actif */}
                {sharedProtocol && (
                  <span className="ml-1 h-2 w-2 rounded-full bg-success inline-block" title={`Protocole : ${sharedProtocol.name}`} />
                )}
              </TabsTrigger>
              <TabsTrigger value="protocols" data-tour="protocols">Gestion Protocoles</TabsTrigger>
              <TabsTrigger value="converter" data-tour="converter">Convertisseur</TabsTrigger>
              <TabsTrigger value="history" data-tour="history">Historique</TabsTrigger>
              <TabsTrigger value="help" data-tour="help">Aide</TabsTrigger>
            </TabsList>

            {dvhData && (
              <>
                <CriticalDoseAlerts alerts={criticalAlerts} />
                {(dvhParserStructures || dicomRTStructures) && (
                  <DVHComparisonDebug dvhParserStructures={dvhParserStructures} dicomRTStructures={dicomRTStructures} />
                )}

                {/* ── PatientBar — avec protocole actif et bouton pick ── */}
                <PatientBar
                  dvhData={dvhData}
                  selectedCount={selectedStructures.length}
                  activeProtocol={sharedProtocol}
                  comparisonMode={comparisonMode}
                  comparisonPlanCount={comparisonPlans.length}
                  onChangePlan={() => { setDvhData(null); resetSession(); }}
                  onClearProtocol={handleClearProtocol}
                  onPickProtocol={() => setProtocolSelectorOpen(true)}
                />

                {/* ── Analyse DVH ── */}
                <TabsContent value="dvh" className="space-y-6">

                  {/* Bannière invitation protocole (si aucun protocole actif) */}
                  {!sharedProtocol && (
                    <ProtocolPromptBanner onPickProtocol={() => setProtocolSelectorOpen(true)} />
                  )}

                  {/* ─── FIX BUG 2 : Mapping affiché ICI, dans l'onglet DVH ────────────
                      Dès qu'un protocole est sélectionné, le mapping apparaît dans l'onglet
                      DVH AVANT que l'utilisateur aille dans Validation.
                      Le composant StructureMapping se masque automatiquement si tout est résolu.
                  ──────────────────────────────────────────────────────────────────── */}
                  {sharedProtocol && (
                    <StructureMapping
                      unmatchedStructures={unresolvedStructureNames}
                      availableStructures={dvhData.structures}
                      onMappingsChange={newMappings => {
                        // Fusion avec les mappings auto existants
                        setSharedMappings(prev => {
                          const merged = [...prev];
                          for (const m of newMappings) {
                            const idx = merged.findIndex(x => x.protocolStructureName === m.protocolStructureName);
                            if (idx >= 0) merged[idx] = m;
                            else merged.push(m);
                          }
                          return merged;
                        });
                      }}
                      protocolId={sharedProtocol.id}
                      protocol={sharedProtocol}
                      currentMappings={sharedMappings}
                    />
                  )}

                  <FilterBar
                    structures={dvhData.structures}
                    selectedStructures={selectedStructures}
                    onFilterChange={handleFilterChange}
                    onSelectAll={handleSelectAll}
                    onDeselectAll={handleDeselectAll}
                    activeFilter={activeFilter}
                  />
                  <DVHChart
                    structures={dvhData.structures}
                    selectedStructures={selectedStructures}
                    onStructureToggle={handleStructureToggle}
                    onSelectAll={handleSelectAll}
                    onDeselectAll={handleDeselectAll}
                  />
                  <UnifiedMetricsCalculator structures={dvhData.structures} selectedStructures={selectedStructures} />
                  <StructureTable
                    structures={dvhData.structures}
                    selectedStructures={selectedStructures}
                    onStructureToggle={handleStructureToggle}
                    onCategoryChange={handleCategoryChange}
                  />
                </TabsContent>

                <TabsContent value="comparison">
                  {comparisonMode === 'comparison' && comparisonPlans.length > 0 && (
                    <PlanComparison plans={comparisonPlans} />
                  )}
                </TabsContent>

                <TabsContent value="evaluation">
                  <PlanEvaluation structures={dvhData.structures} patientId={dvhData.patientId} />
                </TabsContent>

                <TabsContent value="ntcp">
                  <NTCPTCPAnalysis
                    structures={dvhData.structures}
                    protocol={sharedProtocol}
                    mappings={sharedMappings}
                    onPickProtocol={() => setProtocolSelectorOpen(true)}
                  />
                </TabsContent>

                {/* ── Validation : reçoit le protocole + mapping déjà établis ── */}
                <TabsContent value="validation">
                  <ProtocolValidation
                    structures={dvhData.structures}
                    patientId={dvhData.patientId}
                    summationResult={lastSummationResult}
                    preselectedProtocol={sharedProtocol}
                    preselectedMapping={sharedMappings}
                    onProtocolConfirmed={handleProtocolConfirmedFromValidation}
                  />
                </TabsContent>

                <TabsContent value="protocols"><ProtocolManager /></TabsContent>
                <TabsContent value="converter"><ProtocolDocumentConverter /></TabsContent>
              </>
            )}

            <TabsContent value="protocols"><ProtocolManager /></TabsContent>
            <TabsContent value="converter"><ProtocolDocumentConverter /></TabsContent>
            <TabsContent value="history"><AnalysisHistory /></TabsContent>
            <TabsContent value="help"><HelpGuide /></TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Dialog sélection protocole — accessible depuis PatientBar + ProtocolPromptBanner */}
      {dvhData && (
        <ProtocolSelectorDialog
          open={protocolSelectorOpen}
          onOpenChange={setProtocolSelectorOpen}
          onSelect={handleProtocolSelected}
          structures={dvhData.structures}
          currentProtocol={sharedProtocol}
        />
      )}

      <footer className="border-t mt-16 py-6 bg-card/30">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>DVH Analyzer - Outil d'analyse pour plans de traitement de tomotherapy_ Centre Sidi Abdellah de Cancérologie d'Alger</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
