import { useState, useEffect } from 'react';
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
import { CriticalDoseAlerts } from '@/components/CriticalDoseAlerts';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { PatientBar } from '@/components/PatientBar';
import { ProtocolPromptBanner } from '@/components/ProtocolPromptBanner';
import { ProtocolSelectorDialog } from '@/components/ProtocolSelectorDialog';
import { ToolsMenu, ToolKey } from '@/components/ToolsMenu';
import { DVHData, StructureCategory, PlanData } from '@/types/dvh';
import { TreatmentProtocol, StructureMapping } from '@/types/protocol';
import type { SummedPlanResult } from '@/utils/planSummationDicom';
import { summatePlans } from '@/utils/planSummation';
import { parseTomoTherapyDVH } from '@/utils/dvhParser';
import { checkCriticalDoses, DoseAlert } from '@/utils/criticalDoseAlerts';
import { convertDicomDVHToAppFormat } from '@/utils/dicomRTParser';
import { DicomRTData } from '@/types/dicomRT';
import { toast } from 'sonner';
import { Activity, BarChart3, CheckSquare, ArrowLeft } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

const TOOL_TITLES: Record<ToolKey, string> = {
  protocols: 'Gérer les protocoles',
  converter: 'Convertisseur de documents',
  history:   'Historique des analyses',
  help:      'Aide',
};

