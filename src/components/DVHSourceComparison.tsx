import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileUpload } from '@/components/FileUpload';
import { DicomRTUpload } from '@/components/DicomRTUpload';
import { Structure } from '@/types/dvh';
import { DicomRTData } from '@/types/dicomRT';
import { parseTomoTherapyDVH } from '@/utils/dvhParser';
import { convertDicomDVHToAppFormat } from '@/utils/dicomRTParser';
import { toast } from 'sonner';
import { FileText, Scan, CheckCircle, XCircle, ArrowRight, Bug } from 'lucide-react';

interface DVHSourceComparisonProps {
  onDvhParserLoaded: (structures: Structure[]) => void;
  onDicomRTLoaded: (structures: Structure[]) => void;
  dvhParserStructures: Structure[] | null;
  dicomRTStructures: Structure[] | null;
}

const DVHSourceComparison = ({ 
  onDvhParserLoaded, 
  onDicomRTLoaded,
  dvhParserStructures,
  dicomRTStructures 
}: DVHSourceComparisonProps) => {
  const [dvhLoading, setDvhLoading] = useState(false);
  const [dicomLoading, setDicomLoading] = useState(false);

  const handleDVHFilesUploaded = async (relFile: File, absFile?: File) => {
    setDvhLoading(true);
    try {
      const relContent = await relFile.text();
      const absContent = absFile ? await absFile.text() : undefined;
      const data = parseTomoTherapyDVH(relContent, absContent);
      
      onDvhParserLoaded(data.structures);
      
      toast.success('DVH Parser chargé', {
        description: `${data.structures.length} structures détectées`
      });
    } catch (error) {
      console.error('Error parsing DVH files:', error);
      toast.error('Erreur lors du chargement DVH');
    } finally {
      setDvhLoading(false);
    }
  };

  const handleDicomRTLoaded = (data: DicomRTData) => {
    setDicomLoading(true);
    try {
      if (data.structures && data.dose?.dvhs) {
        const convertedDVH = convertDicomDVHToAppFormat(data.structures, data.dose.dvhs);
        
        const structures: Structure[] = convertedDVH.map((dvh) => ({
          name: dvh.name,
          type: 'STANDARD',
          category: dvh.name.toUpperCase().startsWith('PTV') ? 'PTV' : 'OAR',
          relativeVolume: dvh.relativeVolume,
          absoluteVolume: [],
          totalVolume: dvh.absoluteVolume,
        }));

        onDicomRTLoaded(structures);
        
        toast.success('DICOM RT chargé', {
          description: `${structures.length} structures avec DVH`
        });
      } else {
        toast.warning('Pas de données DVH dans le DICOM RT');
      }
    } catch (error) {
      console.error('Error processing DICOM RT:', error);
      toast.error('Erreur lors du traitement DICOM RT');
    } finally {
      setDicomLoading(false);
    }
  };

  const handleClear = (source: 'dvh' | 'dicom') => {
    if (source === 'dvh') {
      onDvhParserLoaded([]);
    } else {
      onDicomRTLoaded([]);
    }
  };

  return (
    <Card className="border-dashed border-2 border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="w-5 h-5 text-primary" />
          Mode Comparaison: DVH Parser vs DICOM RT
        </CardTitle>
        <CardDescription>
          Chargez les données du même patient depuis les deux sources pour comparer les métriques
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* DVH Parser Source */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                Source 1: DVH Parser (CSV)
              </h3>
              {dvhParserStructures && dvhParserStructures.length > 0 ? (
                <Badge className="bg-green-500/20 text-green-600">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {dvhParserStructures.length} structures
                </Badge>
              ) : (
                <Badge variant="outline">
                  <XCircle className="w-3 h-3 mr-1" />
                  Non chargé
                </Badge>
              )}
            </div>
            
            {dvhParserStructures && dvhParserStructures.length > 0 ? (
              <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">
                  Structures: {dvhParserStructures.map(s => s.name).slice(0, 5).join(', ')}
                  {dvhParserStructures.length > 5 && ` ... +${dvhParserStructures.length - 5}`}
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleClear('dvh')}
                  className="text-destructive hover:text-destructive"
                >
                  Effacer et recharger
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg p-4 bg-muted/30">
                <FileUpload onFilesUploaded={handleDVHFilesUploaded} />
              </div>
            )}
          </div>

          {/* DICOM RT Source */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Scan className="w-4 h-4 text-orange-500" />
                Source 2: DICOM RT
              </h3>
              {dicomRTStructures && dicomRTStructures.length > 0 ? (
                <Badge className="bg-green-500/20 text-green-600">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {dicomRTStructures.length} structures
                </Badge>
              ) : (
                <Badge variant="outline">
                  <XCircle className="w-3 h-3 mr-1" />
                  Non chargé
                </Badge>
              )}
            </div>
            
            {dicomRTStructures && dicomRTStructures.length > 0 ? (
              <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">
                  Structures: {dicomRTStructures.map(s => s.name).slice(0, 5).join(', ')}
                  {dicomRTStructures.length > 5 && ` ... +${dicomRTStructures.length - 5}`}
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleClear('dicom')}
                  className="text-destructive hover:text-destructive"
                >
                  Effacer et recharger
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg p-4 bg-muted/30">
                <DicomRTUpload onDataLoaded={handleDicomRTLoaded} />
              </div>
            )}
          </div>
        </div>

        {/* Status */}
        {dvhParserStructures && dvhParserStructures.length > 0 && 
         dicomRTStructures && dicomRTStructures.length > 0 && (
          <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-green-600 font-medium">
              <CheckCircle className="w-5 h-5" />
              Les deux sources sont chargées - Le panneau de comparaison ci-dessous affiche les différences
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              DVH Parser: {dvhParserStructures.length} structures | 
              DICOM RT: {dicomRTStructures.length} structures
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DVHSourceComparison;
