import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileImage, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Layers,
  Activity,
  FileText,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { parseDicomFile } from '@/utils/dicomRTParser';
import { DicomRTData, DicomRTStructure } from '@/types/dicomRT';

interface DicomRTUploadProps {
  onDataLoaded?: (data: DicomRTData) => void;
}

export const DicomRTUpload: React.FC<DicomRTUploadProps> = ({ onDataLoaded }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<DicomRTData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFilesSelected = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const dicomFiles = Array.from(files).filter(
      (f) => f.name.endsWith('.dcm') || !f.name.includes('.')
    );

    if (dicomFiles.length === 0) {
      setError('Aucun fichier DICOM détecté. Les fichiers doivent avoir l\'extension .dcm');
      return;
    }

    setSelectedFiles(dicomFiles);
    setError(null);
  }, []);

  const processFiles = async () => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    setError(null);

    try {
      let combinedData: DicomRTData = {
        patientId: '',
        patientName: '',
        studyDate: '',
        modality: '',
      };

      for (const file of selectedFiles) {
        const data = await parseDicomFile(file);

        // Merge data
        if (data.patientId) combinedData.patientId = data.patientId;
        if (data.patientName) combinedData.patientName = data.patientName;
        if (data.studyDate) combinedData.studyDate = data.studyDate;
        if (data.modality) combinedData.modality = data.modality;
        if (data.structures) combinedData.structures = data.structures;
        if (data.dose) combinedData.dose = data.dose;
        if (data.plan) combinedData.plan = data.plan;
      }

      setParsedData(combinedData);
      onDataLoaded?.(combinedData);

      const structCount = combinedData.structures?.length || 0;
      const dvhCount = combinedData.dose?.dvhs?.length || 0;

      toast.success(`DICOM RT chargé`, {
        description: `${structCount} structures, ${dvhCount} DVH extraits`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de parsing DICOM';
      setError(message);
      toast.error('Erreur de parsing', { description: message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      handleFilesSelected(e.dataTransfer.files);
    },
    [handleFilesSelected]
  );

  const clearSelection = () => {
    setSelectedFiles([]);
    setParsedData(null);
    setError(null);
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileImage className="h-5 w-5 text-primary" />
          Import DICOM RT
        </CardTitle>
        <CardDescription>
          Chargez des fichiers RT Structure, RT Dose ou RT Plan pour extraire les données
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop Zone */}
        <div
          className="border-2 border-dashed border-border/50 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => document.getElementById('dicom-input')?.click()}
        >
          <input
            id="dicom-input"
            type="file"
            multiple
            accept=".dcm"
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Glissez-déposez vos fichiers DICOM RT ou cliquez pour sélectionner
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Formats supportés: RTSTRUCT, RTDOSE, RTPLAN (.dcm)
          </p>
        </div>

        {/* Selected Files */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedFiles.length} fichier(s) sélectionné(s)
              </span>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <Trash2 className="h-4 w-4 mr-1" />
                Effacer
              </Button>
            </div>
            <ScrollArea className="h-24 rounded border border-border/50 p-2">
              {selectedFiles.map((file, i) => (
                <div key={i} className="text-xs text-muted-foreground py-1">
                  {file.name}
                </div>
              ))}
            </ScrollArea>
            <Button
              onClick={processFiles}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Analyser les fichiers
                </>
              )}
            </Button>
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Parsed Data Display */}
        {parsedData && (
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="info">Info</TabsTrigger>
              <TabsTrigger value="structures">
                Structures ({parsedData.structures?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="dose">Dose</TabsTrigger>
              <TabsTrigger value="plan">Plan</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-2 mt-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Patient ID:</div>
                <div className="font-medium">{parsedData.patientId}</div>
                <div className="text-muted-foreground">Nom:</div>
                <div className="font-medium">{parsedData.patientName}</div>
                <div className="text-muted-foreground">Date étude:</div>
                <div className="font-medium">{parsedData.studyDate}</div>
              </div>
            </TabsContent>

            <TabsContent value="structures" className="mt-4">
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {parsedData.structures?.map((struct) => (
                    <StructureItem key={struct.roiNumber} structure={struct} />
                  ))}
                  {(!parsedData.structures || parsedData.structures.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Aucune structure trouvée. Chargez un fichier RTSTRUCT.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="dose" className="mt-4">
              {parsedData.dose ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Type:</div>
                    <div>{parsedData.dose.doseType}</div>
                    <div className="text-muted-foreground">Unités:</div>
                    <div>{parsedData.dose.doseUnits}</div>
                    <div className="text-muted-foreground">Grille:</div>
                    <div>
                      {parsedData.dose.rows} × {parsedData.dose.columns}
                    </div>
                    <div className="text-muted-foreground">DVHs:</div>
                    <div>{parsedData.dose.dvhs.length}</div>
                  </div>
                  {parsedData.dose.dvhs.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium mb-2">DVH extraits:</p>
                      <div className="flex flex-wrap gap-1">
                        {parsedData.dose.dvhs.map((dvh, i) => (
                          <Badge key={i} variant="secondary">
                            ROI {dvh.referencedROINumber} - {dvh.dvhType}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune donnée de dose. Chargez un fichier RTDOSE.
                </p>
              )}
            </TabsContent>

            <TabsContent value="plan" className="mt-4">
              {parsedData.plan ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Nom:</div>
                    <div>{parsedData.plan.planName}</div>
                    <div className="text-muted-foreground">Date:</div>
                    <div>{parsedData.plan.planDate}</div>
                    <div className="text-muted-foreground">Fractions:</div>
                    <div>
                      {parsedData.plan.fractionGroups[0]?.numberOfFractionsPlanned || '-'}
                    </div>
                    <div className="text-muted-foreground">Faisceaux:</div>
                    <div>{parsedData.plan.beams.length}</div>
                  </div>
                  {parsedData.plan.beams.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium mb-2">Faisceaux:</p>
                      <div className="space-y-1">
                        {parsedData.plan.beams.map((beam) => (
                          <div
                            key={beam.beamNumber}
                            className="text-xs bg-muted/50 rounded px-2 py-1"
                          >
                            {beam.beamName} ({beam.radiationType})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun plan. Chargez un fichier RTPLAN.
                </p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

const StructureItem: React.FC<{ structure: DicomRTStructure }> = ({ structure }) => {
  const colorStyle = structure.color
    ? { backgroundColor: `rgb(${structure.color[0]}, ${structure.color[1]}, ${structure.color[2]})` }
    : {};

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div
        className="w-4 h-4 rounded-full border border-border/50"
        style={colorStyle}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{structure.name}</p>
        <p className="text-xs text-muted-foreground">
          {structure.contours.length} contours
        </p>
      </div>
      <Badge variant="outline" className="text-xs">
        ROI {structure.roiNumber}
      </Badge>
    </div>
  );
};

export default DicomRTUpload;
