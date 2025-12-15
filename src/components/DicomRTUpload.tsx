import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Upload, CheckCircle2, AlertCircle, Loader2, FolderOpen, Activity, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { parseDicomFile } from "@/utils/dicomRTParser";
import { DicomRTData, DicomRTStructure } from "@/types/dicomRT";

interface DicomRTUploadProps {
  onDataLoaded?: (data: DicomRTData) => void;
}

export const DicomRTUpload: React.FC<DicomRTUploadProps> = ({ onDataLoaded }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parsedData, setParsedData] = useState<DicomRTData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [folderName, setFolderName] = useState<string>("");
  const [isDragActive, setIsDragActive] = useState(false);

  // Lecture récursive d'un dossier (pour drag & drop)
  const readDirectory = useCallback(async (entry: FileSystemDirectoryEntry): Promise<File[]> => {
    const files: File[] = [];

    const readEntries = (directoryEntry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> => {
      return new Promise((resolve, reject) => {
        const reader = directoryEntry.createReader();
        reader.readEntries(resolve, reject);
      });
    };

    const processEntries = async (entries: FileSystemEntry[]) => {
      for (const entry of entries) {
        if (entry.isDirectory) {
          const subFiles = await readDirectory(entry as FileSystemDirectoryEntry);
          files.push(...subFiles);
        } else if (entry.isFile) {
          const fileEntry = entry as FileSystemFileEntry;
          if (fileEntry.name.toLowerCase().endsWith(".dcm")) {
            const file = await new Promise<File>((resolve, reject) => {
              fileEntry.file(resolve, reject);
            });
            files.push(file);
          }
        }
      }
    };

    const entries = await readEntries(entry);
    await processEntries(entries);
    return files;
  }, []);

  const filterDicomFiles = useCallback((files: File[]) => {
    return files.filter((f) => /\.dcm$/i.test(f.name));
  }, []);

  const handleFilesSelected = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files);
      const dicomFiles: File[] = filterDicomFiles(fileArray);

      // Détecter si c'est une sélection de dossier (webkitdirectory)
      const hasWebkitPath = fileArray.some((f) => (f as any).webkitRelativePath);
      if (hasWebkitPath) {
        const firstPath = (fileArray[0] as any).webkitRelativePath;
        const folder = firstPath?.split("/")[0] || "Dossier sélectionné";
        setFolderName(folder);
      }

      if (dicomFiles.length === 0) {
        setError("Aucun fichier DICOM (.dcm) trouvé dans la sélection");
        return;
      }

      setSelectedFiles(dicomFiles);
      setError(null);
    },
    [filterDicomFiles],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragActive(false);

      const dataTransfer = e.dataTransfer;
      const items = Array.from(dataTransfer.items || []);
      let allFiles: File[] = [];
      let detectedFolderName: string = ""; // 1. Tenter l'approche webkitGetAsEntry (pour les dossiers et fichiers complexes)

      for (const item of items) {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          if (entry.isDirectory) {
            // C'est un dossier glissé
            const dirFiles = await readDirectory(entry as FileSystemDirectoryEntry);
            allFiles.push(...dirFiles);
            detectedFolderName = entry.name;
          } else if (entry.isFile && entry.name.toLowerCase().endsWith(".dcm")) {
            // C'est un fichier DICOM glissé via l'API d'entrée
            const file = await new Promise<File>((resolve, reject) => {
              (entry as FileSystemFileEntry).file(resolve, reject);
            });
            allFiles.push(file);
          }
        }
      } // 2. Si aucun fichier n'a été trouvé via webkitGetAsEntry (ex: glisser-déposer de plusieurs fichiers simples dans Firefox/Safari)

      if (allFiles.length === 0 && dataTransfer.files.length > 0) {
        const fileArray = Array.from(dataTransfer.files);
        allFiles = filterDicomFiles(fileArray); // Utilisez votre filtre existant
        // Assurez-vous d'effacer le nom du dossier si ce n'était pas un dossier
        setFolderName("");
      }

      if (allFiles.length === 0) {
        setError("Aucun fichier DICOM (.dcm) trouvé dans la sélection.");
        setSelectedFiles([]);
        return;
      } // Mettre à jour l'état

      setSelectedFiles(allFiles);
      if (detectedFolderName) {
        setFolderName(detectedFolderName);
      } else if (!dataTransfer.items.some((item) => (item.webkitGetAsEntry() as any)?.isDirectory)) {
        // S'assurer que le nom du dossier est réinitialisé si ce n'est qu'un drop de fichiers
        setFolderName("");
      }
      setError(null);
    },
    [readDirectory, filterDicomFiles],
  );

  const processFiles = async () => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      let combinedData: DicomRTData = {
        patientId: "",
        patientName: "",
        studyDate: "",
        modality: "",
        structures: [],
        dose: undefined,
        plan: undefined,
      };

      const total = selectedFiles.length;
      let parsed = 0;

      // Process files one by one with progress updates
      for (const file of selectedFiles) {
        try {
          const data = await parseDicomFile(file);

          // Merge data
          if (data.patientId) combinedData.patientId = data.patientId;
          if (data.patientName) combinedData.patientName = data.patientName;
          if (data.studyDate) combinedData.studyDate = data.studyDate;
          if (data.modality) combinedData.modality = data.modality;

          if (data.structures?.length) {
            combinedData.structures = [...(combinedData.structures || []), ...data.structures];
          }
          if (data.dose) {
            combinedData.dose = combinedData.dose
              ? {
                  ...combinedData.dose,
                  ...data.dose,
                  dvhs: [...(combinedData.dose.dvhs || []), ...(data.dose.dvhs || [])],
                }
              : data.dose;
          }
          if (data.plan) {
            combinedData.plan = { ...combinedData.plan, ...data.plan };
          }
        } catch (err) {
          console.warn(`Failed to parse ${file.name}:`, err);
        }

        parsed++;
        setProgress(Math.round((parsed / total) * 100));

        // Yield to UI thread every 5 files
        if (parsed % 5 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      setParsedData(combinedData);
      onDataLoaded?.(combinedData);

      const structCount = combinedData.structures?.length || 0;
      const dvhCount = combinedData.dose?.dvhs?.length || 0;

      toast.success(`Dossier DICOM RT chargé`, {
        description: `${total} fichiers, ${structCount} structures, ${dvhCount} DVH`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur de parsing DICOM";
      setError(message);
      toast.error("Erreur de parsing", { description: message });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const clearSelection = () => {
    setSelectedFiles([]);
    setParsedData(null);
    setError(null);
    setFolderName("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary" />
          Import Dossier DICOM RT
        </CardTitle>
        <CardDescription>
          Sélectionnez un dossier contenant vos fichiers RT Structure, RT Dose et RT Plan
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop Zone - supporte les dossiers */}
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
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              inputRef.current?.click();
            }
          }}
        >
          <input
            ref={inputRef}
            id="dicom-input"
            type="file"
            multiple
            // @ts-ignore - webkitdirectory est non-standard mais supporté
            webkitdirectory=""
            // @ts-ignore
            directory=""
            accept=".dcm"
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Glissez-déposez un dossier DICOM ou cliquez pour sélectionner</p>
          <p className="text-xs text-muted-foreground mt-1">
            Tous les fichiers .dcm du dossier seront analysés automatiquement
          </p>
          {!isProcessing && selectedFiles.length === 0 && (
            <p className="text-xs text-primary mt-2 font-medium">
              💡 Astuce : Vous pouvez aussi sélectionner des fichiers individuels en maintenant Ctrl/Cmd
            </p>
          )}
        </div>

        {/* Selected Folder/Files */}
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
                <span className="text-sm font-medium">{selectedFiles.length} fichier(s) DICOM</span>
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
                    ... et {selectedFiles.length - 20} autres fichiers
                  </div>
                )}
              </div>
            </ScrollArea>

            <Button onClick={processFiles} disabled={isProcessing} className="w-full">
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyse en cours... ({selectedFiles.length} fichiers)
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Extraire les données DICOM RT
                </>
              )}
            </Button>
          </div>
        )}

        {/* Loading Progress */}
        {isProcessing && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Analyse en cours...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
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
          <Tabs defaultValue="patient" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="patient">Patient</TabsTrigger>
              <TabsTrigger value="structures">Structures ({parsedData.structures?.length || 0})</TabsTrigger>
              <TabsTrigger value="dose">Dose</TabsTrigger>
              <TabsTrigger value="plan">Plan</TabsTrigger>
            </TabsList>

            <TabsContent value="patient" className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">ID Patient:</div>
                <div className="font-medium">{parsedData.patientId || "N/A"}</div>
                <div className="text-muted-foreground">Nom:</div>
                <div className="font-medium">{parsedData.patientName || "N/A"}</div>
                <div className="text-muted-foreground">Date d'étude:</div>
                <div className="font-medium">{parsedData.studyDate || "N/A"}</div>
                <div className="text-muted-foreground">Modalité:</div>
                <div className="font-medium">{parsedData.modality || "N/A"}</div>
              </div>
            </TabsContent>

            <TabsContent value="structures">
              <ScrollArea className="h-48">
                <div className="space-y-1">
                  {parsedData.structures?.map((struct, i) => (
                    <StructureItem key={i} structure={struct} />
                  ))}
                  {(!parsedData.structures || parsedData.structures.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucune structure trouvée</p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="dose" className="space-y-2">
              {parsedData.dose ? (
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-muted-foreground">Unité de dose:</div>
                    <div className="font-medium">{parsedData.dose.doseUnits || "N/A"}</div>
                    <div className="text-muted-foreground">Type de dose:</div>
                    <div className="font-medium">{parsedData.dose.doseType || "N/A"}</div>
                    <div className="text-muted-foreground">Dimensions grille:</div>
                    <div className="font-medium">{`${parsedData.dose.rows} × ${parsedData.dose.columns}`}</div>
                    <div className="text-muted-foreground">DVH disponibles:</div>
                    <div className="font-medium">{parsedData.dose.dvhs?.length || 0}</div>
                  </div>
                  {parsedData.dose.dvhs && parsedData.dose.dvhs.length > 0 && (
                    <div className="mt-2">
                      <div className="text-muted-foreground mb-1">Structures avec DVH:</div>
                      <div className="flex flex-wrap gap-1">
                        {parsedData.dose.dvhs.map((dvh, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            <Activity className="h-3 w-3 mr-1" />
                            ROI #{dvh.referencedROINumber}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée de dose trouvée</p>
              )}
            </TabsContent>

            <TabsContent value="plan" className="space-y-2">
              {parsedData.plan ? (
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-muted-foreground">Nom du plan:</div>
                    <div className="font-medium">{parsedData.plan.planName || "N/A"}</div>
                    <div className="text-muted-foreground">Nombre de fractions:</div>
                    <div className="font-medium">
                      {parsedData.plan.fractionGroups[0]?.numberOfFractionsPlanned || "N/A"}
                    </div>
                    <div className="text-muted-foreground">Date:</div>
                    <div className="font-medium">{parsedData.plan.planDate || "N/A"}</div>
                    <div className="text-muted-foreground">Nombre de faisceaux:</div>
                    <div className="font-medium">{parsedData.plan.beams?.length || 0}</div>
                  </div>
                  {parsedData.plan.beams && parsedData.plan.beams.length > 0 && (
                    <div className="mt-2">
                      <div className="text-muted-foreground mb-1">Faisceaux:</div>
                      <ScrollArea className="h-24">
                        <div className="space-y-1">
                          {parsedData.plan.beams.map((beam, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1">
                              <FileText className="h-3 w-3" />
                              <span className="font-medium">{beam.beamName || `Beam ${beam.beamNumber}`}</span>
                              <span className="text-muted-foreground">
                                {beam.radiationType} - {beam.treatmentMachineName}
                              </span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée de plan trouvée</p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

// Helper component for structure display
const StructureItem: React.FC<{ structure: DicomRTStructure }> = ({ structure }) => {
  const colorStyle = structure.color
    ? {
        backgroundColor: `rgb(${structure.color.join(",")})`,
      }
    : {};

  return (
    <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
      <div className="w-4 h-4 rounded-full border border-border" style={colorStyle} />
      <span className="text-sm font-medium flex-1">{structure.name}</span>
      <Badge variant="outline" className="text-xs">
        ROI #{structure.roiNumber}
      </Badge>
    </div>
  );
};

export default DicomRTUpload;
