import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, CheckCircle2, AlertCircle, Loader2, FolderOpen, Activity, 
  FileText, Trash2, Files, AlertTriangle, FileCheck, Target, Shield, Crosshair, Box
} from "lucide-react";
import { toast } from "sonner";
import { parseDicomFile } from "@/utils/dicomRTParser";
import { DicomRTData, DicomRTStructure, DicomRTFileType, ParsedFileInfo, RTComponentsSummary } from "@/types/dicomRT";

interface DicomRTUploadProps {
  onDataLoaded?: (data: DicomRTData) => void;
}

// Détection du type IOD basée sur le nom de fichier et les patterns courants
const detectFileType = (fileName: string): DicomRTFileType => {
  const name = fileName.toLowerCase();
  if (name.includes('rtstruct') || name.includes('rs.') || name.includes('_rs_')) return 'RTSTRUCT';
  if (name.includes('rtdose') || name.includes('rd.') || name.includes('_rd_')) return 'RTDOSE';
  if (name.includes('rtplan') || name.includes('rp.') || name.includes('_rp_')) return 'RTPLAN';
  if (name.includes('ct') || name.includes('_ct_')) return 'CT';
  return 'UNKNOWN';
};

// Badge de type IOD avec couleur
const IODTypeBadge: React.FC<{ type: DicomRTFileType }> = ({ type }) => {
  const config: Record<DicomRTFileType, { color: string; label: string }> = {
    RTSTRUCT: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'RS' },
    RTDOSE: { color: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'RD' },
    RTPLAN: { color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', label: 'RP' },
    CT: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', label: 'CT' },
    UNKNOWN: { color: 'bg-muted text-muted-foreground border-border', label: '?' },
  };
  
  const { color, label } = config[type];
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-mono ${color}`}>
      {label}
    </Badge>
  );
};

// Badge de type de structure (PTV, OAR, etc.)
const StructureTypeBadge: React.FC<{ type?: string }> = ({ type }) => {
  if (!type) return null;
  
  const typeUpper = type.toUpperCase();
  const config: Record<string, { icon: React.ReactNode; color: string }> = {
    PTV: { icon: <Target className="h-3 w-3" />, color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    CTV: { icon: <Crosshair className="h-3 w-3" />, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    GTV: { icon: <Crosshair className="h-3 w-3" />, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    EXTERNAL: { icon: <Box className="h-3 w-3" />, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
    AVOIDANCE: { icon: <Shield className="h-3 w-3" />, color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    ORGAN: { icon: <Shield className="h-3 w-3" />, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  };
  
  // Détecter le type principal
  let matchedType = 'ORGAN';
  for (const key of Object.keys(config)) {
    if (typeUpper.includes(key)) {
      matchedType = key;
      break;
    }
  }
  
  const { icon, color } = config[matchedType] || config.ORGAN;
  
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-0.5 ${color}`}>
      {icon}
      <span>{type}</span>
    </Badge>
  );
};

