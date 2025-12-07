import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Upload, CheckCircle2, AlertCircle, Loader2, FolderOpen, Trash2, Activity } from "lucide-react";
import { toast } from "sonner";
import { parseDicomFile, convertDicomDVHToAppFormat } from "@/utils/dicomRTParser";
import { parseTomoTherapyDVH } from "@/utils/dvhParser";
import { DicomRTData, DicomRTStructure } from "@/types/dicomRT";
import { DVHData } from "@/types/dvh";

interface DicomRTUploadProps {
  onDataLoaded?: (data: { dicomData: DicomRTData; dvhData?: DVHData }) => void;
}

export const DicomRTUpload: React.FC<DicomRTUploadProps> = ({ onDataLoaded }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parsedData, setParsedData] = useState<DicomRTData | null>(null);
  const [dvhData, setDvhData] = useState<DVHData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [folderName, setFolderName] = useState<string>("");

  const readDirectory = useCallback(async (entry: FileSystemDirectoryEntry): Promise<File[]> => {
    const files: File[] = [];
    const reader = entry.createReader();

    return new Promise((resolve, reject) => {
      const readBatch = () => {
        reader.readEntries(async (entries) => {
          if (!entries.length) resolve(files);
          else {
            for (const entry of entries) {
              if (entry.isDirectory) {
                const subFiles = await readDirectory(entry as FileSystemDirectoryEntry);
                files.push(...subFiles);
              } else if (entry.isFile && entry.name.toLowerCase().endsWith(".dcm")) {
                const file = await new Promise<File>((res, rej) => {
                  (entry as FileSystemFileEntry).file(res, rej);
                });
                files.push(file);
              }
            }
            readBatch();
          }
        }, reject);
      };
      readBatch();
    });
  }, []);

  const handleFilesSelected = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;

    const fileArray = Array.from(files);
    const hasWebkitPath = fileArray.some((f) => (f as any).webkitRelativePath);
    if (hasWebkitPath) {
      const firstPath = (fileArray[0] as any).webkitRelativePath;
      setFolderName(firstPath?.split("/")[0] || "Dossier");
    }

    const dicomFiles = fileArray.filter((f) => /\.dcm$/i.test(f.name));
    if (!dicomFiles.length) {
      setError("Aucun fichier DICOM trouvé");
      return;
    }

    setSelectedFiles(dicomFiles);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragActive(false);

      const items = Array.from(e.dataTransfer.items || []);
      const allFiles: File[] = [];

      for (const item of items) {
        const entry = item.webkitGetAsEntry();
        if (entry?.isDirectory) {
          const dirFiles = await readDirectory(entry as FileSystemDirectoryEntry);
          allFiles.push(...dirFiles);
          setFolderName(entry.name);
        } else if (entry?.isFile && entry.name.toLowerCase().endsWith(".dcm")) {
          const file = await new Promise<File>((res, rej) => {
            (entry as FileSystemFileEntry).file(res, rej);
          });
          allFiles.push(file);
        } else if (item.kind === "file") {
          const file = item.getAsFile();
          if (file && /\.dcm$/i.test(file.name)) allFiles.push(file);
        }
      }

      if (!allFiles.length) {
        setError("Aucun fichier DICOM dans le dossier");
        return;
      }

      setSelectedFiles(allFiles);
      setError(null);
    },
    [readDirectory],
  );

  const processFiles = async () => {
    if (!selectedFiles.length) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      // 🔥 ORDRE DE CHARGEMENT CRITIQUE
      const results = await Promise.all(selectedFiles.map((f) => parseDicomFile(f)));

      // Fusion ordonnée
      const combinedData: DicomRTData = {
        patientId: "",
        patientName: "",
        studyDate: "",
        modality: "",
        structures: [],
        dose: undefined,
        plan: undefined,
      };

      results.forEach((data) => {
        if (data.patientId) combinedData.patientId = data.patientId;
        if (data.patientName) combinedData.patientName = data.patientName;
        if (data.studyDate) combinedData.studyDate = data.studyDate;
        if (data.modality) combinedData.modality = data.modality;

        if (data.structures?.length) {
          combinedData.structures = [...(combinedData.structures || []), ...data.structures];
        }
        if (data.dose) {
          combinedData.dose = data.dose;
        }
        if (data.plan) {
          combinedData.plan = { ...combinedData.plan, ...data.plan };
        }
      });

      // 🔥 CONVERSION DVH APRÈS CHARGEMENT COMPLET
      if (combinedData.dose?.dvhs?.length && combinedData.structures?.length) {
        const convertedDVH = convertDicomDVHToAppFormat(combinedData.structures, combinedData.dose.dvhs);

        setDvhData({
          patientId: combinedData.patientId,
          structures: convertedDVH.map((s) => ({
            name: s.name,
            type: "STANDARD",
            category: s.name.toUpperCase().startsWith("PTV") ? "PTV" : "OAR",
            relativeVolume: s.relativeVolume,
            absoluteVolume: s.absoluteVolume,
            totalVolume: s.absoluteVolume,
          })),
        });
      }

      setParsedData(combinedData);
      onDataLoaded?.({ dicomData: combinedData, dvhData: dvhData || undefined });

      toast.success(`Dossier DICOM RT chargé`, {
        description: `${selectedFiles.length} fichiers, ${combinedData.structures?.length || 0} structures, ${combinedData.dose?.dvhs?.length || 0} DVH`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur parsing";
      setError(message);
      toast.error("Erreur", { description: message });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const clearSelection = () => {
    setSelectedFiles([]);
    setParsedData(null);
    setDvhData(null);
    setError(null);
    setFolderName("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary" />
          Import Dossier DICOM RT
        </CardTitle>
        <CardDescription>Sélectionnez un dossier contenant RT Structure, RT Dose et RT Plan</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
            ${isDragActive ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/50"}
          `}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={() => setIsDragActive(false)}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            // @ts-ignore webkitdirectory
            webkitdirectory=""
            accept=".dcm"
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Glissez-déposez un dossier DICOM</p>
          <p className="text-xs text-muted-foreground mt-1">Tous les fichiers .dcm seront analysés</p>
        </div>

        {(selectedFiles.length > 0 || folderName) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {folderName && (
                  <Badge variant="outline" className="font-mono">
                    <FolderOpen className="h-3 w-3 mr-1" />
                    {folderName}
                  </Badge>
                )}
                <span className="text-sm font-medium">{selectedFiles.length} fichier(s)</span>
              </div>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <Trash2 className="h-4 w-4 mr-1" />
                Effacer
              </Button>
            </div>

            <ScrollArea className="h-32 rounded border border-border/50 p-2">
              <div className="grid grid-cols-2 gap-1">
                {selectedFiles.slice(0, 20).map((file, i) => (
                  <div key={i} className="text-xs text-muted-foreground truncate" title={file.name}>
                    {file.name}
                  </div>
                ))}
                {selectedFiles.length > 20 && (
                  <div className="text-xs text-muted-foreground col-span-2 text-center py-1">
                    ... et {selectedFiles.length - 20} autres
                  </div>
                )}
              </div>
            </ScrollArea>

            <Button onClick={processFiles} disabled={isProcessing} className="w-full">
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyse... ({selectedFiles.length} fichiers)
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Extraire données DICOM RT
                </>
              )}
            </Button>
          </div>
        )}

        {isProcessing && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Analyse en cours...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {parsedData && (
          <Tabs defaultValue="patient" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="patient">Patient</TabsTrigger>
              <TabsTrigger value="structures">Structures ({parsedData.structures?.length || 0})</TabsTrigger>
              <TabsTrigger value="dose">Dose ({parsedData.dose?.dvhs?.length || 0} DVH)</TabsTrigger>
              <TabsTrigger value="plan">Plan</TabsTrigger>
            </TabsList>

            <TabsContent value="patient" className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">ID Patient:</div>
                <div className="font-mono">{parsedData.patientId}</div>
                <div className="text-muted-foreground">Nom:</div>
                <div className="font-medium">{parsedData.patientName}</div>
                <div className="text-muted-foreground">Date étude:</div>
                <div>{parsedData.studyDate}</div>
                <div className="text-muted-foreground">Modalité:</div>
                <div>{parsedData.modality}</div>
              </div>
            </TabsContent>

            <TabsContent value="structures">
              <ScrollArea className="h-48">
                <div className="space-y-1">
                  {parsedData.structures?.map((struct, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <div
                        className="w-4 h-4 rounded-full border border-border"
                        style={
                          struct.color
                            ? { backgroundColor: `rgb(${struct.color.join(",")})` }
                            : { backgroundColor: "#888" }
                        }
                      />
                      <span className="text-sm font-medium flex-1">{struct.name}</span>
                      <Badge variant="outline" className="text-xs">
                        ROI #{struct.roiNumber}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="dose" className="space-y-2">
              {dvhData ? (
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">DVH disponibles:</span>{" "}
                    <span className="font-bold">{dvhData.structures.length}</span>
                  </div>
                  <ScrollArea className="h-32 rounded border border-border/50 p-2">
                    <div className="flex flex-wrap gap-2">
                      {dvhData.structures.map((s, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          <Activity className="h-3 w-3 mr-1" />
                          {s.name}
                        </Badge>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <Alert>
                  <AlertDescription>Aucun DVH trouvé dans le fichier RTDOSE</AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="plan">
              {parsedData.plan ? (
                <div className="space-y-2 text-sm">
                  <div>{parsedData.plan.planName || "Plan sans nom"}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">Fractions:</span>
                    <span>{parsedData.plan.fractionGroups[0]?.numberOfFractionsPlanned || 1}</span>
                    <span className="text-muted-foreground">Faisceaux:</span>
                    <span>{parsedData.plan.beams?.length || 0}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun plan</p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

export default DicomRTUpload;
