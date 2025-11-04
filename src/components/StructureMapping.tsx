import { useState, useEffect } from 'react';
import { Structure } from '@/types/dvh';
import { StructureMapping as StructureMappingType } from '@/types/protocol';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Save, RotateCcw, AlertCircle } from 'lucide-react';

interface StructureMappingProps {
  unmatchedStructures: string[];
  availableStructures: Structure[];
  onMappingsChange: (mappings: StructureMappingType[]) => void;
  protocolId: string;
}

const STORAGE_KEY = 'structure-mappings';

/**
 * Composant pour le mapping manuel des structures du protocole vers les structures DVH
 */
export default function StructureMapping({
  unmatchedStructures,
  availableStructures,
  onMappingsChange,
  protocolId
}: StructureMappingProps) {
  const { toast } = useToast();
  const [mappings, setMappings] = useState<Map<string, string>>(new Map());

  // Charger les mappings sauvegardés pour ce protocole
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}-${protocolId}`);
      if (stored) {
        const savedMappings = JSON.parse(stored) as StructureMappingType[];
        const mappingMap = new Map(
          savedMappings.map(m => [m.protocolStructureName, m.dvhStructureName])
        );
        setMappings(mappingMap);
        onMappingsChange(savedMappings);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des mappings:', error);
    }
  }, [protocolId, onMappingsChange]);

  const handleMappingChange = (protocolStructure: string, dvhStructure: string) => {
    setMappings(prev => {
      const updated = new Map(prev);
      if (dvhStructure === 'none') {
        updated.delete(protocolStructure);
      } else {
        updated.set(protocolStructure, dvhStructure);
      }
      return updated;
    });
  };

  const handleSave = () => {
    const mappingArray: StructureMappingType[] = Array.from(mappings.entries()).map(
      ([protocolStructureName, dvhStructureName]) => ({
        protocolStructureName,
        dvhStructureName
      })
    );

    // Sauvegarder dans localStorage
    localStorage.setItem(`${STORAGE_KEY}-${protocolId}`, JSON.stringify(mappingArray));

    // Notifier le parent
    onMappingsChange(mappingArray);

    toast({
      title: 'Mappings sauvegardés',
      description: `${mappingArray.length} correspondance(s) de structures enregistrée(s)`,
    });
  };

  const handleReset = () => {
    setMappings(new Map());
    localStorage.removeItem(`${STORAGE_KEY}-${protocolId}`);
    onMappingsChange([]);
    
    toast({
      title: 'Mappings réinitialisés',
      description: 'Toutes les correspondances ont été supprimées',
    });
  };

  if (unmatchedStructures.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ✅ Toutes les structures trouvées
          </CardTitle>
          <CardDescription>
            Toutes les structures du protocole ont été trouvées automatiquement dans le fichier DVH
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-warning" />
          Correspondance des Structures
        </CardTitle>
        <CardDescription>
          {unmatchedStructures.length} structure(s) du protocole n'ont pas été trouvées automatiquement.
          Veuillez les faire correspondre manuellement avec les structures disponibles dans le fichier DVH.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {unmatchedStructures.map(protocolStructure => (
            <div key={protocolStructure} className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-sm mb-1">
                  Structure du protocole :
                </div>
                <Badge variant="outline" className="font-mono">
                  {protocolStructure}
                </Badge>
              </div>
              
              <div className="flex-1">
                <div className="text-sm text-muted-foreground mb-1">
                  Correspond à :
                </div>
                <Select
                  value={mappings.get(protocolStructure) || 'none'}
                  onValueChange={(value) => handleMappingChange(protocolStructure, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une structure..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">-- Aucune correspondance --</span>
                    </SelectItem>
                    {availableStructures.map(structure => (
                      <SelectItem key={structure.name} value={structure.name}>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={structure.category === 'PTV' ? 'default' : structure.category === 'OAR' ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {structure.category}
                          </Badge>
                          <span className="font-mono text-sm">{structure.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={handleSave} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            Sauvegarder les correspondances
          </Button>
          <Button onClick={handleReset} variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" />
            Réinitialiser
          </Button>
        </div>

        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
          💡 <strong>Astuce :</strong> Les correspondances sont sauvegardées automatiquement pour ce protocole.
          Vous n'aurez pas besoin de les refaire lors de la prochaine validation.
        </div>
      </CardContent>
    </Card>
  );
}
