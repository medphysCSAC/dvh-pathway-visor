import React, { useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Upload, FileText, AlertCircle, FolderOpen, Files, Loader2, CheckCircle2, X, FileCheck,
} from 'lucide-react';
import { ContextualHelp } from './ContextualHelp';
import { parseDicomFile } from '@/utils/dicomRTParser';
import * as dicomParser from 'dicom-parser';
import { DicomRTData } from '@/types/dicomRT';
import { toast } from 'sonner';

interface UnifiedPlanUploadProps {
  onCsvLoaded: (relFile: File, absFile?: File) => void;
  onDicomLoaded: (data: DicomRTData) => void;
}

type CsvKind = 'CSV_REL' | 'CSV_ABS' | 'CSV_UNKNOWN';
type DicomKind = 'RTSTRUCT' | 'RTDOSE' | 'RTPLAN' | 'CT' | 'DICOM_UNKNOWN';
type FileKind = CsvKind | DicomKind | 'UNSUPPORTED';

interface DetectedFile {
  file: File;
  kind: FileKind;
}

const isCsvName = (name: string) => /\.(txt|csv)$/i.test(name);
const isDcmName = (name: string) => /\.dcm$/i.test(name);

const detectCsvKind = (name: string): CsvKind => {
  const upper = name.toUpperCase();
  if (upper.includes('_REL') || upper.includes('REL.')) return 'CSV_REL';
  if (upper.includes('_ABS') || upper.includes('ABS.')) return 'CSV_ABS';
  return 'CSV_UNKNOWN';
};

const detectDicomKind = (name: string): DicomKind => {
  const lower = name.toLowerCase();
  // Match RS / RD / RP / CT as tokens at start, end, or surrounded by non-alphanumeric separators (., _, -, space)
  const tokenAt = (token: string) =>
    new RegExp(`(^|[^a-z0-9])${token}([^a-z0-9]|$)`, 'i').test(lower);

  if (lower.includes('rtstruct') || tokenAt('rs')) return 'RTSTRUCT';
  if (lower.includes('rtdose') || tokenAt('rd')) return 'RTDOSE';
  if (lower.includes('rtplan') || tokenAt('rp')) return 'RTPLAN';
  if (tokenAt('ct')) return 'CT';
  return 'DICOM_UNKNOWN';
};

const detectKind = (file: File): FileKind => {
  if (isCsvName(file.name)) return detectCsvKind(file.name);
  if (isDcmName(file.name)) return detectDicomKind(file.name);
  return 'UNSUPPORTED';
};