export const DicomRTUpload: React.FC<DicomRTUploadProps> = ({ onDataLoaded }) => {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<string>("");
  const [parsedData, setParsedData] = useState<DicomRTData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<ParsedFileInfo[]>([]);
  const [folderName, setFolderName] = useState<string>("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [componentsSummary, setComponentsSummary] = useState<RTComponentsSummary | null>(null);

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

  const filterDicomFiles = useCallback((files: File[]): ParsedFileInfo[] => {
    return files
      .filter((f) => /\.dcm$/i.test(f.name))
      .map((f) => ({
        name: f.name,
        type: detectFileType(f.name),
        size: f.size,
      }));
  }, []);

  const handleFilesSelected = useCallback(
    async (files: FileList | null, isFolder: boolean = false) => {
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files);
      const dicomFiles = filterDicomFiles(fileArray);

      // Détecter si c'est une sélection de dossier (webkitdirectory)
      if (isFolder) {
        const firstPath = (fileArray[0] as any).webkitRelativePath;
        const folder = firstPath?.split("/")[0] || "Dossier sélectionné";
        setFolderName(folder);
      } else {
        setFolderName("");
      }

      if (dicomFiles.length === 0) {
        setError("Aucun fichier DICOM (.dcm) trouvé dans la sélection");
        return;
      }

      setSelectedFiles(dicomFiles);
      setError(null);
      setComponentsSummary(null);
      setParsedData(null);
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
      let detectedFolderName: string = "";
      let isFolderDrop = false;

      for (const item of items) {
        const entry = item.webkitGetAsEntry();
        if (entry && entry.isDirectory) {
          isFolderDrop = true;
          detectedFolderName = entry.name;
          const dirFiles = await readDirectory(entry as FileSystemDirectoryEntry);
          allFiles.push(...dirFiles);
          break;
        }
      }

      if (!isFolderDrop && dataTransfer.files.length > 0) {
        allFiles = Array.from(dataTransfer.files).filter((f) => /\.dcm$/i.test(f.name));
        setFolderName("");
      }

      if (allFiles.length === 0) {
        setError("Aucun fichier DICOM (.dcm) trouvé dans la sélection.");
        setSelectedFiles([]);
        setFolderName("");
        return;
      }

      const parsedFiles = allFiles.map((f) => ({
        name: f.name,
        type: detectFileType(f.name),
        size: f.size,
      }));

      setSelectedFiles(parsedFiles);
      setFolderName(detectedFolderName);
      setError(null);
      setComponentsSummary(null);
      setParsedData(null);
      
      // Stocker les vrais fichiers pour le processing
      (window as any).__dicomFiles = allFiles;
    },
    [readDirectory],
  );

  const processFiles = async () => {
    // Récupérer les fichiers depuis le drop ou l'input
    let filesToProcess: File[] = (window as any).__dicomFiles || [];
    
    // Si pas de fichiers du drop, essayer de les récupérer depuis les inputs
    if (filesToProcess.length === 0) {
      const folderInput = folderInputRef.current;
      const filesInput = filesInputRef.current;
      if (folderInput?.files?.length) {
        filesToProcess = Array.from(folderInput.files).filter((f) => /\.dcm$/i.test(f.name));
      } else if (filesInput?.files?.length) {
        filesToProcess = Array.from(filesInput.files).filter((f) => /\.dcm$/i.test(f.name));
      }
    }

    if (filesToProcess.length === 0) {
      setError("Aucun fichier à traiter");
      return;
    }

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

      const total = filesToProcess.length;
      let parsed = 0;
      let firstPatientId = "";
      let differentPatients = false;

      // Tracking des types de fichiers trouvés
      let foundRTSTRUCT = false;
      let foundRTDOSE = false;
      let foundRTPLAN = false;

      for (const file of filesToProcess) {
        try {
          setCurrentFile(file.name);
          const data = await parseDicomFile(file);

          if (!firstPatientId) {
            firstPatientId = data.patientId;
          } else if (data.patientId && data.patientId !== firstPatientId) {
            differentPatients = true;
            console.warn(`Fichier de patient différent détecté: ${file.name}`);
          }

          // Détecter le type de fichier basé sur le contenu
          if (data.structures?.length) {
            foundRTSTRUCT = true;
            combinedData.structures = [...(combinedData.structures || []), ...data.structures];
          }
          if (data.dose) {
            foundRTDOSE = true;
            combinedData.dose = combinedData.dose
              ? {
                  ...combinedData.dose,
                  ...data.dose,
                  dvhs: [...(combinedData.dose.dvhs || []), ...(data.dose.dvhs || [])],
                }
              : data.dose;
          }
          if (data.plan) {
            foundRTPLAN = true;
            combinedData.plan = { ...combinedData.plan, ...data.plan };
          }

          // Merge patient info
          if (data.patientId) combinedData.patientId = data.patientId;
          if (data.patientName) combinedData.patientName = data.patientName;
          if (data.studyDate) combinedData.studyDate = data.studyDate;
          if (data.modality) combinedData.modality = data.modality;

        } catch (err) {
          console.warn(`Failed to parse ${file.name}:`, err);
        }

        parsed++;
        setProgress(Math.round((parsed / total) * 100));

        if (parsed % 5 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      setCurrentFile("");

      if (differentPatients) {
        toast.warning('Attention: Fichiers de patients différents détectés');
      }

      // Créer le résumé des composants
      const summary: RTComponentsSummary = {
        hasRTSTRUCT: foundRTSTRUCT,
        hasRTDOSE: foundRTDOSE,
        hasRTPLAN: foundRTPLAN,
        structureCount: combinedData.structures?.length || 0,
        dvhCount: combinedData.dose?.dvhs?.length || 0,
        isEmpty: {
          structures: foundRTSTRUCT && (combinedData.structures?.length || 0) === 0,
          dose: foundRTDOSE && !combinedData.dose?.doseData && (combinedData.dose?.dvhs?.length || 0) === 0,
          plan: foundRTPLAN && !combinedData.plan?.planName,
        },
      };

      setComponentsSummary(summary);
      setParsedData(combinedData);
      onDataLoaded?.(combinedData);

      toast.success(`Dossier DICOM RT chargé`, {
        description: `${total} fichiers analysés`,
      });

      // Nettoyer
      (window as any).__dicomFiles = undefined;

    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur de parsing DICOM";
      setError(message);
      toast.error("Erreur de parsing", { description: message });
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setCurrentFile("");
    }
  };

  const clearSelection = () => {
    setSelectedFiles([]);
    setParsedData(null);
    setError(null);
    setFolderName("");
    setComponentsSummary(null);
    (window as any).__dicomFiles = undefined;
    if (folderInputRef.current) folderInputRef.current.value = "";
    if (filesInputRef.current) filesInputRef.current.value = "";
  };

  // Compter les types de fichiers
  const typeCounts = selectedFiles.reduce((acc, f) => {
    acc[f.type] = (acc[f.type] || 0) + 1;
    return acc;
  }, {} as Record<DicomRTFileType, number>);

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary" />
          Import Dossier DICOM RT
        </CardTitle>
        {/* 1.a: Résumé dynamique après chargement */}
        {componentsSummary ? (
          <CardDescription className="flex items-center gap-2 flex-wrap">
            <span className="text-foreground font-medium">Chargé:</span>
            {componentsSummary.hasRTSTRUCT && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                <FileCheck className="h-3 w-3 mr-1" />
                RS ({componentsSummary.structureCount} structures)
              </Badge>
            )}
            {componentsSummary.hasRTDOSE && (
              <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                <FileCheck className="h-3 w-3 mr-1" />
                RD ({componentsSummary.dvhCount} DVH)
              </Badge>
            )}
            {componentsSummary.hasRTPLAN && (
              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                <FileCheck className="h-3 w-3 mr-1" />
                RP
              </Badge>
            )}
          </CardDescription>
        ) : (
          <CardDescription>
            Sélectionnez un dossier ou des fichiers RT Structure, RT Dose et RT Plan
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 2: Alertes composants manquants */}
        {componentsSummary && (
          <div className="space-y-2">
            {!componentsSummary.hasRTSTRUCT && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-sm">RTSTRUCT Manquant</AlertTitle>
                <AlertDescription className="text-xs">
                  Aucun fichier RT Structure trouvé. Les contours ne seront pas disponibles.
                </AlertDescription>
              </Alert>
            )}
            {!componentsSummary.hasRTDOSE && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-sm">RTDOSE Manquant</AlertTitle>
                <AlertDescription className="text-xs">
                  Aucun fichier RT Dose trouvé. L'analyse DVH ne sera pas possible.
                </AlertDescription>
              </Alert>
            )}
            {!componentsSummary.hasRTPLAN && (
              <Alert className="py-2 border-yellow-500/50 bg-yellow-500/10">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <AlertTitle className="text-sm text-yellow-500">RTPLAN Manquant</AlertTitle>
                <AlertDescription className="text-xs text-yellow-400">
                  Aucun fichier RT Plan trouvé. Les informations de fractionnement ne seront pas disponibles.
                </AlertDescription>
              </Alert>
            )}
            {/* 1.c: Avertissements fichiers vides */}
            {componentsSummary.isEmpty.structures && (
              <Alert className="py-2 border-orange-500/50 bg-orange-500/10">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <AlertTitle className="text-sm text-orange-500">RTSTRUCT Vide</AlertTitle>
                <AlertDescription className="text-xs text-orange-400">
                  Fichier RT Structure trouvé mais ne contient aucune structure définie.
                </AlertDescription>
              </Alert>
            )}
            {componentsSummary.isEmpty.dose && (
              <Alert className="py-2 border-orange-500/50 bg-orange-500/10">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <AlertTitle className="text-sm text-orange-500">RTDOSE Vide</AlertTitle>
                <AlertDescription className="text-xs text-orange-400">
                  Fichier RT Dose trouvé mais ne contient aucune donnée DVH.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors
            ${isDragActive ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/50"}
          `}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={() => setIsDragActive(false)}
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-3">
            Glissez-déposez un dossier DICOM ou des fichiers
          </p>
          
          {/* 3: Deux boutons séparés */}
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => folderInputRef.current?.click()}
              disabled={isProcessing}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Dossier RT
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => filesInputRef.current?.click()}
              disabled={isProcessing}
            >
              <Files className="h-4 w-4 mr-2" />
              Fichiers Multiples
            </Button>
          </div>
          
          {/* Hidden inputs */}
          <input
            ref={folderInputRef}
            type="file"
            multiple
            // @ts-ignore
            webkitdirectory=""
            // @ts-ignore
            directory=""
            accept=".dcm"
            className="hidden"
            onChange={(e) => {
              handleFilesSelected(e.target.files, true);
              // Stocker les fichiers
              if (e.target.files) {
                (window as any).__dicomFiles = Array.from(e.target.files).filter((f) => /\.dcm$/i.test(f.name));
              }
            }}
          />
          <input
            ref={filesInputRef}
            type="file"
            multiple
            accept=".dcm"
            className="hidden"
            onChange={(e) => {
              handleFilesSelected(e.target.files, false);
              if (e.target.files) {
                (window as any).__dicomFiles = Array.from(e.target.files).filter((f) => /\.dcm$/i.test(f.name));
              }
            }}
          />
        </div>

        {/* Selected Folder/Files */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                {folderName && (
                  <Badge variant="outline" className="font-mono">
                    <FolderOpen className="h-3 w-3 mr-1" />
                    {folderName}
                  </Badge>
                )}
                <span className="text-sm font-medium">{selectedFiles.length} fichier(s) DICOM</span>
                {/* Résumé des types détectés */}
                <div className="flex gap-1">
                  {typeCounts.RTSTRUCT && (
                    <Badge variant="secondary" className="text-xs bg-blue-500/20 text-blue-400">
                      {typeCounts.RTSTRUCT} RS
                    </Badge>
                  )}
                  {typeCounts.RTDOSE && (
                    <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-400">
                      {typeCounts.RTDOSE} RD
                    </Badge>
                  )}
                  {typeCounts.RTPLAN && (
                    <Badge variant="secondary" className="text-xs bg-purple-500/20 text-purple-400">
                      {typeCounts.RTPLAN} RP
                    </Badge>
                  )}
                  {typeCounts.CT && (
                    <Badge variant="secondary" className="text-xs bg-gray-500/20 text-gray-400">
                      {typeCounts.CT} CT
                    </Badge>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <Trash2 className="h-4 w-4 mr-1" />
                Effacer
              </Button>
            </div>

            {/* 1.b: ScrollArea avec types IOD */}
            <ScrollArea className="h-32 rounded border border-border/50 p-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {selectedFiles.slice(0, 30).map((file, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground" title={file.name}>
                    <IODTypeBadge type={file.type} />
                    <span className="truncate flex-1">{file.name}</span>
                  </div>
                ))}
                {selectedFiles.length > 30 && (
                  <div className="text-xs text-muted-foreground col-span-2 text-center py-1">
                    ... et {selectedFiles.length - 30} autres fichiers
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

        {/* 6: Loading Progress avec nom de fichier en cours */}
        {isProcessing && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="truncate max-w-[70%]">
                {currentFile ? `Analyse: ${currentFile}` : "Analyse en cours..."}
              </span>
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
              <TabsTrigger value="structures">
                Structures ({parsedData.structures?.length || 0})
              </TabsTrigger>
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
                  {/* 1.c: Message spécifique si RTSTRUCT trouvé mais vide */}
                  {(!parsedData.structures || parsedData.structures.length === 0) && (
                    <div className="text-center py-4">
                      {componentsSummary?.hasRTSTRUCT ? (
                        <Alert className="border-orange-500/50 bg-orange-500/10">
                          <AlertCircle className="h-4 w-4 text-orange-500" />
                          <AlertDescription className="text-orange-400">
                            Fichier RTSTRUCT trouvé mais ne contient aucune structure.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Aucun fichier RTSTRUCT trouvé dans la sélection.
                        </p>
                      )}
                    </div>
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
                <div className="text-center py-4">
                  {componentsSummary?.hasRTDOSE ? (
                    <Alert className="border-orange-500/50 bg-orange-500/10">
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      <AlertDescription className="text-orange-400">
                        Fichier RTDOSE trouvé mais ne contient aucune donnée DVH exploitable.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aucun fichier RTDOSE trouvé dans la sélection.
                    </p>
                  )}
                </div>
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
                <div className="text-center py-4">
                  {componentsSummary?.hasRTPLAN ? (
                    <Alert className="border-orange-500/50 bg-orange-500/10">
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      <AlertDescription className="text-orange-400">
                        Fichier RTPLAN trouvé mais incomplet ou illisible.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aucun fichier RTPLAN trouvé dans la sélection.
                    </p>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

// 4: Helper component avec type de structure
const StructureItem: React.FC<{ structure: DicomRTStructure }> = ({ structure }) => {
  const colorStyle = structure.color
    ? {
        backgroundColor: `rgb(${structure.color.join(",")})`,
      }
    : {};

  return (
    <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
      <div className="w-4 h-4 rounded-full border border-border shrink-0" style={colorStyle} />
      <span className="text-sm font-medium flex-1 truncate">{structure.name}</span>
      {/* Type de structure (PTV, OAR, etc.) */}
      {structure.roiInterpretedType && (
        <StructureTypeBadge type={structure.roiInterpretedType} />
      )}
      <Badge variant="outline" className="text-xs shrink-0">
        ROI #{structure.roiNumber}
      </Badge>
    </div>
  );
};

export default DicomRTUpload;
