import { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
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
import { ThemeToggle } from '@/components/ThemeToggle';
import { DVHData, StructureCategory, PlanData } from '@/types/dvh';
import { summatePlans } from '@/utils/planSummation';
import { parseTomoTherapyDVH, findMaxDoseAcrossStructures } from '@/utils/dvhParser';
import { toast } from 'sonner';
import { Activity } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
const Index = () => {
  const [dvhData, setDvhData] = useState<DVHData | null>(null);
  const [selectedStructures, setSelectedStructures] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<StructureCategory | 'ALL'>('ALL');
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
      const filtered = dvhData.structures
        .filter(s => s.category === category)
        .map(s => s.name);
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
      structures: dvhData.structures.map(s =>
        s.name === structureName ? { ...s, category: newCategory } : s
      )
    });
  };

  return <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
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
                  DVH Analyzer
                </h1>
                <p className="text-sm text-muted-foreground">Analyse des courbes Dose-Volume-Histogrames pour radiothérapie</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* File Upload Section */}
          {!dvhData && <div className="max-w-4xl mx-auto space-y-6">
              <Tabs defaultValue="upload" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload">Charger un plan</TabsTrigger>
                  <TabsTrigger value="converter">Convertisseur Protocole</TabsTrigger>
                </TabsList>
                
                <TabsContent value="upload" className="mt-6">
                  <FileUpload onFilesUploaded={handleFilesUploaded} />
                </TabsContent>
                
                <TabsContent value="converter" className="mt-6">
                  <ProtocolDocumentConverter />
                </TabsContent>
              </Tabs>
            </div>}

          {/* Tabs Section - Always visible with or without DVH */}
          <Tabs defaultValue={dvhData ? "dvh" : "protocols"} className="w-full">
            <TabsList className="grid w-full max-w-5xl mx-auto grid-cols-6">
              <TabsTrigger value="dvh" disabled={!dvhData}>Analyse DVH</TabsTrigger>
              <TabsTrigger value="evaluation" disabled={!dvhData}>Évaluation de plan</TabsTrigger>
              <TabsTrigger value="validation" disabled={!dvhData}>Validation Protocole</TabsTrigger>
              <TabsTrigger value="protocols">Gestion Protocoles</TabsTrigger>
              <TabsTrigger value="converter">Convertisseur</TabsTrigger>
              <TabsTrigger value="history">Historique</TabsTrigger>
            </TabsList>

          {/* Analysis Section */}
          {dvhData && <>
              {/* Patient Info */}
              <div className="bg-card border rounded-lg p-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Patient ID</p>
                    <p className="text-lg font-semibold">{dvhData.patientId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Structures</p>
                    <p className="text-lg font-semibold">{dvhData.structures.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sélectionnées</p>
                    <p className="text-lg font-semibold text-primary">{selectedStructures.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Dose max globale</p>
                    <p className="text-lg font-semibold text-accent">
                      {findMaxDoseAcrossStructures(dvhData.structures).toFixed(2)} Gy
                    </p>
                  </div>
                </div>
              </div>

                {/* Onglet Analyse DVH */}
                <TabsContent value="dvh" className="space-y-8">
                  {/* Filter Bar */}
                  <FilterBar
                    structures={dvhData.structures}
                    selectedStructures={selectedStructures}
                    onFilterChange={handleFilterChange}
                    onSelectAll={handleSelectAll}
                    onDeselectAll={handleDeselectAll}
                    activeFilter={activeFilter}
                  />

                  {/* DVH Chart */}
                  <DVHChart structures={dvhData.structures} selectedStructures={selectedStructures} />

                  {/* Calculateur unifié de métriques DVH */}
                  <UnifiedMetricsCalculator 
                    structures={dvhData.structures} 
                    selectedStructures={selectedStructures}
                  />

                  {/* Structure Table */}
                  <StructureTable 
                    structures={dvhData.structures} 
                    selectedStructures={selectedStructures} 
                    onStructureToggle={handleStructureToggle}
                    onCategoryChange={handleCategoryChange}
                  />
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
          </Tabs>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-6 bg-card/30">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>DVH Analyzer - Outil d'analyse pour plans de traitement en radiothérapie</p>
        </div>
      </footer>
    </div>;
};
export default Index;