const KindBadge: React.FC<{ kind: FileKind }> = ({ kind }) => {
  const config: Record<FileKind, { label: string; className: string }> = {
    CSV_REL: { label: 'CSV REL', className: 'bg-primary/15 text-primary border-primary/30' },
    CSV_ABS: { label: 'CSV ABS', className: 'bg-accent/15 text-accent-foreground border-accent/30' },
    CSV_UNKNOWN: { label: 'CSV ?', className: 'bg-muted text-muted-foreground border-border' },
    RTSTRUCT: { label: 'RTSTRUCT', className: 'bg-info/15 text-info border-info/30' },
    RTDOSE: { label: 'RTDOSE', className: 'bg-success/15 text-success border-success/30' },
    RTPLAN: { label: 'RTPLAN', className: 'bg-secondary text-secondary-foreground border-border' },
    CT: { label: 'CT', className: 'bg-muted text-muted-foreground border-border' },
    DICOM_UNKNOWN: { label: 'DICOM ?', className: 'bg-muted text-muted-foreground border-border' },
    UNSUPPORTED: { label: 'Non supporté', className: 'bg-destructive/10 text-destructive border-destructive/30' },
  };
  const { label, className } = config[kind];
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-mono ${className}`}>
      {label}
    </Badge>
  );
};

export const UnifiedPlanUpload: React.FC<UnifiedPlanUploadProps> = ({ onCsvLoaded, onDicomLoaded }) => {
  const [files, setFiles] = useState<DetectedFile[]>([]);
  const [error, setError] = useState<string>('');
  const [isDragActive, setIsDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const readDirectory = useCallback(async (entry: FileSystemDirectoryEntry): Promise<File[]> => {
    const collected: File[] = [];
    const readEntries = (dir: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> =>
      new Promise((resolve, reject) => dir.createReader().readEntries(resolve, reject));

    const entries = await readEntries(entry);
    for (const e of entries) {
      if (e.isDirectory) {
        const sub = await readDirectory(e as FileSystemDirectoryEntry);
        collected.push(...sub);
      } else if (e.isFile) {
        const fileEntry = e as FileSystemFileEntry;
        if (isDcmName(fileEntry.name) || isCsvName(fileEntry.name)) {
          const f = await new Promise<File>((res, rej) => fileEntry.file(res, rej));
          collected.push(f);
        }
      }
    }
    return collected;
  }, []);

  // Resolve real DICOM type by reading SOPClassUID — fallback for unusual filenames
  const resolveDicomType = useCallback(async (file: File): Promise<DicomKind> => {
    try {
      const buf = await file.arrayBuffer();
      const ds = dicomParser.parseDicom(new Uint8Array(buf));
      const sop = ds.string('x00080016') || '';
      const modality = (ds.string('x00080060') || '').toUpperCase();
      if (sop === '1.2.840.10008.5.1.4.1.1.481.3' || modality === 'RTSTRUCT') return 'RTSTRUCT';
      if (sop === '1.2.840.10008.5.1.4.1.1.481.2' || modality === 'RTDOSE') return 'RTDOSE';
      if (sop === '1.2.840.10008.5.1.4.1.1.481.5' || modality === 'RTPLAN') return 'RTPLAN';
      if (sop === '1.2.840.10008.5.1.4.1.1.2' || modality === 'CT') return 'CT';
      return 'DICOM_UNKNOWN';
    } catch {
      return 'DICOM_UNKNOWN';
    }
  }, []);

  const ingestFiles = useCallback(async (rawFiles: File[]) => {
    setError('');
    const detected: DetectedFile[] = rawFiles
      .map((file) => ({ file, kind: detectKind(file) }))
      .filter((d) => d.kind !== 'UNSUPPORTED');

    if (detected.length === 0) {
      setError('Aucun fichier supporté (.txt, .csv, .dcm) détecté');
      return;
    }

    // Resolve DICOM_UNKNOWN by parsing SOPClassUID
    await Promise.all(
      detected.map(async (d, i) => {
        if (d.kind === 'DICOM_UNKNOWN' && isDcmName(d.file.name)) {
          detected[i] = { ...d, kind: await resolveDicomType(d.file) };
        }
      })
    );

    // Merge with previous files, dedupe by name+size
    setFiles((prev) => {
      const merged = [...prev];
      for (const d of detected) {
        if (!merged.some((m) => m.file.name === d.file.name && m.file.size === d.file.size)) {
          merged.push(d);
        }
      }
      return merged;
    });
  }, [resolveDicomType]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    ingestFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    const dt = e.dataTransfer;
    const items = Array.from(dt.items || []);
    const collected: File[] = [];

    let folderHandled = false;
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry?.isDirectory) {
        folderHandled = true;
        const dirFiles = await readDirectory(entry as FileSystemDirectoryEntry);
        collected.push(...dirFiles);
      }
    }

    if (!folderHandled && dt.files.length > 0) {
      collected.push(...Array.from(dt.files));
    }

    if (collected.length === 0) {
      setError('Aucun fichier détecté');
      return;
    }
    ingestFiles(collected);
  }, [readDirectory, ingestFiles]);

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearAll = () => {
    setFiles([]);
    setError('');
  };

  // Classify the current selection
  const csvFiles = files.filter((f) => f.kind === 'CSV_REL' || f.kind === 'CSV_ABS' || f.kind === 'CSV_UNKNOWN');
  const dicomFiles = files.filter((f) => ['RTSTRUCT', 'RTDOSE', 'RTPLAN', 'CT', 'DICOM_UNKNOWN'].includes(f.kind));

  const detectedFormat: 'csv' | 'dicom' | 'mixed' | 'none' =
    csvFiles.length > 0 && dicomFiles.length > 0 ? 'mixed'
    : csvFiles.length > 0 ? 'csv'
    : dicomFiles.length > 0 ? 'dicom'
    : 'none';

  const csvRel = csvFiles.find((f) => f.kind === 'CSV_REL');
  const csvAbs = csvFiles.find((f) => f.kind === 'CSV_ABS');
  const hasRtStruct = dicomFiles.some((f) => f.kind === 'RTSTRUCT');
  const hasRtDose = dicomFiles.some((f) => f.kind === 'RTDOSE');

  const canAnalyze =
    (detectedFormat === 'csv' && !!csvRel) ||
    (detectedFormat === 'dicom' && hasRtStruct && hasRtDose);

  const validationMessage = (() => {
    if (detectedFormat === 'none') return null;
    if (detectedFormat === 'mixed') return 'Mélange CSV + DICOM détecté. Veuillez choisir un seul format pour un plan unique.';
    if (detectedFormat === 'csv' && !csvRel) return 'Fichier DVH REL manquant (requis).';
    if (detectedFormat === 'dicom' && !hasRtStruct) return 'Fichier RTSTRUCT manquant (requis).';
    if (detectedFormat === 'dicom' && !hasRtDose) return 'Fichier RTDOSE manquant (requis).';
    return null;
  })();

  const handleAnalyze = async () => {
    if (!canAnalyze) return;
    setError('');

    if (detectedFormat === 'csv' && csvRel) {
      onCsvLoaded(csvRel.file, csvAbs?.file);
      return;
    }

    if (detectedFormat === 'dicom') {
      try {
        setIsProcessing(true);
        setProgress(0);
        const combined: DicomRTData = {
          structures: [],
          dose: undefined,
          plan: undefined,
          patientId: undefined,
          patientName: undefined,
        } as unknown as DicomRTData;

        for (let i = 0; i < dicomFiles.length; i++) {
          const { file } = dicomFiles[i];
          setProgress(Math.round(((i + 1) / dicomFiles.length) * 100));
          const parsed = await parseDicomFile(file);
          if (parsed.structures?.length) combined.structures = parsed.structures;
          if (parsed.dose) (combined as any).dose = parsed.dose;
          if (parsed.plan) (combined as any).plan = parsed.plan;
          if (parsed.patientId) (combined as any).patientId = parsed.patientId;
          if (parsed.patientName) (combined as any).patientName = parsed.patientName;
        }

        onDicomLoaded(combined);
      } catch (err) {
        console.error(err);
        const msg = err instanceof Error ? err.message : 'Erreur lors du parsing DICOM';
        setError(msg);
        toast.error('Erreur DICOM', { description: msg });
      } finally {
        setIsProcessing(false);
        setProgress(0);
      }
    }
  };

  return (
    <Card className="border-2 border-dashed border-border">
      <CardContent className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="rounded-full bg-gradient-to-br from-primary to-accent p-3">
            <Upload className="w-7 h-7 text-primary-foreground" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold">Charger un plan</h3>
            <ContextualHelp
              content="Glissez vos fichiers CSV TomoTherapy (REL/ABS) ou vos fichiers DICOM RT (RTSTRUCT + RTDOSE + RTPLAN). Le format est détecté automatiquement. Vous pouvez aussi déposer un dossier entier."
              side="right"
            />
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
            Formats acceptés : <span className="font-medium">CSV TomoTherapy</span> (.txt/.csv) ou <span className="font-medium">DICOM RT</span> (.dcm). Détection automatique.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={handleDrop}
          className={`rounded-lg border-2 border-dashed p-8 transition-colors ${
            isDragActive ? 'border-primary bg-primary/5' : 'border-border bg-card'
          }`}
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <FolderOpen className="w-10 h-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Glissez fichiers ou un dossier ici</p>
              <p className="text-xs text-muted-foreground mt-1">
                CSV REL/ABS ou DICOM (RTSTRUCT + RTDOSE + RTPLAN)
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <input
                ref={filesInputRef}
                type="file"
                multiple
                accept=".txt,.csv,.dcm"
                className="hidden"
                onChange={handleInputChange}
              />
              <input
                ref={folderInputRef}
                type="file"
                {...({ webkitdirectory: '', directory: '' } as any)}
                className="hidden"
                onChange={handleInputChange}
              />
              <Button variant="outline" size="sm" onClick={() => filesInputRef.current?.click()}>
                <Files className="w-4 h-4 mr-2" />
                Sélectionner fichiers
              </Button>
              <Button variant="outline" size="sm" onClick={() => folderInputRef.current?.click()}>
                <FolderOpen className="w-4 h-4 mr-2" />
                Sélectionner dossier
              </Button>
            </div>
          </div>
        </div>

        {/* Detected files */}
        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-primary" />
                Fichiers détectés ({files.length})
              </h4>
              <Button variant="ghost" size="sm" onClick={clearAll}>
                <X className="w-4 h-4 mr-1" /> Tout effacer
              </Button>
            </div>
            <div className="rounded-md border bg-card divide-y max-h-64 overflow-auto">
              {files.map((f, idx) => (
                <div key={`${f.file.name}-${idx}`} className="flex items-center justify-between gap-2 p-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{f.file.name}</span>
                    <KindBadge kind={f.kind} />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => removeFile(idx)}
                    aria-label="Retirer"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Format summary */}
            {detectedFormat !== 'none' && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                {detectedFormat === 'csv' && (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    Plan TomoTherapy détecté (REL{csvAbs ? ' + ABS' : ''})
                  </>
                )}
                {detectedFormat === 'dicom' && (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    Plan DICOM RT détecté ({dicomFiles.filter((f) => f.kind === 'RTSTRUCT').length} RTSTRUCT, {dicomFiles.filter((f) => f.kind === 'RTDOSE').length} RTDOSE
                    {dicomFiles.some((f) => f.kind === 'RTPLAN') ? `, ${dicomFiles.filter((f) => f.kind === 'RTPLAN').length} RTPLAN` : ''})
                  </>
                )}
                {detectedFormat === 'mixed' && (
                  <>
                    <AlertCircle className="w-4 h-4 text-warning" />
                    Mélange de formats détecté
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Validation message */}
        {validationMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{validationMessage}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Progress */}
        {isProcessing && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground text-center">
              <Loader2 className="w-3 h-3 inline animate-spin mr-1" />
              Analyse en cours… {progress}%
            </p>
          </div>
        )}

        {/* Action */}
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleAnalyze}
            disabled={!canAnalyze || isProcessing}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            {isProcessing ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyse…</>
            ) : (
              'Analyser le plan'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default UnifiedPlanUpload;