const Index = () => {
  const [dvhData, setDvhData] = useState<DVHData | null>(null);
  const [selectedStructures, setSelectedStructures] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<StructureCategory | 'ALL'>('ALL');
  const [comparisonPlans, setComparisonPlans] = useState<PlanData[]>([]);
  const [comparisonMode, setComparisonMode] = useState<'summation' | 'comparison' | 'multi-patient' | null>(null);
  const [criticalAlerts, setCriticalAlerts] = useState<DoseAlert[]>([]);
  const [lastSummationResult, setLastSummationResult] = useState<SummedPlanResult | null>(null);
  const [activeProtocol, setActiveProtocol] = useState<TreatmentProtocol | null>(null);
  const [structureMappings, setStructureMappings] = useState<StructureMapping[]>([]);

  // Navigation simplifiée — 2 onglets quand un plan est chargé
  const [mainTab, setMainTab] = useState<'analyze' | 'validation'>('analyze');

  // Vue outil plein écran (sans plan ou en surcouche)
  const [toolView, setToolView] = useState<ToolKey | null>(null);

  // Dialog sélecteur de protocole
  const [protocolDialogOpen, setProtocolDialogOpen] = useState(false);

  useEffect(() => {
    if (dvhData) setMainTab('analyze');
  }, [dvhData]);

  useEffect(() => {
    if (dvhData?.structures) {
      const alerts = checkCriticalDoses(dvhData.structures);
      setCriticalAlerts(alerts);
      const critical = alerts.filter(a => a.severity === 'critical').length;
      if (critical > 0) {
        toast.error(`${critical} dépassement${critical > 1 ? 's' : ''} critique${critical > 1 ? 's' : ''} détecté${critical > 1 ? 's' : ''}`, {
          description: 'Vérifiez les alertes de dose',
        });
      } else if (alerts.length > 0) {
        toast.warning(`${alerts.length} avertissement${alerts.length > 1 ? 's' : ''} de dose`);
      }
    } else {
      setCriticalAlerts([]);
    }
  }, [dvhData]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleFilesUploaded = async (relFile: File, absFile?: File) => {
    try {
      const relContent = await relFile.text();
      const absContent = absFile ? await absFile.text() : undefined;
      const data = parseTomoTherapyDVH(relContent, absContent);
      const match = relFile.name.match(/(\d+-\d+)/);
      if (match) data.patientId = match[1];
      setDvhData(data);
      setSelectedStructures([]);
      toast.success('Fichiers DVH chargés', {
        description: `${data.structures.length} structures détectées`,
      });
      if (!absFile) {
        toast.warning('DVH ABS non fourni', {
          description: 'Certaines métriques en cc nécessitent le fichier ABS',
        });
      }
    } catch {
      toast.error('Erreur de chargement', { description: 'Vérifiez le format des fichiers DVH' });
    }
  };

  const handleDicomRTLoaded = (data: DicomRTData, protocol?: TreatmentProtocol) => {
    if (data.structures && data.dose?.dvhs) {
      const convertedDVH = convertDicomDVHToAppFormat(data.structures, data.dose.dvhs);
      const newDvhData: DVHData = {
        patientId: data.patientId || 'DICOM Patient',
        structures: convertedDVH.map((dvh) => {
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
      if (protocol) {
        setActiveProtocol(protocol);
        toast.success(`Protocole "${protocol.name}" associé`, {
          description: 'Les contraintes sont visibles sur les courbes DVH',
        });
      } else {
        toast.success('DICOM RT importé', {
          description: `${newDvhData.structures.length} structures chargées`,
        });
      }
    } else if (data.structures) {
      toast.info('Structures détectées sans DVH', {
        description: 'Chargez un fichier RTDOSE pour les courbes',
      });
    }
  };

  const handlePlansLoaded = (
    plans: PlanData[],
    mode: 'summation' | 'comparison' | 'multi-patient'
  ) => {
    setComparisonPlans(plans);
    setComparisonMode(mode);
    if (mode === 'summation') {
      const summated = summatePlans(plans);
      setDvhData({ patientId: summated.patientId, structures: summated.structures });
      setSelectedStructures([]);
    } else if (mode === 'comparison') {
      setDvhData({ patientId: plans[0].patientId, structures: plans[0].structures });
      const common = plans[0].structures
        .map(s => s.name)
        .filter(name => plans.every(p => p.structures.some(s => s.name === name)));
      setSelectedStructures(common);
      if (common.length === 0) {
        toast.warning('Aucune structure commune', {
          description: 'Sélectionnez les structures manuellement',
        });
      }
    }
  };

  const handleDicomSummationComplete = (data: DVHData, result?: SummedPlanResult) => {
    setDvhData(data);
    setSelectedStructures([]);
    setLastSummationResult(result ?? null);
    toast.success('Sommation DICOM appliquée', {
      description: `${data.structures.length} structures sommées`,
    });
  };

  const handleStructureToggle = (name: string) =>
    setSelectedStructures(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );

  const handleFilterChange = (category: StructureCategory | 'ALL') => {
    setActiveFilter(category);
    if (!dvhData) return;
    setSelectedStructures(
      category === 'ALL' ? [] : dvhData.structures.filter(s => s.category === category).map(s => s.name)
    );
  };

  const handleSelectAll = () => dvhData && setSelectedStructures(dvhData.structures.map(s => s.name));
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

  const handleChangePlan = () => {
    setDvhData(null);
    setSelectedStructures([]);
    setComparisonPlans([]);
    setComparisonMode(null);
    setCriticalAlerts([]);
    setLastSummationResult(null);
    setActiveProtocol(null);
    setStructureMappings([]);
    setToolView(null);
  };

  const handleProtocolConfirmed = (p: TreatmentProtocol, mappings: StructureMapping[]) => {
    setActiveProtocol(p);
    setStructureMappings(mappings);
    toast.success(`Protocole "${p.name}" activé`, {
      description: `${mappings.length} structure(s) associée(s)`,
    });
  };

  const handleClearProtocol = () => {
    setActiveProtocol(null);
    setStructureMappings([]);
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderToolView = () => {
    if (!toolView) return null;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setToolView(null)} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
            <h2 className="text-lg font-semibold">{TOOL_TITLES[toolView]}</h2>
          </div>
        </div>
        {toolView === 'protocols' && (
          <ProtocolManager
            onProtocolSelect={(p) => {
              setActiveProtocol(p);
              toast.success(`Protocole "${p.name}" sélectionné`);
              setToolView(null);
            }}
          />
        )}
        {toolView === 'converter' && <ProtocolDocumentConverter />}
        {toolView === 'history'   && <AnalysisHistory />}
        {toolView === 'help'      && <HelpGuide />}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <InteractiveTour />

      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-gradient-to-br from-primary to-accent p-2.5">
                <Activity className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  DVH Analyzer
                </h1>
                <p className="text-xs text-muted-foreground">
                  Analyse DVH & Validation des plans — Centre Sidi Abdellah de Cancérologie d'Alger
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ToolsMenu onSelect={(t) => setToolView(t)} />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">

          {/* Vue outil plein écran (prioritaire) */}
          {toolView && renderToolView()}

          {/* État 1 : aucun plan, aucune vue outil → WelcomeScreen */}
          {!toolView && !dvhData && (
            <WelcomeScreen
              onCsvLoaded={handleFilesUploaded}
              onDicomLoaded={handleDicomRTLoaded}
              onPlansLoaded={handlePlansLoaded}
              onSummationComplete={handleDicomSummationComplete}
            />
          )}

          {/* État 2 : plan chargé */}
          {!toolView && dvhData && (
            <>
              <PatientBar
                dvhData={dvhData}
                selectedCount={selectedStructures.length}
                activeProtocol={activeProtocol}
                comparisonMode={comparisonMode}
                comparisonPlanCount={comparisonPlans.length}
                onChangePlan={handleChangePlan}
                onClearProtocol={handleClearProtocol}
                onPickProtocol={() => setProtocolDialogOpen(true)}
              />

              <CriticalDoseAlerts alerts={criticalAlerts} />

              {!activeProtocol && (
                <ProtocolPromptBanner onPickProtocol={() => setProtocolDialogOpen(true)} />
              )}

              <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'analyze' | 'validation')} className="w-full">
                <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
                  <TabsTrigger value="analyze" className="flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4" />
                    Analyse
                  </TabsTrigger>
                  <TabsTrigger value="validation" className="flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4" />
                    Validation
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="analyze" className="mt-4 space-y-6">
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
                    activeProtocol={activeProtocol}
                    comparePlans={
                      comparisonMode === 'comparison' && comparisonPlans.length > 1
                        ? comparisonPlans.slice(1).map(p => ({
                            label: p.name || p.patientId,
                            structures: p.structures,
                          }))
                        : undefined
                    }
                    mainPlanLabel={
                      comparisonMode === 'comparison'
                        ? (comparisonPlans[0]?.name || comparisonPlans[0]?.patientId)
                        : undefined
                    }
                  />
                  <UnifiedMetricsCalculator
                    structures={dvhData.structures}
                    selectedStructures={selectedStructures}
                  />
                  {comparisonMode === 'comparison' && comparisonPlans.length > 1 && (
                    <PlanComparison plans={comparisonPlans} />
                  )}
                  <StructureTable
                    structures={dvhData.structures}
                    selectedStructures={selectedStructures}
                    onStructureToggle={handleStructureToggle}
                    onCategoryChange={handleCategoryChange}
                  />
                  <PlanEvaluation
                    structures={dvhData.structures}
                    patientId={dvhData.patientId}
                  />
                </TabsContent>

                <TabsContent value="validation" className="mt-4">
                  <ProtocolValidation
                    structures={dvhData.structures}
                    patientId={dvhData.patientId}
                    summationResult={lastSummationResult}
                    controlledProtocol={activeProtocol}
                    controlledMappings={structureMappings}
                    onProtocolConfirmed={handleProtocolConfirmed}
                    onRequestChangeProtocol={() => setProtocolDialogOpen(true)}
                    onProtocolChange={setActiveProtocol}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}

          {/* Sélecteur de protocole — Dialog unifié (utilisable quand plan chargé) */}
          {dvhData && (
            <ProtocolSelectorDialog
              open={protocolDialogOpen}
              onOpenChange={setProtocolDialogOpen}
              structures={dvhData.structures}
              initialProtocol={activeProtocol}
              initialMappings={structureMappings}
              onConfirm={handleProtocolConfirmed}
            />
          )}

        </div>
      </main>

      <footer className="border-t mt-16 py-4 bg-card/30">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          DVH Analyzer — Centre Sidi Abdellah de Cancérologie d'Alger
        </div>
      </footer>
    </div>
  );
};

export default Index;
