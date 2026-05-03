import { useState, useEffect, useMemo } from 'react';
import {
  Search, Star, Camera, FileUp, Upload, CheckCircle, ChevronRight,
  Shield, Sparkles, SkipForward, Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { TreatmentProtocol } from '@/types/protocol';
import { Structure } from '@/types/dvh';
import { getAllProtocols, saveCustomProtocol } from '@/data/predefinedProtocols';
import { useFavorites } from '@/hooks/useFavorites';
import ProtocolImageExtractor from './ProtocolImageExtractor';
import { ProtocolFileExtractor } from './ProtocolFileExtractor';
import { useToast } from '@/hooks/use-toast';

interface ProtocolSelectorStepProps {
  structures: Structure[];
  onSelect: (protocol: TreatmentProtocol) => void;
  onSkip: () => void;
}

const scoreProtocol = (protocol: TreatmentProtocol, structureNames: string[]): number => {
  const names = structureNames.map((n) => n.toLowerCase());
  return protocol.oarConstraints.filter((c) => {
    const organ = c.organName.toLowerCase();
    return names.some((n) => n.includes(organ) || organ.includes(n));
  }).length;
};

export const ProtocolSelectorStep = ({
  structures,
  onSelect,
  onSkip,
}: ProtocolSelectorStepProps) => {
  const { toast } = useToast();
  const { isFavorite } = useFavorites();
  const [protocols, setProtocols] = useState<TreatmentProtocol[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<TreatmentProtocol | null>(null);
  const [imageOpen, setImageOpen] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);

  const structureNames = useMemo(() => structures.map((s) => s.name), [structures]);

  const refresh = async () => {
    const all = await getAllProtocols();
    setProtocols(all);
  };

  useEffect(() => {
    refresh();
  }, []);

  const sorted = useMemo(() => {
    return [...protocols]
      .map((p) => ({ protocol: p, score: scoreProtocol(p, structureNames) }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aFav = isFavorite(a.protocol.id) ? 1 : 0;
        const bFav = isFavorite(b.protocol.id) ? 1 : 0;
        if (bFav !== aFav) return bFav - aFav;
        return a.protocol.name.localeCompare(b.protocol.name);
      });
  }, [protocols, structureNames, isFavorite]);

  const topSuggestion = sorted[0]?.score > 0 ? sorted[0].protocol : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter(({ protocol }) => {
      if (!q) return true;
      return (
        protocol.name.toLowerCase().includes(q) ||
        protocol.location.toLowerCase().includes(q)
      );
    });
  }, [sorted, search]);

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      try {
        const imported = JSON.parse(await f.text()) as TreatmentProtocol;
        if (!imported.id || !imported.name || !imported.prescriptions) {
          throw new Error('Format invalide');
        }
        imported.isCustom = true;
        imported.createdAt = new Date();
        imported.modifiedAt = new Date();
        await saveCustomProtocol(imported);
        await refresh();
        setSelected(imported);
        toast({ title: 'Protocole importé', description: `"${imported.name}" est prêt` });
      } catch {
        toast({
          title: 'Erreur',
          description: 'Fichier JSON invalide',
          variant: 'destructive',
        });
      }
    };
    input.click();
  };

  const handleExtracted = async (protocol: TreatmentProtocol) => {
    await saveCustomProtocol(protocol);
    await refresh();
    setSelected(protocol);
    setImageOpen(false);
    setFileOpen(false);
    toast({
      title: 'Protocole créé et sélectionné',
      description: `"${protocol.name}" sera utilisé pour cette analyse`,
    });
  };

  return (
    <Card className="border-2 border-primary/40 bg-primary/5">
      <CardContent className="p-5 space-y-5">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-gradient-to-br from-primary to-accent p-1.5">
              <Target className="w-4 h-4 text-primary-foreground" />
            </div>
            <h3 className="text-base font-semibold">Associer un protocole à ce plan</h3>
            <Badge variant="outline" className="ml-auto text-[10px]">Optionnel</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Les contraintes de dose s'afficheront{' '}
            <span className="font-medium text-foreground">
              directement sur vos courbes DVH
            </span>{' '}
            — chaque structure montrera en vert/rouge si la contrainte est respectée.
          </p>
        </div>

        {/* Suggestion */}
        {topSuggestion && !search && (
          <button
            type="button"
            onClick={() =>
              setSelected(selected?.id === topSuggestion.id ? null : topSuggestion)
            }
            className={`w-full text-left rounded-lg border p-3 transition-colors ${
              selected?.id === topSuggestion.id
                ? 'border-success bg-success/10'
                : 'border-accent/40 bg-accent/5 hover:bg-accent/10'
            }`}
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-accent flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{topSuggestion.name}</span>
                  <Badge
                    variant="outline"
                    className="bg-accent/15 text-accent-foreground border-accent/30 text-[10px]"
                  >
                    Suggéré
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {topSuggestion.oarConstraints.length} contraintes · {topSuggestion.location}
                </p>
              </div>
              {selected?.id === topSuggestion.id && (
                <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
              )}
            </div>
          </button>
        )}

        {/* Recherche */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un protocole..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>

        {/* Liste */}
        <ScrollArea className="h-56 rounded-md border bg-card">
          <div className="divide-y">
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center p-6">
                Aucun protocole trouvé
              </p>
            )}
            {filtered.map(({ protocol, score }) => {
              const isSelected = selected?.id === protocol.id;
              return (
                <button
                  key={protocol.id}
                  type="button"
                  onClick={() => setSelected(isSelected ? null : protocol)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                    isSelected ? 'bg-success/10' : 'hover:bg-muted/50'
                  }`}
                >
                  {isFavorite(protocol.id) ? (
                    <Star className="w-3.5 h-3.5 text-warning fill-warning flex-shrink-0" />
                  ) : score > 0 ? (
                    <Sparkles className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                  ) : (
                    <span className="w-3.5 h-3.5 flex-shrink-0" />
                  )}
                  <span className="flex-1 truncate">{protocol.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {protocol.oarConstraints.length} OAR
                  </Badge>
                  {isSelected && (
                    <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>

        {/* Séparateur */}
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            ou créer un nouveau protocole
          </span>
          <Separator className="flex-1" />
        </div>

        {/* Boutons création */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button variant="outline" size="sm" onClick={() => setImageOpen(true)}>
            <Camera className="w-4 h-4 mr-2" />
            Depuis image
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFileOpen(true)}>
            <FileUp className="w-4 h-4 mr-2" />
            Depuis fichier
          </Button>
          <Button variant="outline" size="sm" onClick={handleImportJSON}>
            <Upload className="w-4 h-4 mr-2" />
            Importer JSON
          </Button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Button variant="ghost" onClick={onSkip}>
            <SkipForward className="w-4 h-4 mr-2" />
            Passer cette étape
          </Button>
          <Button
            onClick={() => selected && onSelect(selected)}
            disabled={!selected}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            <ChevronRight className="w-4 h-4 mr-2" />
            {selected ? `Utiliser "${selected.name}"` : 'Sélectionner un protocole'}
          </Button>
        </div>

        {/* Extracteurs */}
        <ProtocolImageExtractor
          open={imageOpen}
          onOpenChange={setImageOpen}
          onProtocolExtracted={handleExtracted}
        />
        <ProtocolFileExtractor
          open={fileOpen}
          onOpenChange={setFileOpen}
          onProtocolExtracted={handleExtracted}
        />
      </CardContent>
    </Card>
  );
};

export default ProtocolSelectorStep;
