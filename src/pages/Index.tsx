import { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { DVHChart } from '@/components/DVHChart';
import { StructureTable } from '@/components/StructureTable';
import { DVHData } from '@/types/dvh';
import { parseTomoTherapyDVH } from '@/utils/dvhParser';
import { toast } from 'sonner';
import { Activity } from 'lucide-react';

const Index = () => {
  const [dvhData, setDvhData] = useState<DVHData | null>(null);
  const [selectedStructures, setSelectedStructures] = useState<string[]>([]);

  const handleFilesUploaded = async (relFile: File, absFile: File) => {
    try {
      const relContent = await relFile.text();
      const absContent = await absFile.text();

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gradient-to-br from-primary to-accent p-2.5">
              <Activity className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                DVH Analyzer
              </h1>
              <p className="text-sm text-muted-foreground">
                Analyse des courbes Dose-Volume pour radiothérapie
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* File Upload Section */}
          {!dvhData && (
            <div className="max-w-4xl mx-auto">
              <FileUpload onFilesUploaded={handleFilesUploaded} />
            </div>
          )}

          {/* Analysis Section */}
          {dvhData && (
            <>
              {/* Patient Info */}
              <div className="bg-card border rounded-lg p-4">
                <div className="flex items-center justify-between">
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
                </div>
              </div>

              {/* DVH Chart */}
              <DVHChart 
                structures={dvhData.structures} 
                selectedStructures={selectedStructures}
              />

              {/* Structure Table */}
              <StructureTable
                structures={dvhData.structures}
                selectedStructures={selectedStructures}
                onStructureToggle={handleStructureToggle}
              />
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-6 bg-card/30">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>DVH Analyzer - Outil d'analyse pour plans de traitement en radiothérapie</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
