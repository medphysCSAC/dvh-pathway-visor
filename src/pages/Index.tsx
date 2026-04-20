import { useState, useEffect } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { MultiFileUpload } from '@/components/MultiFileUpload';
import { PlanComparison } from '@/components/PlanComparison';
import { ProtocolDocumentConverter } from '@/components/ProtocolDocumentConverter';
import { DVHChart } from '@/components/DVHChart';
import { StructureTable } from '@/components/StructureTable';
import { FilterBar } from '@/components/FilterBar';
import { PlanEvaluation } from '@/components/PlanEvaluation';
import { DoseCalculator } from '@/components/DoseCalculator';
import UnifiedMetricsCalculator from '@/components/UnifiedMetricsCalculator';
import ProtocolValidation from '@/components/ProtocolValidation';
import ProtocolManager from '@/components/ProtocolManager';
import AnalysisHistory from '@/components/AnalysisHistory';
import HelpGuide from '@/components/HelpGuide';
import { ThemeToggle } from '@/components/ThemeToggle';
import { InteractiveTour } from '@/components/InteractiveTour';
import { ContextualHelp } from '@/components/ContextualHelp';
import { CriticalDoseAlerts } from '@/components/CriticalDoseAlerts';
import { DicomRTUpload } from '@/components/DicomRTUpload';
import DVHComparisonDebug from '@/components/DVHComparisonDebug';
import DVHSourceComparison from '@/components/DVHSourceComparison';
import { DVHData, StructureCategory, PlanData, Structure } from '@/types/dvh';
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
  
  // Debug: Stocker les structures des deux sources pour comparaison
  const [dvhParserStructures, setDvhParserStructures] = useState<Structure[] | null>(null);
  const [dicomRTStructures, setDicomRTStructures] = useState<Structure[] | null>(null);

  // Check for critical dose exceedances when DVH data changes
  useEffect(() => {
    if (dvhData?.structures) {
      const alerts = checkCriticalDoses(dvhData.structures);
      setCriticalAlerts(alerts);

      // Show toast for critical alerts
      const criticalCount = alerts.filter(a => a.severity === 'critical').length;
      if (criticalCount > 0) {
        toast.error(`${criticalCount} dépassement${criticalCount > 1 ? 's' : ''} critique${criticalCount > 1 ? 's' : ''} détecté${criticalCount > 1 ? 's' : ''}`, {
          description: 'Vérifiez les alertes de dose en haut de la page'
        });
      } else if (alerts.length > 0) {
        toast.warning(`${alerts.length} avertissement${alerts.length > 1 ? 's' : ''} de dose`, {
          description: 'Consultez les alertes pour plus de détails'
        });
      }
    } else {
      setCriticalAlerts([]);
    }
  }, [dvhData]);
  const handleFilesUploaded = async (relFile: File, absFile?: File) => {
    try {
      const relContent = await relFile.text();
      const absContent = absFile ? await absFile.text() : undefined;
      const data = parseTomoTherapyDVH(relContent, absContent);

      // Extract patient ID from filename if available
      const patientIdMatch = relFile.name.match(/(\d+-\d+)/);
      if (patientIdMatch) {
        data.patientId = patientIdMatch[1];
      }
      setDvhData(data);
      setSelectedStructures([]);
      
      // Debug: stocker les structures DVH Parser pour comparaison
      setDvhParserStructures(data.structures);
      
      toast.success('Fichiers DVH chargés avec succès', {
        description: `${data.structures.length} structures anatomiques détectées`
      });
      if (!absFile) {
        toast.warning('DVH ABS non fourni', {
          description: 'Certaines métriques en cc/cc nécessiteront le fichier ABS pour être calculées.'
        });
      }
    } catch (error) {
      console.error('Error parsing DVH files:', error);
      toast.error('Erreur lors du chargement des fichiers', {
        description: 'Vérifiez le format des fichiers DVH'
      });
    }
  };
  const handleStructureToggle = (structureName: string) => {
    setSelectedStructures(prev => {
      if (prev.includes(structureName)) {
        return prev.filter(name => name !== structureName);
      } else {
        return [...prev, structureName];
      }
    });
  };
  const handleFilterChange = (category: StructureCategory | 'ALL') => {
    setActiveFilter(category);
    if (!dvhData) return;
    if (category === 'ALL') {
      setSelectedStructures([]);
    } else {
      const filtered = dvhData.structures.filter(s => s.category === category).map(s => s.name);
      setSelectedStructures(filtered);
    }
  };
  const handleSelectAll = () => {
    if (!dvhData) return;
    setSelectedStructures(dvhData.structures.map(s => s.name));
  };
  const handleDeselectAll = () => {
    setSelectedStructures([]);
  };
  const handleCategoryChange = (structureName: string, newCategory: StructureCategory) => {
    if (!dvhData) return;
    setDvhData({
      ...dvhData,
      structures: dvhData.structures.map(s => s.name === structureName ? {
        ...s,
        category: newCategory
      } : s)
    });
  };
  const handlePlansLoaded = (plans: PlanData[], mode: 'summation' | 'comparison' | 'multi-patient') => {
    setComparisonPlans(plans);
    setComparisonMode(mode);
    if (mode === 'summation') {
      // Summate plans into a single DVH
      const summatedPlan = summatePlans(plans);
      setDvhData({
        patientId: summatedPlan.patientId,
        structures: summatedPlan.structures
      });
      setSelectedStructures([]);
    } else if (mode === 'comparison') {
      // Load first plan as the main view
      setDvhData({
        patientId: plans[0].patientId,
        structures: plans[0].structures
      });
      setSelectedStructures([]);
    }
  };

  const handleDicomRTLoaded = (data: DicomRTData) => {
    // Convert DICOM RT data to app format
    if (data.structures && data.dose?.dvhs) {
      const convertedDVH = convertDicomDVHToAppFormat(data.structures, data.dose.dvhs);
      
      // Create DVHData structure compatible with the app
      const newDvhData: DVHData = {
        patientId: data.patientId || 'DICOM Patient',
        structures: convertedDVH.map((dvh) => ({
          name: dvh.name,
          type: 'STANDARD',
          category: dvh.name.toUpperCase().startsWith('PTV') ? 'PTV' : 'OAR',
          relativeVolume: dvh.relativeVolume,
          absoluteVolume: [], // DVH absolu en points (non utilisé ici)
          totalVolume: dvh.absoluteVolume, // ✅ FIX: utiliser le volume total retourné
        })),
      };

      setDvhData(newDvhData);
      setSelectedStructures([]);
      
      // Debug: stocker les structures DICOM RT pour comparaison
      setDicomRTStructures(newDvhData.structures);
      
      toast.success('DICOM RT importé', {
        description: `${newDvhData.structures.length} structures avec DVH chargées`,
      });
    } else if (data.structures) {
      toast.info('Structures détectées', {
        description: `${data.structures.length} structures sans données DVH. Chargez un fichier RTDOSE pour les DVH.`,
      });
    }
  };

  return <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <InteractiveTour />
      
      {/* Header */}
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
                <p className="text-sm text-muted-foreground">Analyse des courbes Dose-Volume-Histogrames et validation des plans pour tomotherapy</p>
              </div>
            </div>
            <div data-tour="theme-toggle">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* File Upload Section */}
          {!dvhData && <div className="max-w-5xl mx-auto space-y-6">
              <Tabs defaultValue="upload" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="upload">Charger un plan</TabsTrigger>
                  <TabsTrigger value="dicom">DICOM RT</TabsTrigger>
                  <TabsTrigger value="debug-compare" className="text-amber-600">
                    <Bug className="w-4 h-4 mr-1" />
                    Debug Comparaison
                  </TabsTrigger>
                  <TabsTrigger value="multi">Comparer/Sommer plans</TabsTrigger>
                  <TabsTrigger value="converter">Convertisseur</TabsTrigger>
                </TabsList>
                
                <TabsContent value="upload" className="mt-6">
                  <div data-tour="file-upload">
                    <FileUpload onFilesUploaded={handleFilesUploaded} />
                  </div>
                </TabsContent>

                <TabsContent value="dicom" className="mt-6">
                  <DicomRTUpload onDataLoaded={handleDicomRTLoaded} />
                </TabsContent>

                <TabsContent value="debug-compare" className="mt-6 space-y-6">
                  <DVHSourceComparison
                    onDvhParserLoaded={(structures) => setDvhParserStructures(structures.length > 0 ? structures : null)}
                    onDicomRTLoaded={(structures) => setDicomRTStructures(structures.length > 0 ? structures : null)}
                    dvhParserStructures={dvhParserStructures}
                    dicomRTStructures={dicomRTStructures}
                  />
                  
                  {/* Panneau de comparaison affiché directement ici */}
                  {(dvhParserStructures || dicomRTStructures) && (
                    <DVHComparisonDebug 
                      dvhParserStructures={dvhParserStructures} 
                      dicomRTStructures={dicomRTStructures} 
                    />
                  )}
                </TabsContent>
                
                <TabsContent value="multi" className="mt-6">
                  <MultiFileUpload onPlansLoaded={handlePlansLoaded} />
                </TabsContent>
                
                <TabsContent value="converter" className="mt-6">
                  <ProtocolDocumentConverter />
                </TabsContent>
              </Tabs>
            </div>}

          {/* Tabs Section - Always visible with or without DVH */}
          <Tabs defaultValue={dvhData && comparisonMode === 'comparison' ? "comparison" : dvhData ? "dvh" : "protocols"} className="w-full">
            <TabsList data-tour="tabs" className="grid w-full max-w-6xl mx-auto grid-cols-8">
              <TabsTrigger value="dvh" disabled={!dvhData} className="flex items-center gap-1">
                Analyse DVH
                <ContextualHelp content="Visualisez et analysez les courbes dose-volume, calculez des métriques et consultez les statistiques des structures." side="bottom" />
              </TabsTrigger>
              <TabsTrigger value="comparison" disabled={comparisonMode !== 'comparison'} className="flex items-center gap-1">
                Comparaison
                <ContextualHelp content="Comparez les métriques dosimétriques de plusieurs plans côte-à-côte avec différences visuelles." side="bottom" />
              </TabsTrigger>
              <TabsTrigger value="evaluation" disabled={!dvhData} className="flex items-center gap-1">
                Évaluation de plan
                <ContextualHelp content="Évaluez la qualité globale de votre plan de traitement avec des indices de conformité et d'homogénéité." side="bottom" />
              </TabsTrigger>
              <TabsTrigger value="validation" disabled={!dvhData} className="flex items-center gap-1">
                Validation Protocole
                <ContextualHelp content="Comparez votre plan avec un protocole de traitement et vérifiez le respect des contraintes dosimétriques." side="bottom" />
              </TabsTrigger>
              <TabsTrigger value="protocols" data-tour="protocols" className="flex items-center gap-1">
                Gestion Protocoles
                <ContextualHelp content="Gérez vos protocoles de traitement : créez, modifiez, importez ou exportez des protocoles personnalisés." side="bottom" />
              </TabsTrigger>
              <TabsTrigger value="converter" data-tour="converter" className="flex items-center gap-1">
                Convertisseur
                <ContextualHelp content="Convertissez des documents protocoles (PDF, Word) en format JSON utilisable par l'application." side="bottom" />
              </TabsTrigger>
              <TabsTrigger value="history" data-tour="history" className="flex items-center gap-1">
                Historique
                <ContextualHelp content="Consultez l'historique de vos analyses et validations précédentes." side="bottom" />
              </TabsTrigger>
              <TabsTrigger value="help" data-tour="help" className="flex items-center gap-1">
                Aide
                <ContextualHelp content="Guide d'utilisation complet avec exemples et cas d'usage de l'application." side="bottom" />
              </TabsTrigger>
            </TabsList>

          {/* Analysis Section */}
          {dvhData && <>
              {/* Critical Dose Alerts */}
              <CriticalDoseAlerts alerts={criticalAlerts} />

              {/* Debug: Comparaison DVH Parser vs DICOM RT */}
              {(dvhParserStructures || dicomRTStructures) && (
                <DVHComparisonDebug 
                  dvhParserStructures={dvhParserStructures} 
                  dicomRTStructures={dicomRTStructures} 
                />
              )}

              {/* Patient Info */}
              <div className="bg-card border rounded-lg p-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">Patient ID</p>
                      <ContextualHelp content="Identifiant unique du patient extrait du nom du fichier DVH." side="top" />
                    </div>
                    <p className="text-lg font-semibold">{dvhData.patientId}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">Structures</p>
                      <ContextualHelp content="Nombre total de structures anatomiques détectées dans les fichiers DVH (PTVs + OARs)." side="top" />
                    </div>
                    <p className="text-lg font-semibold">{dvhData.structures.length}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">Sélectionnées</p>
                      <ContextualHelp content="Nombre de structures actuellement sélectionnées pour l'affichage sur le graphique DVH." side="top" />
                    </div>
                    <p className="text-lg font-semibold text-primary">{selectedStructures.length}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">Dose max globale</p>
                      <ContextualHelp content="Dose maximale trouvée parmi toutes les structures du plan (Dmax). Utile pour identifier les points chauds." side="top" />
                    </div>
                    <p className="text-lg font-semibold text-accent">
                      {findMaxDoseAcrossStructures(dvhData.structures).toFixed(2)} Gy
                    </p>
                  </div>
                </div>
              </div>

                {/* Onglet Analyse DVH */}
                <TabsContent value="dvh" className="space-y-8">
                  {/* Filter Bar */}
                  <FilterBar structures={dvhData.structures} selectedStructures={selectedStructures} onFilterChange={handleFilterChange} onSelectAll={handleSelectAll} onDeselectAll={handleDeselectAll} activeFilter={activeFilter} />

                  {/* DVH Chart with integrated structure selector */}
                  <DVHChart 
                    structures={dvhData.structures} 
                    selectedStructures={selectedStructures}
                    onStructureToggle={handleStructureToggle}
                    onSelectAll={handleSelectAll}
                    onDeselectAll={handleDeselectAll}
                  />

                  {/* Calculateur unifié de métriques DVH */}
                  <UnifiedMetricsCalculator structures={dvhData.structures} selectedStructures={selectedStructures} />

                  {/* Structure Table */}
                  <StructureTable structures={dvhData.structures} selectedStructures={selectedStructures} onStructureToggle={handleStructureToggle} onCategoryChange={handleCategoryChange} />
                </TabsContent>

                {/* Onglet Comparaison de plans */}
                <TabsContent value="comparison">
                  {comparisonMode === 'comparison' && comparisonPlans.length > 0 && <PlanComparison plans={comparisonPlans} />}
                </TabsContent>

                {/* Onglet Évaluation de plan */}
                <TabsContent value="evaluation">
                  <PlanEvaluation structures={dvhData.structures} patientId={dvhData.patientId} />
                </TabsContent>

                {/* Onglet Validation Protocole */}
                <TabsContent value="validation">
                  <ProtocolValidation structures={dvhData.structures} patientId={dvhData.patientId} />
                </TabsContent>

                {/* Onglet Gestion Protocoles */}
                <TabsContent value="protocols">
                  <ProtocolManager />
                </TabsContent>

                {/* Onglet Convertisseur */}
                <TabsContent value="converter">
                  <ProtocolDocumentConverter />
                </TabsContent>
              </>}

              {/* Onglets toujours disponibles sans DVH */}
              <TabsContent value="protocols">
                <ProtocolManager />
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
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-6 bg-card/30">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>DVH Analyzer - Outil d'analyse pour plans de traitement de tomotherapy_ Centre Sidi Abdellah de Cancérologie d'Alger </p>
        </div>
      </footer>
    </div>;
};
export default Index;