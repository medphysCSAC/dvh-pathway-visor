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
import { PlanSummationManager } from '@/components/PlanSummationManager';
import { DVHData, StructureCategory, PlanData, Structure } from '@/types/dvh';
import { TreatmentProtocol } from '@/types/protocol';
import type { SummedPlanResult } from '@/utils/planSummationDicom';
import { summatePlans } from '@/utils/planSummation';
import { parseTomoTherapyDVH, findMaxDoseAcrossStructures } from '@/utils/dvhParser';
import { checkCriticalDoses, DoseAlert } from '@/utils/criticalDoseAlerts';
import { convertDicomDVHToAppFormat } from '@/utils/dicomRTParser';
import { DicomRTData } from '@/types/dicomRT';
import { toast } from 'sonner';
import { 
  Activity, RefreshCw, FileUp, GitCompare, Layers,
  BarChart3, CheckSquare, Settings, BookOpen, 
  History, HelpCircle, FileText
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ─── WelcomeScreen ───────────────────────────────────────────────────────────
interface WelcomeScreenProps {
  onCsvLoaded: (rel: File, abs?: File) => void;
  onDicomLoaded: (data: DicomRTData) => void;
  onPlansLoaded: (plans: PlanData[], mode: 'summation' | 'comparison' | 'multi-patient') => void;
  onSummationComplete: (data: DVHData, result?: SummedPlanResult) => void;
  onSwitchToTools: (tab: string) => void;
}

const WelcomeScreen = ({
  onCsvLoaded, onDicomLoaded, onPlansLoaded,
  onSummationComplete, onSwitchToTools,
}: WelcomeScreenProps) => {
  const [activeCard, setActiveCard] = useState<'single' | 'compare' | 'sum' | null>('single');

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* Titre */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold">Commencer une analyse</h2>
        <p className="text-sm text-muted-foreground">
          Choisissez votre cas d'usage pour démarrer
        </p>
      </div>

      {/* Carte principale — Analyser un plan */}
      <Card
        className={`border-2 transition-all cursor-pointer ${
          activeCard === 'single'
            ? 'border-primary shadow-md'
            : 'border-transparent hover:border-primary/30'
        }`}
        onClick={() => setActiveCard('single')}
      >
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-primary/10 p-3 flex-shrink-0">
              <FileUp className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">Analyser un plan</h3>
                <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
                  Le plus fréquent
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                DICOM RT (RT Dose + RT Structure) ou CSV TomoTherapy
              </p>
              {activeCard === 'single' && (
                <div
                  className="animate-in fade-in slide-in-from-top-1"
                  onClick={e => e.stopPropagation()}
                >
                  <UnifiedPlanUpload
                    onCsvLoaded={onCsvLoaded}
                    onDicomLoaded={onDicomLoaded}
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cartes secondaires */}
      <div className="grid grid-cols-2 gap-4">

        {/* Comparer deux plans */}
        <Card
          className={`border-2 transition-all cursor-pointer ${
            activeCard === 'compare'
              ? 'border-blue-500 shadow-md'
              : 'border-transparent hover:border-blue-500/30'
          }`}
          onClick={() => setActiveCard(activeCard === 'compare' ? null : 'compare')}
        >
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2.5 flex-shrink-0">
                <GitCompare className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-medium">Comparer deux plans</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Plan initial vs replanning — superposition des courbes DVH
                </p>
              </div>
            </div>
            {activeCard === 'compare' && (
              <div
                className="animate-in fade-in slide-in-from-top-1"
                onClick={e => e.stopPropagation()}
              >
                <MultiFileUpload onPlansLoaded={onPlansLoaded} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sommation de plans */}
        <Card
          className={`border-2 transition-all cursor-pointer ${
            activeCard === 'sum'
              ? 'border-green-500 shadow-md'
              : 'border-transparent hover:border-green-500/30'
          }`}
          onClick={() => setActiveCard(activeCard === 'sum' ? null : 'sum')}
        >
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-green-500/10 p-2.5 flex-shrink-0">
                <Layers className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-medium">Sommation de plans</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Additionner plusieurs plans DICOM en un plan cumulatif
                </p>
              </div>
            </div>
            {activeCard === 'sum' && (
              <div
                className="animate-in fade-in slide-in-from-top-1"
                onClick={e => e.stopPropagation()}
              >
                <PlanSummationManager onSummationComplete={onSummationComplete} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Accès direct aux outils sans chargement */}
      <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
        <span className="text-xs text-muted-foreground">Accès direct :</span>
        <Button variant="ghost" size="sm" className="text-xs h-7"
          onClick={() => onSwitchToTools('protocols')}>
          <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Gérer les protocoles
        </Button>
        <Button variant="ghost" size="sm" className="text-xs h-7"
          onClick={() => onSwitchToTools('converter')}>
          <FileText className="w-3.5 h-3.5 mr-1.5" /> Convertisseur
        </Button>
        <Button variant="ghost" size="sm" className="text-xs h-7"
          onClick={() => onSwitchToTools('history')}>
          <History className="w-3.5 h-3.5 mr-1.5" /> Historique
        </Button>
        <Button variant="ghost" size="sm" className="text-xs h-7"
          onClick={() => onSwitchToTools('help')}>
          <HelpCircle className="w-3.5 h-3.5 mr-1.5" /> Aide
        </Button>
      </div>
    </div>
  );
};

// ─── Composant principal ─────────────────────────────────────────────────────
const Index = () => {
  const [dvhData, setDvhData] = useState<DVHData | null>(null);
  const [selectedStructures, setSelectedStructures] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<StructureCategory | 'ALL'>('ALL');
  const [comparisonPlans, setComparisonPlans] = useState<PlanData[]>([]);
  const [comparisonMode, setComparisonMode] = useState<'summation' | 'comparison' | 'multi-patient' | null>(null);
  const [criticalAlerts, setCriticalAlerts] = useState<DoseAlert[]>([]);
  const [lastSummationResult, setLastSummationResult] = useState<SummedPlanResult | null>(null);
  const [activeProtocol, setActiveProtocol] = useState<TreatmentProtocol | null>(null);

  // Tab actif — 'welcome' tant qu'aucun plan n'est chargé (état invisible)
  const [mainTab, setMainTab] = useState<string>('welcome');

  // Sous-onglet actif dans chaque groupe
  const [analyzeSubTab, setAnalyzeSubTab] = useState<string>('dvh');
  const [validationSubTab, setValidationSubTab] = useState<string>('validation');
  const [toolsSubTab, setToolsSubTab] = useState<string>('protocols');

  // Quand dvhData arrive → basculer automatiquement vers Analyse
  useEffect(() => {
    if (dvhData) {
      setMainTab('analyze');
      setAnalyzeSubTab(
        comparisonMode === 'comparison' ? 'comparison' : 'dvh'
      );
    }
  }, [dvhData]);

  // Alertes doses critiques
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
      toast.error('Erreur de chargement', {
        description: 'Vérifiez le format des fichiers DVH',
      });
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
      // Pré-sélectionner les structures communes
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

  // Changer de plan — réinitialise tout
  const handleChangePlan = () => {
    setDvhData(null);
    setSelectedStructures([]);
    setComparisonPlans([]);
    setComparisonMode(null);
    setCriticalAlerts([]);
    setLastSummationResult(null);
    setActiveProtocol(null);
    setMainTab('welcome');
    setToolsSubTab('protocols');
  };

  // Navigation vers un outil depuis WelcomeScreen
  const handleSwitchToTools = (tab: string) => {
    setMainTab('tools');
    setToolsSubTab(tab);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <InteractiveTour />

      {/* Header */}
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
            <div className="flex items-center gap-3">
              {/* Bouton changer de plan */}
              {dvhData && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleChangePlan}
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Changer de plan
                </Button>
              )}
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">

          {/* ── Barre patient (si plan chargé) ─────────────────────────────── */}
          {dvhData && (
            <div className="bg-card border rounded-lg px-5 py-3">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-6 flex-wrap">
                  <div>
                    <p className="text-xs text-muted-foreground">Patient</p>
                    <p className="font-semibold">{dvhData.patientId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Structures</p>
                    <p className="font-semibold">{dvhData.structures.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sélectionnées</p>
                    <p className="font-semibold text-primary">{selectedStructures.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Dose max</p>
                    <p className="font-semibold text-accent">
                      {findMaxDoseAcrossStructures(dvhData.structures).toFixed(2)} Gy
                    </p>
                  </div>
                  {activeProtocol && (
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">Protocole actif</p>
                      <Badge className="bg-primary/15 text-primary border-primary/30 text-xs">
                        {activeProtocol.name}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 text-xs text-muted-foreground px-1"
                        onClick={() => setActiveProtocol(null)}
                      >
                        ✕
                      </Button>
                    </div>
                  )}
                </div>
                {comparisonMode === 'comparison' && (
                  <Badge variant="outline" className="text-blue-500 border-blue-500/40">
                    Mode comparaison — {comparisonPlans.length} plans
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* ── Alertes doses critiques ─────────────────────────────────────── */}
          {dvhData && <CriticalDoseAlerts alerts={criticalAlerts} />}

          {/* ── Navigation principale — 3 groupes ───────────────────────────── */}
          <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
            <TabsList className="grid w-full max-w-lg mx-auto grid-cols-3">
              <TabsTrigger
                value="analyze"
                disabled={!dvhData}
                className="flex items-center gap-1.5"
              >
                <BarChart3 className="w-4 h-4" />
                Analyse
              </TabsTrigger>
              <TabsTrigger
                value="validation"
                disabled={!dvhData}
                className="flex items-center gap-1.5"
              >
                <CheckSquare className="w-4 h-4" />
                Validation
              </TabsTrigger>
              <TabsTrigger value="tools" className="flex items-center gap-1.5">
                <Settings className="w-4 h-4" />
                Outils
              </TabsTrigger>
            </TabsList>

            {/* ── TAB ANALYSE ──────────────────────────────────────────────── */}
            <TabsContent value="analyze" className="mt-4">
              {dvhData && (
                <Tabs value={analyzeSubTab} onValueChange={setAnalyzeSubTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="dvh">Courbes DVH</TabsTrigger>
                    <TabsTrigger
                      value="comparison"
                      disabled={comparisonMode !== 'comparison'}
                    >
                      Comparaison
                    </TabsTrigger>
                    <TabsTrigger value="evaluation">Évaluation du plan</TabsTrigger>
                  </TabsList>

                  <TabsContent value="dvh" className="space-y-6">
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
                    <PlanEvaluation
                      structures={dvhData.structures}
                      patientId={dvhData.patientId}
                    />
                  </TabsContent>
                </Tabs>
              )}
            </TabsContent>

            {/* ── TAB VALIDATION ───────────────────────────────────────────── */}
            <TabsContent value="validation" className="mt-4">
              {dvhData && (
                <Tabs value={validationSubTab} onValueChange={setValidationSubTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="validation">Validation Protocole</TabsTrigger>
                    <TabsTrigger value="protocols">Gérer les protocoles</TabsTrigger>
                  </TabsList>

                  <TabsContent value="validation">
                    <ProtocolValidation
                      structures={dvhData.structures}
                      patientId={dvhData.patientId}
                      summationResult={lastSummationResult}
                      onProtocolChange={setActiveProtocol}
                    />
                  </TabsContent>

                  <TabsContent value="protocols">
                    <ProtocolManager
                      onProtocolSelect={(p) => {
                        setActiveProtocol(p);
                        setValidationSubTab('validation');
                        toast.success(`Protocole "${p.name}" activé`);
                      }}
                    />
                  </TabsContent>
                </Tabs>
              )}
            </TabsContent>

            {/* ── TAB OUTILS ───────────────────────────────────────────────── */}
            <TabsContent value="tools" className="mt-4">
              <Tabs value={toolsSubTab} onValueChange={setToolsSubTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="protocols">
                    <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                    Protocoles
                  </TabsTrigger>
                  <TabsTrigger value="converter">
                    <FileText className="w-3.5 h-3.5 mr-1.5" />
                    Convertisseur
                  </TabsTrigger>
                  <TabsTrigger value="history">
                    <History className="w-3.5 h-3.5 mr-1.5" />
                    Historique
                  </TabsTrigger>
                  <TabsTrigger value="help">
                    <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
                    Aide
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="protocols">
                  <ProtocolManager
                    onProtocolSelect={(p) => {
                      setActiveProtocol(p);
                      if (dvhData) {
                        setMainTab('analyze');
                        toast.success(`Protocole "${p.name}" activé`, {
                          description: 'Visible sur les courbes DVH',
                        });
                      }
                    }}
                  />
                </TabsContent>
                <TabsContent value="converter">
                  <ProtocolDocumentConverter />
                </TabsContent>
                <TabsContent value="history">
                  <AnalysisHistory />
                </TabsContent>
                <TabsContent value="help">
                  <HelpGuide />
                </TabsContent>
              </Tabs>

              {/* WelcomeScreen — affiché dans Outils si aucun plan chargé */}
              {!dvhData && toolsSubTab === 'protocols' && (
                <div className="mt-8 border-t pt-8">
                  <WelcomeScreen
                    onCsvLoaded={handleFilesUploaded}
                    onDicomLoaded={handleDicomRTLoaded}
                    onPlansLoaded={handlePlansLoaded}
                    onSummationComplete={handleDicomSummationComplete}
                    onSwitchToTools={handleSwitchToTools}
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* WelcomeScreen principal — si aucun plan et pas dans Outils */}
          {!dvhData && mainTab !== 'tools' && (
            <WelcomeScreen
              onCsvLoaded={handleFilesUploaded}
              onDicomLoaded={handleDicomRTLoaded}
              onPlansLoaded={handlePlansLoaded}
              onSummationComplete={handleDicomSummationComplete}
              onSwitchToTools={handleSwitchToTools}
            />
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-4 bg-card/30">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          DVH Analyzer — Centre Sidi Abdellah de Cancérologie d'Alger
        </div>
      </footer>
    </div>
  );
};

export default Index;
