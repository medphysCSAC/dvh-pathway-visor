import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { TreatmentProtocol, OARConstraint, PrescriptionDose } from '@/types/protocol';

interface ProtocolFileExtractorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProtocolExtracted: (protocol: TreatmentProtocol) => void;
}

const ACCEPTED_TYPES = [
  'text/plain',
  'text/csv',
  'application/csv',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
  'application/json'
];

const ACCEPTED_EXTENSIONS = '.txt,.csv,.pdf,.docx,.xlsx,.doc,.xls,.json';

export const ProtocolFileExtractor: React.FC<ProtocolFileExtractorProps> = ({
  open,
  onOpenChange,
  onProtocolExtracted
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedProtocol, setExtractedProtocol] = useState<TreatmentProtocol | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [protocolName, setProtocolName] = useState('');
  const [protocolLocation, setProtocolLocation] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const resetState = () => {
    setFile(null);
    setIsProcessing(false);
    setExtractedProtocol(null);
    setError(null);
    setProtocolName('');
    setProtocolLocation('');
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const isValidType = ACCEPTED_TYPES.includes(selectedFile.type) || 
                        selectedFile.name.match(/\.(txt|csv|pdf|docx|xlsx|doc|xls|json)$/i);
    
    if (!isValidType) {
      setError('Format de fichier non supporté. Utilisez PDF, Word, Excel, CSV ou texte.');
      return;
    }

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('Le fichier est trop volumineux (max 10 Mo).');
      return;
    }

    setFile(selectedFile);
    setError(null);
    await processFile(selectedFile);
  };

  const processFile = async (fileToProcess: File) => {
    setIsProcessing(true);
    setError(null);

    try {
      // Convert file to base64
      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(fileToProcess);
      });

      // Determine mime type
      let mimeType = fileToProcess.type;
      if (!mimeType) {
        // Fallback based on extension
        const ext = fileToProcess.name.split('.').pop()?.toLowerCase();
        const mimeMap: Record<string, string> = {
          'txt': 'text/plain',
          'csv': 'text/csv',
          'pdf': 'application/pdf',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'doc': 'application/msword',
          'xls': 'application/vnd.ms-excel',
          'json': 'application/json'
        };
        mimeType = mimeMap[ext || ''] || 'application/octet-stream';
      }

      // Call edge function
      const { data, error: fnError } = await supabase.functions.invoke('extract-protocol-from-file', {
        body: {
          fileContent: base64Content,
          mimeType: mimeType,
          fileName: fileToProcess.name
        }
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.protocol) {
        throw new Error('Aucun protocole extrait du fichier');
      }

      const protocol = data.protocol as TreatmentProtocol;
      setExtractedProtocol(protocol);
      setProtocolName(protocol.name || fileToProcess.name.replace(/\.[^/.]+$/, ''));
      setProtocolLocation(protocol.location || '');

      toast({
        title: "Extraction réussie",
        description: `Protocole "${protocol.name}" extrait avec succès.`,
      });

    } catch (err) {
      console.error('Error processing file:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors du traitement du fichier';
      setError(errorMessage);
      toast({
        title: "Erreur d'extraction",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = () => {
    if (!extractedProtocol) return;

    const finalProtocol: TreatmentProtocol = {
      ...extractedProtocol,
      id: extractedProtocol.id || `file_extracted_${Date.now()}`,
      name: protocolName || extractedProtocol.name,
      location: protocolLocation || extractedProtocol.location,
      prescriptions: extractedProtocol.prescriptions || [],
      createdAt: extractedProtocol.createdAt || new Date(),
      modifiedAt: new Date(),
      isCustom: true,
      oarConstraints: (extractedProtocol.oarConstraints || []).map((c) => {
        if (c.constraintType === 'Vx') {
          return {
            ...c,
            targetUnit: (c.unit === 'cc' ? 'cc' : '%') as '%' | 'cc',
            unit: 'Gy' as const,
          };
        }
        if (c.constraintType === 'Dx') {
          return {
            ...c,
            targetUnit: (c.targetUnit || '%') as '%' | 'cc',
            unit: 'Gy' as const,
          };
        }
        return c;
      }),
    };

    onProtocolExtracted(finalProtocol);
    resetState();
    onOpenChange(false);

    toast({
      title: "Protocole sauvegardé",
      description: `Le protocole "${finalProtocol.name}" a été ajouté.`,
    });
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const getFileIcon = () => {
    if (!file) return <FileText className="h-12 w-12 text-muted-foreground" />;
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    const colors: Record<string, string> = {
      'pdf': 'text-red-500',
      'docx': 'text-blue-500',
      'doc': 'text-blue-500',
      'xlsx': 'text-green-500',
      'xls': 'text-green-500',
      'csv': 'text-orange-500',
      'txt': 'text-gray-500',
      'json': 'text-yellow-500'
    };
    
    return <FileText className={`h-12 w-12 ${colors[ext || ''] || 'text-muted-foreground'}`} />;
  };

  const formatConstraintType = (constraint: OARConstraint): string => {
    switch (constraint.constraintType) {
      case 'Vx':
        return `V${constraint.target || 0}${constraint.targetUnit === 'cc' ? 'cc' : 'Gy'}`;
      case 'Dx':
        return `D${constraint.target || 0}%`;
      case 'Dmax':
        return 'Dmax';
      case 'Dmean':
        return 'Dmean';
      default:
        return constraint.constraintType;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Créer un protocole depuis un fichier
          </DialogTitle>
          <DialogDescription>
            Importez un fichier (PDF, Word, Excel, CSV ou texte) contenant les informations du protocole
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload Zone */}
          {!extractedProtocol && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isProcessing ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                onChange={handleFileChange}
                className="hidden"
                disabled={isProcessing}
              />

              {isProcessing ? (
                <div className="space-y-3">
                  <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Analyse du fichier en cours...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    L'IA extrait les informations du protocole
                  </p>
                </div>
              ) : file ? (
                <div className="space-y-3">
                  {getFileIcon()}
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} Ko
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Sélectionner un fichier
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PDF, Word, Excel, CSV ou fichier texte (max 10 Mo)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Card className="border-destructive bg-destructive/10">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Erreur</p>
                  <p className="text-sm text-destructive/80">{error}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => {
                    setError(null);
                    setFile(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Extracted Protocol Display */}
          {extractedProtocol && (
            <div className="space-y-4">
              <Card className="border-green-500/50 bg-green-500/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium">Protocole extrait avec succès</span>
                </CardContent>
              </Card>

              {/* Editable Protocol Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="protocol-name">Nom du protocole</Label>
                  <Input
                    id="protocol-name"
                    value={protocolName}
                    onChange={(e) => setProtocolName(e.target.value)}
                    placeholder="Nom du protocole"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="protocol-location">Localisation</Label>
                  <Input
                    id="protocol-location"
                    value={protocolLocation}
                    onChange={(e) => setProtocolLocation(e.target.value)}
                    placeholder="Localisation anatomique"
                  />
                </div>
              </div>

              {/* Prescriptions */}
              {extractedProtocol.prescriptions && extractedProtocol.prescriptions.length > 0 && (
                <div className="space-y-2">
                  <Label>Prescriptions ({extractedProtocol.prescriptions.length})</Label>
                  <div className="space-y-2">
                    {extractedProtocol.prescriptions.map((rx: PrescriptionDose, idx: number) => (
                      <Card key={idx}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <span className="font-medium">{rx.ptvName}</span>
                          <Badge variant="outline">
                            {rx.totalDose} Gy en {rx.numberOfFractions} fx ({rx.dosePerFraction} Gy/fx)
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* OAR Constraints */}
              {extractedProtocol.oarConstraints && extractedProtocol.oarConstraints.length > 0 && (
                <div className="space-y-2">
                  <Label>Contraintes OAR ({extractedProtocol.oarConstraints.length})</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {extractedProtocol.oarConstraints.map((constraint: OARConstraint, idx: number) => (
                      <Card key={idx}>
                        <CardContent className="p-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium truncate">{constraint.organName}</span>
                            <Badge 
                              variant={constraint.priority === 'mandatory' ? 'destructive' : constraint.priority === 'optimal' ? 'default' : 'secondary'}
                              className="text-xs ml-1"
                            >
                              {constraint.priority === 'mandatory' ? 'Oblig.' : constraint.priority === 'optimal' ? 'Opt.' : 'Souh.'}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatConstraintType(constraint)} &lt; {constraint.value} {constraint.unit}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={handleClose}>
                  Annuler
                </Button>
                <Button variant="outline" onClick={() => {
                  setExtractedProtocol(null);
                  setFile(null);
                }}>
                  Nouveau fichier
                </Button>
                <Button onClick={handleSave}>
                  Sauvegarder le protocole
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
