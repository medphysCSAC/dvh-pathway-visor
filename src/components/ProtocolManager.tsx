import { useState, useEffect } from 'react';
import { TreatmentProtocol } from '@/types/protocol';
import { 
  getAllProtocols, 
  saveCustomProtocol, 
  deleteCustomProtocol,
  predefinedProtocols,
  convertCustomToPredefined
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
  Activity,
  Edit,
  Copy,
  Archive,
  MoveUp,
  MoveDown,
  ArrowUpDown,
  Star,
  EyeOff,
  Search
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ProtocolEditor from './ProtocolEditor';
import { useFavorites } from '@/hooks/useFavorites';
import { useHiddenProtocols } from '@/hooks/useHiddenProtocols';
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
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { hiddenProtocols, toggleHidden, isHidden } = useHiddenProtocols();
  const [protocols, setProtocols] = useState<TreatmentProtocol[]>([]);
  const [selectedProtocol, setSelectedProtocol] = useState<TreatmentProtocol | null>(null);
  const [protocolToDelete, setProtocolToDelete] = useState<string | null>(null);
  const [protocolToEdit, setProtocolToEdit] = useState<TreatmentProtocol | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [archivedProtocols, setArchivedProtocols] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('archived-protocols');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [deletePassword, setDeletePassword] = useState('');
  const [sortBy, setSortBy] = useState<'alphabetical' | 'recent' | 'mostUsed' | 'favorites'>('alphabetical');
  const [protocolUsage, setProtocolUsage] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('protocol-usage');
    return saved ? JSON.parse(saved) : {};
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    loadProtocols();
  }, []);

  useEffect(() => {
    localStorage.setItem('archived-protocols', JSON.stringify([...archivedProtocols]));
  }, [archivedProtocols]);

  useEffect(() => {
    localStorage.setItem('protocol-usage', JSON.stringify(protocolUsage));
  }, [protocolUsage]);

  const loadProtocols = async () => {
    const allProtocols = await getAllProtocols();
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

  const handleDelete = async () => {
    if (!protocolToDelete) return;
    
    const protocol = protocols.find(p => p.id === protocolToDelete);
    if (!protocol) return;

    // Protection des protocoles prédéfinis
    if (!protocol.isCustom) {
      toast({
        title: 'Action interdite',
        description: 'Les protocoles prédéfinis ne peuvent pas être supprimés. Utilisez "Masquer" pour les cacher ou créez une copie personnalisée.',
        variant: 'destructive',
      });
      setProtocolToDelete(null);
      setDeletePassword('');
      return;
    }

    // Vérification du mot de passe pour protocoles personnalisés
    if (deletePassword !== 'DELETE') {
      toast({
        title: 'Erreur',
        description: 'Tapez "DELETE" en majuscules pour confirmer la suppression définitive',
        variant: 'destructive',
      });
      return;
    }

    try {
      await deleteCustomProtocol(protocolToDelete);
      await loadProtocols();
      toast({
        title: 'Protocole supprimé',
        description: `Le protocole personnalisé "${protocol.name}" a été supprimé définitivement`,
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le protocole',
        variant: 'destructive',
      });
    }

    setProtocolToDelete(null);
    setDeletePassword('');
  };

  const handleViewDetails = (protocol: TreatmentProtocol) => {
    setSelectedProtocol(selectedProtocol?.id === protocol.id ? null : protocol);
  };

  const handleUseProtocol = (protocol: TreatmentProtocol) => {
    // Incrémenter le compteur d'utilisation
    setProtocolUsage(prev => ({
      ...prev,
      [protocol.id]: (prev[protocol.id] || 0) + 1
    }));
    
    onProtocolSelect?.(protocol);
    toast({
      title: 'Protocole sélectionné',
      description: `"${protocol.name}" est maintenant le protocole actif`,
    });
  };

  const handleEditProtocol = (protocol: TreatmentProtocol) => {
    // Empêcher l'édition directe des protocoles prédéfinis
    if (!protocol.isCustom) {
      toast({
        title: "Action non autorisée",
        description: "Les protocoles prédéfinis ne peuvent pas être modifiés directement. Créez une copie personnalisée pour la modifier.",
        variant: "destructive"
      });
      return;
    }
    
    setProtocolToEdit(protocol);
    setEditorOpen(true);
  };

  const handleSaveEdit = (editedProtocol: TreatmentProtocol) => {
    saveCustomProtocol(editedProtocol);
    loadProtocols();
    setProtocolToEdit(null);
    setEditorOpen(false);
  };

  const handleCopyProtocol = (protocol: TreatmentProtocol) => {
    const copiedProtocol: TreatmentProtocol = {
      ...protocol,
      id: `${protocol.id}_copy_${Date.now()}`,
      name: `${protocol.name} (Copie)`,
      isCustom: true,
      createdAt: new Date(),
      modifiedAt: new Date(),
    };
    
    saveCustomProtocol(copiedProtocol);
    loadProtocols();
    
    toast({
      title: 'Protocole copié',
      description: `Une copie de "${protocol.name}" a été créée`,
    });
  };

  const handleArchiveProtocol = (protocolId: string) => {
    const protocol = protocols.find(p => p.id === protocolId);
    
    // Protection des protocoles prédéfinis
    if (protocol && !protocol.isCustom) {
      toast({
        title: 'Action interdite',
        description: 'Les protocoles prédéfinis ne peuvent pas être archivés. Créez une copie si nécessaire.',
        variant: 'destructive',
      });
      return;
    }

    setArchivedProtocols(prev => {
      const newSet = new Set(prev);
      if (newSet.has(protocolId)) {
        newSet.delete(protocolId);
        toast({
          title: 'Protocole désarchivé',
          description: 'Le protocole est à nouveau visible',
        });
      } else {
        newSet.add(protocolId);
        toast({
          title: 'Protocole archivé',
          description: 'Le protocole est maintenant archivé',
        });
      }
      return newSet;
    });
  };

  const handleConvertToPredefined = (protocol: TreatmentProtocol) => {
    convertCustomToPredefined(protocol);
    loadProtocols();
    
    toast({
      title: 'Protocole converti',
      description: `"${protocol.name}" est maintenant un protocole prédéfini`,
    });
  };

  const moveProtocol = (index: number, direction: 'up' | 'down', isCustomList: boolean) => {
    const list = isCustomList ? custom : predefined;
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === list.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newList = [...list];
    [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];
    
    // Note: Ceci est une démo visuelle - pour persister l'ordre, il faudrait
    // implémenter une logique de sauvegarde dans localStorage
    toast({
      title: 'Ordre modifié',
      description: 'L\'ordre d\'affichage a été mis à jour',
    });
  };

  const sortProtocols = (protocolList: TreatmentProtocol[]) => {
    switch (sortBy) {
      case 'alphabetical':
        return [...protocolList].sort((a, b) => a.name.localeCompare(b.name));
      case 'recent':
        return [...protocolList].sort((a, b) => 
          new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
        );
      case 'mostUsed':
        return [...protocolList].sort((a, b) => 
          (protocolUsage[b.id] || 0) - (protocolUsage[a.id] || 0)
        );
      case 'favorites':
        return [...protocolList].sort((a, b) => {
          const aFav = isFavorite(a.id) ? 1 : 0;
          const bFav = isFavorite(b.id) ? 1 : 0;
          return bFav - aFav;
        });
      default:
        return protocolList;
    }
  };

  const filterProtocols = (protocolList: TreatmentProtocol[]) => {
    let filtered = protocolList;

    // Filtrer par recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.location.toLowerCase().includes(query)
      );
    }

    // Filtrer les protocoles cachés (sauf si showHidden est activé)
    if (!showHidden) {
      filtered = filtered.filter(p => !isHidden(p.id));
    }

    return filtered;
  };

  // Séparation et filtrage des protocoles
  const predefined = filterProtocols(sortProtocols(protocols.filter(p => !p.isCustom && !archivedProtocols.has(p.id))));
  const custom = filterProtocols(sortProtocols(protocols.filter(p => p.isCustom && !archivedProtocols.has(p.id))));
  const archived = filterProtocols(sortProtocols(protocols.filter(p => archivedProtocols.has(p.id))));

  const renderProtocolCard = (protocol: TreatmentProtocol, index?: number, inCustomList?: boolean) => (
    <Card key={protocol.id} className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {protocol.name}
              {isFavorite(protocol.id) && (
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              )}
              {isHidden(protocol.id) && (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <span>{protocol.location}</span>
              {!protocol.isCustom && (
                <Badge variant="secondary" className="text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  Prédéfini
                </Badge>
              )}
              {protocol.isCustom && (
                <Badge variant="outline" className="text-xs">Personnalisé</Badge>
              )}
              {protocolUsage[protocol.id] && (
                <Badge variant="outline" className="text-xs">
                  <Activity className="h-3 w-3 mr-1" />
                  {protocolUsage[protocol.id]}
                </Badge>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 mb-4">
          <p className="text-sm">
            <span className="font-semibold">Prescriptions:</span> {protocol.prescriptions.length} PTV
          </p>
          <p className="text-sm">
            <span className="font-semibold">Contraintes OAR:</span> {protocol.oarConstraints.length}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button 
            variant={isFavorite(protocol.id) ? "default" : "outline"}
            size="sm"
            onClick={() => toggleFavorite(protocol.id)}
          >
            <Star className={`h-4 w-4 mr-1 ${isFavorite(protocol.id) ? 'fill-current' : ''}`} />
            {isFavorite(protocol.id) ? 'Favori' : 'Favoris'}
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => toggleHidden(protocol.id)}
          >
            <EyeOff className="h-4 w-4 mr-1" />
            {isHidden(protocol.id) ? 'Afficher' : 'Masquer'}
          </Button>

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSelectedProtocol(protocol)}
          >
            <Eye className="h-4 w-4 mr-1" />
            Détails
          </Button>

          <Button 
            variant="default" 
            size="sm"
            onClick={() => handleUseProtocol(protocol)}
          >
            <Activity className="h-4 w-4 mr-1" />
            Utiliser
          </Button>

          {protocol.isCustom && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleEditProtocol(protocol)}
            >
              <Edit className="h-4 w-4 mr-1" />
              Modifier
            </Button>
          )}

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleCopyProtocol(protocol)}
          >
            <Copy className="h-4 w-4 mr-1" />
            Copier
          </Button>

          {protocol.isCustom && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleArchiveProtocol(protocol.id)}
              >
                <Archive className="h-4 w-4 mr-1" />
                {archivedProtocols.has(protocol.id) ? 'Désarchiver' : 'Archiver'}
              </Button>
              
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => setProtocolToDelete(protocol.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Supprimer
              </Button>
            </>
          )}

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleExportJSON(protocol)}
          >
            <Download className="h-4 w-4 mr-1" />
            JSON
          </Button>
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
          <div className="mb-6 space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="search">Rechercher</Label>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="search"
                    placeholder="Nom ou localisation..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex-1">
                <Label htmlFor="sort-by">Trier par</Label>
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alphabetical">Ordre alphabétique</SelectItem>
                    <SelectItem value="recent">Plus récents</SelectItem>
                    <SelectItem value="mostUsed">Plus utilisés</SelectItem>
                    <SelectItem value="favorites">Favoris en premier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 items-center">
              <Button onClick={handleImportJSON} variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Importer JSON
              </Button>
              
              <Button 
                onClick={() => setShowHidden(!showHidden)} 
                variant={showHidden ? "default" : "outline"}
              >
                <EyeOff className="h-4 w-4 mr-2" />
                {showHidden ? 'Masquer cachés' : 'Afficher cachés'}
              </Button>
              
              <div className="ml-auto text-sm text-muted-foreground">
                {favorites.length > 0 && `${favorites.length} favoris · `}
                {hiddenProtocols.length > 0 && `${hiddenProtocols.length} masqués`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="predefined">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="predefined">
            Protocoles Prédéfinis ({predefined.length})
          </TabsTrigger>
          <TabsTrigger value="custom">
            Protocoles Personnalisés ({custom.length})
          </TabsTrigger>
          <TabsTrigger value="archived">
            Archivés ({archived.length})
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
              {predefined.map((p) => renderProtocolCard(p))}
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
              {custom.map((p, idx) => renderProtocolCard(p, idx, true))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="archived" className="space-y-4">
          {archived.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <Archive className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Aucun protocole archivé</p>
                <p className="text-sm mt-1">Les protocoles archivés apparaîtront ici</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {archived.map((p) => renderProtocolCard(p))}
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

      <AlertDialog open={!!protocolToDelete} onOpenChange={() => {
        setProtocolToDelete(null);
        setDeletePassword('');
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce protocole personnalisé ? Cette action est irréversible.
              <div className="mt-4">
                <Label htmlFor="delete-password">Mot de passe requis</Label>
                <Input
                  id="delete-password"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Entrez le mot de passe"
                  className="mt-2"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletePassword('')}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {protocolToEdit && (
        <ProtocolEditor
          protocol={protocolToEdit}
          open={editorOpen}
          onOpenChange={setEditorOpen}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}
