import { useState, useCallback } from 'react';
import { Upload, FileText, X, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FilePair, PlanData } from '@/types/dvh';
import { parseTomoTherapyDVH } from '@/utils/dvhParser';
import { useToast } from '@/hooks/use-toast';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MultiFileUploadProps {
  onPlansLoaded: (plans: PlanData[], mode: 'summation' | 'comparison' | 'multi-patient') => void;
}

export const MultiFileUpload = ({ onPlansLoaded }: MultiFileUploadProps) => {
  const [mode, setMode] = useState<'summation' | 'comparison' | 'multi-patient'>('summation');
  const [filePairs, setFilePairs] = useState<FilePair[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const detectFilePairs = useCallback((files: File[]): FilePair[] => {
    const pairs: FilePair[] = [];
    const processedFiles = new Set<string>();
    
    files.forEach(file => {
      if (processedFiles.has(file.name)) return;
      
      const nameWithoutExt = file.name.replace(/\.(txt|csv)$/i, '');
      const isRel = /_REL$/i.test(nameWithoutExt);
      const isAbs = /_ABS$/i.test(nameWithoutExt);
      
      if (isRel) {
        const baseName = nameWithoutExt.replace(/_REL$/i, '');
        const absFileName = `${baseName}_ABS.txt`;
        const absFile = files.find(f => f.name === absFileName || f.name === absFileName.replace('.txt', '.csv'));
        
        if (absFile) {
          pairs.push({
            relFile: file,
            absFile,
            planName: baseName,
            detected: true
          });
          processedFiles.add(file.name);
          processedFiles.add(absFile.name);
        }
      } else if (isAbs) {
        const baseName = nameWithoutExt.replace(/_ABS$/i, '');
        const relFileName = `${baseName}_REL.txt`;
        const relFile = files.find(f => f.name === relFileName || f.name === relFileName.replace('.txt', '.csv'));
        
        if (relFile && !processedFiles.has(relFile.name)) {
          pairs.push({
            relFile,
            absFile: file,
            planName: baseName,
            detected: true
          });
          processedFiles.add(relFile.name);
          processedFiles.add(file.name);
        }
      }
    });
    
    return pairs;
  }, []);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    
    const fileArray = Array.from(files);
    const detected = detectFilePairs(fileArray);
    
    if (detected.length === 0) {
      toast({
        title: "Aucune paire détectée",
        description: "Les fichiers doivent se terminer par _REL.txt et _ABS.txt",
        variant: "destructive",
      });
      return;
    }
    
    setFilePairs(detected);
    toast({
      title: `${detected.length} paire(s) détectée(s)`,
      description: "Cliquez sur 'Analyser les plans' pour continuer",
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFilesSelected(e.dataTransfer.files);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const removePair = (index: number) => {
    setFilePairs(prev => prev.filter((_, i) => i !== index));
  };

  const analyzePlans = async () => {
    if (filePairs.length === 0) {
      toast({
        title: "Aucun fichier",
        description: "Veuillez sélectionner des fichiers DVH",
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const plans: PlanData[] = [];
      
      for (const pair of filePairs) {
        const relContent = await pair.relFile.text();
        const absContent = await pair.absFile.text();
        
        const dvhData = parseTomoTherapyDVH(relContent, absContent);
        
        plans.push({
          id: `plan_${Date.now()}_${Math.random()}`,
          name: pair.planName,
          patientId: dvhData.patientId,
          structures: dvhData.structures,
          uploadDate: new Date()
        });
      }
      
      onPlansLoaded(plans, mode);
      
      toast({
        title: "Import réussi",
        description: `${plans.length} plan(s) importé(s) en mode ${mode}`,
      });
    } catch (error) {
      console.error('Erreur lors de l\'analyse:', error);
      toast({
        title: "Erreur d'analyse",
        description: "Impossible d'analyser les fichiers DVH",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Import Multi-Plans
        </CardTitle>
        <CardDescription>
          Importez plusieurs paires de fichiers DVH pour sommation ou comparaison
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Mode d'analyse</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="summation">Sommation de plans</SelectItem>
              <SelectItem value="comparison">Comparaison de plans</SelectItem>
              <SelectItem value="multi-patient">Multi-patients</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {mode === 'summation' && 'Les doses des structures seront additionnées'}
            {mode === 'comparison' && 'Les plans seront comparés côte-à-côte'}
            {mode === 'multi-patient' && 'Gestion de plusieurs patients'}
          </p>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-border hover:border-primary transition-colors rounded-lg p-8 text-center"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="font-medium mb-1">Glissez-déposez vos fichiers DVH ici</p>
              <p className="text-sm text-muted-foreground">
                ou cliquez pour sélectionner
              </p>
            </div>
            <Input
              type="file"
              multiple
              accept=".txt,.csv"
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
              id="multi-file-input"
            />
            <Button asChild variant="outline">
              <label htmlFor="multi-file-input" className="cursor-pointer">
                Sélectionner fichiers
              </label>
            </Button>
          </div>
        </div>

        {filePairs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Fichiers détectés ({filePairs.length} paire{filePairs.length > 1 ? 's' : ''})</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilePairs([])}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Tout effacer
              </Button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filePairs.map((pair, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 bg-muted rounded-lg group"
                >
                  {pair.detected ? (
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{pair.planName}</div>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{pair.relFile.name}</span>
                      <span>+</span>
                      <span className="truncate">{pair.absFile.name}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePair(index)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button
          onClick={analyzePlans}
          disabled={filePairs.length === 0 || isProcessing}
          className="w-full"
          size="lg"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-background border-t-transparent mr-2" />
              Analyse en cours...
            </>
          ) : (
            <>Analyser les plans ({filePairs.length})</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
