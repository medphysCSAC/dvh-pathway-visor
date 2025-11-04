import { useState, useEffect } from 'react';
import { TreatmentProtocol } from '@/types/protocol';
import { 
  getAllProtocols, 
  saveCustomProtocol, 
  deleteCustomProtocol,
  predefinedProtocols 
} from '@/data/predefinedProtocols';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  FileJson, 
  Download, 
  Upload, 
  Trash2, 
  Eye, 
  Plus,
  FileText,
  Shield,
  Activity
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ProtocolManagerProps {
  onProtocolSelect?: (protocol: TreatmentProtocol) => void;
}

export default function ProtocolManager({ onProtocolSelect }: ProtocolManagerProps) {
  const { toast } = useToast();
  const [protocols, setProtocols] = useState<TreatmentProtocol[]>([]);
  const [selectedProtocol, setSelectedProtocol] = useState<TreatmentProtocol | null>(null);
  const [protocolToDelete, setProtocolToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadProtocols();
  }, []);

  const loadProtocols = () => {
    const allProtocols = getAllProtocols();
    setProtocols(allProtocols);
  };

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importedProtocol = JSON.parse(text) as TreatmentProtocol;
        
        // Validation basique
        if (!importedProtocol.id || !importedProtocol.name || !importedProtocol.prescriptions) {
          throw new Error('Format de protocole invalide');
        }

        // Marquer comme personnalisé et mettre à jour les dates
        importedProtocol.isCustom = true;
        importedProtocol.createdAt = new Date();
        importedProtocol.modifiedAt = new Date();

        // Générer un nouvel ID si existe déjà
        let finalId = importedProtocol.id;
        if (protocols.some(p => p.id === finalId)) {
          finalId = `${importedProtocol.id}-${Date.now()}`;
          importedProtocol.id = finalId;
        }

        saveCustomProtocol(importedProtocol);
        loadProtocols();

        toast({
          title: 'Protocole importé',
          description: `"${importedProtocol.name}" a été ajouté avec succès`,
        });
      } catch (error) {
        toast({
          title: 'Erreur d\'importation',
          description: error instanceof Error ? error.message : 'Format JSON invalide',
          variant: 'destructive',
        });
      }
    };

    input.click();
  };

  const handleExportJSON = (protocol: TreatmentProtocol) => {
    const json = JSON.stringify(protocol, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `protocol_${protocol.id}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Protocole exporté',
      description: `"${protocol.name}" téléchargé en JSON`,
    });
  };

  const handleDelete = (id: string) => {
    deleteCustomProtocol(id);
    loadProtocols();
    if (selectedProtocol?.id === id) {
      setSelectedProtocol(null);
    }
    setProtocolToDelete(null);

    toast({
      title: 'Protocole supprimé',
      description: 'Le protocole a été supprimé avec succès',
    });
  };

  const handleViewDetails = (protocol: TreatmentProtocol) => {
    setSelectedProtocol(selectedProtocol?.id === protocol.id ? null : protocol);
  };

  const handleUseProtocol = (protocol: TreatmentProtocol) => {
    onProtocolSelect?.(protocol);
    toast({
      title: 'Protocole sélectionné',
      description: `"${protocol.name}" est maintenant le protocole actif`,
    });
  };

  const predefined = protocols.filter(p => !p.isCustom);
  const custom = protocols.filter(p => p.isCustom);

  const renderProtocolCard = (protocol: TreatmentProtocol) => (
    <Card key={protocol.id} className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{protocol.name}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <span>{protocol.location}</span>
              {protocol.isCustom && (
                <Badge variant="secondary" className="text-xs">Personnalisé</Badge>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Activity className="h-4 w-4 text-primary" />
              <span className="font-medium">{protocol.prescriptions.length}</span>
              <span className="text-muted-foreground">PTV</span>
            </div>
            <div className="flex items-center gap-1">
              <Shield className="h-4 w-4 text-destructive" />
              <span className="font-medium">{protocol.oarConstraints.length}</span>
              <span className="text-muted-foreground">Contraintes OAR</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              size="sm" 
              variant="default"
              onClick={() => handleUseProtocol(protocol)}
              className="flex-1"
            >
              Utiliser ce protocole
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleViewDetails(protocol)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleExportJSON(protocol)}
            >
              <Download className="h-4 w-4" />
            </Button>
            {protocol.isCustom && (
              <Button 
                size="sm" 
                variant="destructive"
                onClick={() => setProtocolToDelete(protocol.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Gestion des Protocoles</CardTitle>
          <CardDescription>
            Gérez vos protocoles de validation : protocoles prédéfinis et protocoles personnalisés
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button onClick={handleImportJSON} variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Importer un protocole JSON
            </Button>
            <Button variant="outline" disabled>
              <Plus className="h-4 w-4 mr-2" />
              Créer un nouveau protocole
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="predefined">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="predefined">
            Protocoles Prédéfinis ({predefined.length})
          </TabsTrigger>
          <TabsTrigger value="custom">
            Protocoles Personnalisés ({custom.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="predefined" className="space-y-4">
          {predefined.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Aucun protocole prédéfini disponible
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {predefined.map(renderProtocolCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          {custom.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <FileJson className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Aucun protocole personnalisé</p>
                <p className="text-sm mt-1">Importez un fichier JSON pour commencer</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {custom.map(renderProtocolCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedProtocol && (
        <Card>
          <CardHeader>
            <CardTitle>Détails du Protocole : {selectedProtocol.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Prescriptions de Dose
              </h4>
              <div className="space-y-2">
                {selectedProtocol.prescriptions.map((presc, idx) => (
                  <div key={idx} className="bg-muted p-3 rounded-lg text-sm">
                    <div className="font-medium">{presc.ptvName}</div>
                    <div className="text-muted-foreground">
                      {presc.totalDose} Gy en {presc.numberOfFractions} fractions
                      ({presc.dosePerFraction} Gy/fraction)
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Contraintes OAR ({selectedProtocol.oarConstraints.length})
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {selectedProtocol.oarConstraints.map((constraint, idx) => (
                  <div key={idx} className="bg-muted p-3 rounded-lg text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{constraint.organName}</span>
                      <Badge 
                        variant={
                          constraint.priority === 'mandatory' ? 'destructive' :
                          constraint.priority === 'optimal' ? 'default' : 'secondary'
                        }
                        className="text-xs"
                      >
                        {constraint.priority === 'mandatory' ? 'Obligatoire' :
                         constraint.priority === 'optimal' ? 'Optimal' : 'Souhaitable'}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground">
                      {constraint.constraintType === 'Vx' && `V${constraint.target}Gy < ${constraint.value}%`}
                      {constraint.constraintType === 'Dx' && `D${constraint.target}% < ${constraint.value} Gy`}
                      {constraint.constraintType === 'Dmax' && `Dmax < ${constraint.value} Gy`}
                      {constraint.constraintType === 'Dmean' && `Dmean < ${constraint.value} Gy`}
                    </div>
                    {constraint.description && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {constraint.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!protocolToDelete} onOpenChange={() => setProtocolToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce protocole personnalisé ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => protocolToDelete && handleDelete(protocolToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
