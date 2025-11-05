import { useState } from 'react';
import { Upload, FileText, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { TreatmentProtocol, OARConstraint, PrescriptionDose, ConstraintType } from '@/types/protocol';

export const ProtocolDocumentConverter = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [protocol, setProtocol] = useState<TreatmentProtocol | null>(null);
  const { toast } = useToast();

  const handleFileUpload = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setIsProcessing(true);
    setExtractedText('');
    setProtocol(null);

    try {
      // Lire le contenu du fichier
      const fileContent = await uploadedFile.text();
      
      // Pour les PDFs, on utiliserait document--parse_document
      // Pour les fichiers texte, on parse directement
      if (uploadedFile.name.endsWith('.txt') || uploadedFile.name.endsWith('.csv')) {
        setExtractedText(fileContent);
        const parsed = parseProtocolFromText(fileContent);
        setProtocol(parsed);
        
        toast({
          title: "Extraction réussie",
          description: "Le protocole a été extrait du document",
        });
      } else {
        // Pour PDF/DOC, informer l'utilisateur
        toast({
          title: "Format non supporté directement",
          description: "Veuillez copier-coller le contenu du tableau dans le champ texte ci-dessous",
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Erreur lors de l\'extraction:', error);
      toast({
        title: "Erreur d'extraction",
        description: "Impossible de lire le fichier. Essayez de copier-coller le contenu.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const parseProtocolFromText = (text: string): TreatmentProtocol => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    const prescriptions: PrescriptionDose[] = [];
    const constraints: OARConstraint[] = [];
    let protocolName = 'Protocole importé';
    let location = 'Non spécifié';
    
    // Patterns de détection
    const ptvPattern = /PTV|GTV|CTV/i;
    const dosePattern = /(\d+(?:\.\d+)?)\s*Gy/i;
    const fractionPattern = /(\d+)\s*(?:fx|fractions?)/i;
    const constraintPattern = /(Dmax|Dmean|D\d+|V\d+)/i;
    
    lines.forEach((line, index) => {
      // Détecter le nom du protocole (souvent première ligne)
      if (index === 0 && !line.match(/^\d/)) {
        protocolName = line;
        location = line;
      }
      
      // Détecter les prescriptions PTV
      if (ptvPattern.test(line)) {
        const doseMatch = line.match(dosePattern);
        const fractionMatch = line.match(fractionPattern);
        
        if (doseMatch && fractionMatch) {
          const totalDose = parseFloat(doseMatch[1]);
          const fractions = parseInt(fractionMatch[1]);
          
          prescriptions.push({
            ptvName: line.split(/\s+/)[0],
            totalDose,
            numberOfFractions: fractions,
            dosePerFraction: totalDose / fractions
          });
        }
      }
      
      // Détecter les contraintes OAR
      const constraintMatch = line.match(constraintPattern);
      if (constraintMatch) {
        const type = constraintMatch[1];
        let constraintType: ConstraintType;
        
        if (type.startsWith('D')) {
          if (type === 'Dmax') constraintType = 'Dmax';
          else if (type === 'Dmean') constraintType = 'Dmean';
          else constraintType = 'Dx';
        } else {
          constraintType = 'Vx';
        }
        
        // Extraire la valeur de contrainte
        const valueMatch = line.match(/[<>=]\s*(\d+(?:\.\d+)?)\s*(Gy|%)/);
        if (valueMatch) {
          const value = parseFloat(valueMatch[1]);
          const unit = valueMatch[2];
          
          // Extraire le nom de l'organe (avant la contrainte)
          const organMatch = line.match(/^([A-Za-zéèêàâôûçÉÈÊÀÂÔÛÇ\s]+)\s*[:-]/);
          const organName = organMatch ? organMatch[1].trim() : 'Organe inconnu';
          
          // Extraire la valeur cible pour Vx et Dx
          let target: number | undefined;
          if (constraintType === 'Vx') {
            const vxMatch = type.match(/V(\d+)/);
            if (vxMatch) target = parseFloat(vxMatch[1]);
          } else if (constraintType === 'Dx') {
            const dxMatch = type.match(/D(\d+)/);
            if (dxMatch) target = parseFloat(dxMatch[1]);
          }
          
          constraints.push({
            organName,
            constraintType,
            value,
            unit,
            target,
            priority: 'mandatory',
            description: line
          });
        }
      }
    });
    
    return {
      id: `imported_${Date.now()}`,
      name: protocolName,
      location,
      prescriptions,
      oarConstraints: constraints,
      createdAt: new Date(),
      modifiedAt: new Date(),
      isCustom: true
    };
  };

  const handleTextPaste = (text: string) => {
    setExtractedText(text);
    try {
      const parsed = parseProtocolFromText(text);
      setProtocol(parsed);
      
      toast({
        title: "Analyse réussie",
        description: `${parsed.prescriptions.length} prescription(s) et ${parsed.oarConstraints.length} contrainte(s) détectées`,
      });
    } catch (error) {
      toast({
        title: "Erreur d'analyse",
        description: "Impossible d'analyser le texte automatiquement",
        variant: "destructive",
      });
    }
  };

  const downloadProtocolJSON = () => {
    if (!protocol) return;
    
    const json = JSON.stringify(protocol, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${protocol.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Export réussi",
      description: "Le protocole a été téléchargé en JSON",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Convertisseur de Protocole (Document → JSON)
          </CardTitle>
          <CardDescription>
            Importez un document contenant un tableau de protocole et convertissez-le automatiquement en JSON
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="protocol-file">1. Uploader un document (TXT, CSV) ou copier-coller ci-dessous</Label>
            <div className="flex gap-2">
              <Input
                id="protocol-file"
                type="file"
                accept=".txt,.csv,.pdf,.doc,.docx"
                onChange={(e) => {
                  const uploadedFile = e.target.files?.[0];
                  if (uploadedFile) handleFileUpload(uploadedFile);
                }}
                className="flex-1"
              />
              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="w-4 h-4" />
                  {file.name}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="protocol-text">2. Ou copier-coller le contenu du tableau</Label>
            <Textarea
              id="protocol-text"
              placeholder={`Exemple:
Sein Gauche
PTV_Sein: 45 Gy / 25 fx
PTV_Boost: 15 Gy / 8 fx

Contraintes OAR:
Cœur - Dmean < 5 Gy
Poumon G - V20Gy < 15%
Moelle - Dmax < 45 Gy`}
              rows={10}
              value={extractedText}
              onChange={(e) => handleTextPaste(e.target.value)}
              className="font-mono text-sm"
            />
          </div>

          {isProcessing && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
              Traitement en cours...
            </div>
          )}
        </CardContent>
      </Card>

      {protocol && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="w-5 h-5" />
              Protocole détecté
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Nom du protocole</Label>
                <Input
                  value={protocol.name}
                  onChange={(e) => setProtocol({ ...protocol, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Localisation</Label>
                <Input
                  value={protocol.location}
                  onChange={(e) => setProtocol({ ...protocol, location: e.target.value })}
                />
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Prescriptions détectées ({protocol.prescriptions.length})</h4>
              <div className="space-y-2">
                {protocol.prescriptions.map((presc, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="font-medium">{presc.ptvName}:</span>
                    <span>{presc.totalDose} Gy / {presc.numberOfFractions} fx ({presc.dosePerFraction.toFixed(2)} Gy/fx)</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Contraintes OAR détectées ({protocol.oarConstraints.length})</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {protocol.oarConstraints.map((constraint, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="font-medium">{constraint.organName}:</span>
                    <span>
                      {constraint.constraintType}
                      {constraint.target && `(${constraint.target}${constraint.constraintType === 'Vx' ? 'Gy' : '%'})`}
                      {' < '}{constraint.value} {constraint.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {protocol.oarConstraints.length === 0 && protocol.prescriptions.length === 0 && (
              <div className="flex items-center gap-2 text-orange-500">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">
                  Aucune donnée détectée automatiquement. Veuillez vérifier le format du texte.
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={downloadProtocolJSON} className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Télécharger en JSON
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-sm">Format attendu</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>Le convertisseur détecte automatiquement:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><strong>Prescriptions:</strong> "PTV_XXX: 45 Gy / 25 fx"</li>
            <li><strong>Contraintes Dmax:</strong> "Organe - Dmax &lt; 50 Gy"</li>
            <li><strong>Contraintes Dmean:</strong> "Organe - Dmean &lt; 20 Gy"</li>
            <li><strong>Contraintes Vx:</strong> "Organe - V20Gy &lt; 15%"</li>
            <li><strong>Contraintes Dx:</strong> "Organe - D2% &lt; 60 Gy"</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
