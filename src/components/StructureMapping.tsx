import { useState, useEffect, useRef } from 'react';
import { Structure } from '@/types/dvh';
import { StructureMapping as StructureMappingType, TreatmentProtocol } from '@/types/protocol';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Save, RotateCcw, AlertCircle, Target, CheckCircle2 } from 'lucide-react';
import { findBestStructureMatch } from '@/utils/protocolValidator';

interface StructureMappingProps {
  unmatchedStructures: string[];
  availableStructures: Structure[];
  onMappingsChange: (mappings: StructureMappingType[]) => void;
  protocolId: string;
  protocol?: TreatmentProtocol;
  currentMappings?: StructureMappingType[];
}

const STORAGE_KEY = 'structure-mappings';

export default function StructureMapping({
  unmatchedStructures,
  availableStructures,
  onMappingsChange,
  protocolId,
  protocol,
  currentMappings = [],
}: StructureMappingProps) {
  const { toast } = useToast();
  const [mappings, setMappings] = useState<Map<string, string>>(new Map());

  // ── CORRECTION BUG BOUCLE ────────────────────────────────────────────────
  // onMappingsChange NE doit PAS être dans les deps du useEffect.
  // Si on l'inclut, chaque re-render de ProtocolValidation recrée la référence
  // de la prop → l'effet se relance → appelle onMappingsChange → re-render → boucle.
  // Solution : stocker la référence dans un ref (toujours à jour, jamais dans les deps).
  const onMappingsChangeRef = useRef(onMappingsChange);
  onMappingsChangeRef.current = onMappingsChange;

  // Charger les mappings sauvegardés quand le protocole change
  // Dépendance : protocolId UNIQUEMENT (pas onMappingsChange)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}-${protocolId}`);
      if (stored) {
        const savedMappings = JSON.parse(stored) as StructureMappingType[];
        const mappingMap = new Map(
          savedMappings.map(m => [m.protocolStructureName, m.dvhStructureName])
        );
        setMappings(mappingMap);
        // Utilise le ref → jamais dans les deps → pas de boucle
        onMappingsChangeRef.current(savedMappings);
      } else {
        // Pas de mapping sauvegardé pour ce protocole → reset propre
        setMappings(new Map());
      }
    } catch (error) {
      console.error('Erreur lors du chargement des mappings:', error);
    }
  }, [protocolId]); // ← protocolId UNIQUEMENT

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
        dvhStructureName,
      })
    );

    localStorage.setItem(`${STORAGE_KEY}-${protocolId}`, JSON.stringify(mappingArray));

    // Notifier le parent via le ref → pas de re-render en boucle
    onMappingsChangeRef.current(mappingArray);

    toast({
      title: 'Mapping sauvegardé',
      description: `${mappingArray.length} correspondance(s) enregistrée(s)`,
    });
  };

  const handleReset = () => {
    setMappings(new Map());
    localStorage.removeItem(`${STORAGE_KEY}-${protocolId}`);
    onMappingsChangeRef.current([]);
    toast({
      title: 'Mapping réinitialisé',
      description: 'Toutes les correspondances ont été supprimées',
    });
  };

  // ── Construction de la liste des structures à afficher ───────────────────
  const allProtocolPTVs  = protocol?.prescriptions.map(p => p.ptvName) || [];
  const allProtocolOARs  = protocol?.oarConstraints.map(c => c.organName) || [];
  const allProtocolStructures = [...new Set([...allProtocolPTVs, ...allProtocolOARs])];

  const structureStatus = allProtocolStructures.map(protocolName => ({
    protocolName,
    matched: findBestStructureMatch(protocolName, availableStructures, currentMappings),
    isUnmatched: unmatchedStructures.includes(protocolName),
    isPTV: allProtocolPTVs.includes(protocolName),
  }));

  const unmatchedPTVs = structureStatus.filter(s => s.isPTV && !s.matched);
  const hasUnmatchedOARs = unmatchedStructures.filter(s => !allProtocolPTVs.includes(s)).length > 0;

  // Si tout est résolu → ne pas afficher le composant
  if (unmatchedStructures.length === 0 && unmatchedPTVs.length === 0) {
    return null;
  }

  return (
    <>
      {/* ── Section PTVs ── */}
      {allProtocolPTVs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Mapping des PTVs
            </CardTitle>
            <CardDescription>
              Vérifiez la correspondance entre les PTVs du protocole et les structures DVH
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {allProtocolPTVs.map(ptvName => {
                const autoMatched  = findBestStructureMatch(ptvName, availableStructures, currentMappings);
                const manualMapping = mappings.get(ptvName);
                const currentValue  = manualMapping || autoMatched?.name || 'none';
                const isResolved    = currentValue !== 'none';

                return (
                  <div
                    key={ptvName}
                    className={`flex items-center gap-3 p-3 border rounded-lg bg-card ${
                      isResolved ? 'border-success/40' : 'border-destructive/40'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm mb-1">PTV du protocole :</div>
                      <Badge variant="default" className="font-mono">{ptvName}</Badge>
                      {autoMatched && !manualMapping && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-success" />
                          Auto-détecté : {autoMatched.name}
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="text-sm text-muted-foreground mb-1">Correspond à :</div>
                      <Select
                        value={currentValue}
                        onValueChange={value => handleMappingChange(ptvName, value)}
                      >
                        <SelectTrigger className={!isResolved ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Sélectionner une structure..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-muted-foreground">-- Aucune correspondance --</span>
                          </SelectItem>
                          {availableStructures
                            .filter(s => s.category === 'PTV' || s.name.toLowerCase().startsWith('ptv'))
                            .map(structure => (
                              <SelectItem key={structure.name} value={structure.name}>
                                <div className="flex items-center gap-2">
                                  <Badge variant="default" className="text-xs">PTV</Badge>
                                  <span className="font-mono text-sm">{structure.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
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
          </CardContent>
        </Card>
      )}

      {/* ── Section OARs non résolus ── */}
      {hasUnmatchedOARs && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Mapping des OARs non trouvés
            </CardTitle>
            <CardDescription>
              Ces organes à risque n'ont pas été trouvés automatiquement dans les structures DVH
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {unmatchedStructures
                .filter(s => !allProtocolPTVs.includes(s))
                .map(protocolStructure => {
                  const val = mappings.get(protocolStructure) || 'none';
                  return (
                    <div key={protocolStructure} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-sm mb-1">Structure du protocole :</div>
                        <Badge variant="outline" className="font-mono">{protocolStructure}</Badge>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-muted-foreground mb-1">Correspond à :</div>
                        <Select
                          value={val}
                          onValueChange={value => handleMappingChange(protocolStructure, value)}
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
                                    variant={
                                      structure.category === 'PTV' ? 'default' :
                                      structure.category === 'OAR' ? 'destructive' : 'secondary'
                                    }
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
                  );
                })}
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
              💡 Les correspondances sont mémorisées pour ce protocole — vous n'aurez pas à les refaire.
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
