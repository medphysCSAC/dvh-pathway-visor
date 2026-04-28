import { useState, useRef } from 'react';
import { Camera, Upload, Loader2, CheckCircle2, AlertCircle, ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { TreatmentProtocol, PrescriptionDose, OARConstraint } from '@/types/protocol';
import { supabase } from '@/integrations/supabase/client';

interface ProtocolImageExtractorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProtocolExtracted: (protocol: TreatmentProtocol) => void;
}

interface ExtractedProtocolData {
  name: string;
  location: string;
  prescriptions: PrescriptionDose[];
  oarConstraints: OARConstraint[];
}

export default function ProtocolImageExtractor({ 
  open, 
  onOpenChange, 
  onProtocolExtracted 
}: ProtocolImageExtractorProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedProtocolData | null>(null);
  const [protocolName, setProtocolName] = useState('');
  const [protocolLocation, setProtocolLocation] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Type de fichier invalide',
        description: 'Veuillez sélectionner une image (PNG, JPG, etc.)',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setSelectedImage(dataUrl);
      setExtractedData(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleExtract = async () => {
    if (!selectedImage) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Extract base64 data and mime type from data URL
      const matches = selectedImage.match(/^data:(.+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Format d\'image invalide');
      }

      const mimeType = matches[1];
      const base64Data = matches[2];

      const { data, error: fnError } = await supabase.functions.invoke('extract-protocol-from-image', {
        body: { imageBase64: base64Data, mimeType }
      });

      if (fnError) {
        throw new Error(fnError.message || 'Erreur lors de l\'appel à l\'API');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.protocol) {
        setExtractedData(data.protocol);
        setProtocolName(data.protocol.name || 'Protocole extrait');
        setProtocolLocation(data.protocol.location || 'Non spécifié');
        
        toast({
          title: 'Extraction réussie',
          description: `${data.protocol.prescriptions?.length || 0} prescription(s) et ${data.protocol.oarConstraints?.length || 0} contrainte(s) détectées`,
        });
      }
    } catch (err) {
      console.error('Extraction error:', err);
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast({
        title: 'Erreur d\'extraction',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveProtocol = () => {
    if (!extractedData) return;

    const protocol: TreatmentProtocol = {
      id: `img_extracted_${Date.now()}`,
      name: protocolName || extractedData.name || 'Protocole extrait',
      location: protocolLocation || extractedData.location || 'Non spécifié',
      prescriptions: extractedData.prescriptions || [],
      oarConstraints: (extractedData.oarConstraints || []).map((c) => {
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
      createdAt: new Date(),
      modifiedAt: new Date(),
      isCustom: true,
    };

    onProtocolExtracted(protocol);
    handleClose();

    toast({
      title: 'Protocole sauvegardé',
      description: `"${protocol.name}" a été ajouté à vos protocoles personnalisés`,
    });
  };

  const handleClose = () => {
    setSelectedImage(null);
    setExtractedData(null);
    setError(null);
    setProtocolName('');
    setProtocolLocation('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Créer un protocole depuis une image
          </DialogTitle>
          <DialogDescription>
            Uploadez une capture d'écran de votre TPS ou un document contenant le tableau de contraintes. 
            L'IA analysera l'image et extraira automatiquement les données du protocole.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image Upload Zone */}
          <div className="space-y-2">
            <Label>Image du protocole</Label>
            <div 
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedImage ? (
                <div className="space-y-2">
                  <img 
                    src={selectedImage} 
                    alt="Aperçu" 
                    className="max-h-48 mx-auto rounded-lg shadow-md"
                  />
                  <p className="text-sm text-muted-foreground">
                    Cliquez pour changer l'image
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground" />
                  <p className="font-medium">Cliquez ou glissez-déposez une image</p>
                  <p className="text-sm text-muted-foreground">
                    PNG, JPG, WEBP (capture d'écran du TPS recommandée)
                  </p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Extract Button */}
          {selectedImage && !extractedData && (
            <Button 
              onClick={handleExtract} 
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
                  <Upload className="h-4 w-4 mr-2" />
                  Analyser l'image
                </>
              )}
            </Button>
          )}

          {/* Error Display */}
          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Erreur d'extraction</p>
                    <p className="text-sm">{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Extracted Data Display */}
          {extractedData && (
            <Card className="border-primary">
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold">Données extraites</span>
                </div>

                {/* Editable Protocol Info */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="protocol-name">Nom du protocole</Label>
                    <Input
                      id="protocol-name"
                      value={protocolName}
                      onChange={(e) => setProtocolName(e.target.value)}
                      placeholder="Ex: Sein Gauche Boost"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="protocol-location">Localisation</Label>
                    <Input
                      id="protocol-location"
                      value={protocolLocation}
                      onChange={(e) => setProtocolLocation(e.target.value)}
                      placeholder="Ex: Sein"
                    />
                  </div>
                </div>

                {/* Prescriptions Summary */}
                <div>
                  <h4 className="font-semibold mb-2">
                    Prescriptions ({extractedData.prescriptions?.length || 0})
                  </h4>
                  <div className="space-y-2">
                    {extractedData.prescriptions?.map((presc, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="font-medium">{presc.ptvName}:</span>
                        <span>
                          {presc.totalDose} Gy / {presc.numberOfFractions} fx 
                          ({(presc.dosePerFraction || presc.totalDose / presc.numberOfFractions).toFixed(2)} Gy/fx)
                        </span>
                      </div>
                    ))}
                    {(!extractedData.prescriptions || extractedData.prescriptions.length === 0) && (
                      <p className="text-sm text-muted-foreground">Aucune prescription détectée</p>
                    )}
                  </div>
                </div>

                {/* Constraints Summary */}
                <div>
                  <h4 className="font-semibold mb-2">
                    Contraintes OAR ({extractedData.oarConstraints?.length || 0})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {extractedData.oarConstraints?.map((constraint, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="font-medium">{constraint.organName}:</span>
                        <span>
                          {constraint.constraintType}
                          {constraint.target !== undefined && 
                            `${constraint.target}${constraint.constraintType === 'Vx' ? 'Gy' : (constraint.targetUnit || '%')}`}
                          {" < "}
                          {constraint.value} {constraint.unit}
                        </span>
                        <Badge variant="outline" className="text-xs ml-auto">
                          {constraint.priority === 'mandatory' ? 'Obligatoire' : 
                           constraint.priority === 'optimal' ? 'Optimal' : 'Souhaitable'}
                        </Badge>
                      </div>
                    ))}
                    {(!extractedData.oarConstraints || extractedData.oarConstraints.length === 0) && (
                      <p className="text-sm text-muted-foreground">Aucune contrainte détectée</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          {extractedData && (
            <Button onClick={handleSaveProtocol}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Sauvegarder le protocole
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
