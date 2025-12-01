import { useMemo } from 'react';
import { Structure, StructureCategory } from '@/types/dvh';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { calculateMetrics } from '@/utils/dvhParser';
import { Target, Shield, Circle, Star } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';
import { toast } from 'sonner';
import { ContextualHelp } from './ContextualHelp';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface StructureTableProps {
  structures: Structure[];
  selectedStructures: string[];
  onStructureToggle: (structureName: string) => void;
  onCategoryChange?: (structureName: string, newCategory: StructureCategory) => void;
}

export const StructureTable = ({ 
  structures, 
  selectedStructures, 
  onStructureToggle,
  onCategoryChange 
}: StructureTableProps) => {
  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  const handleCategoryChange = (structureName: string, newCategory: StructureCategory) => {
    if (onCategoryChange) {
      onCategoryChange(structureName, newCategory);
      toast.success(`Catégorie de "${structureName}" changée en ${newCategory}`);
    }
  };

  const handleToggleFavorite = (structureName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(structureName);
    toast.success(
      isFavorite(structureName) 
        ? `"${structureName}" retiré des favoris` 
        : `"${structureName}" ajouté aux favoris`
    );
  };

  // Tri par catégorie: Favoris > PTV > OAR > OTHER
  const sortedStructures = useMemo(() => {
    const categoryOrder = { PTV: 0, OAR: 1, OTHER: 2 };
    return [...structures].sort((a, b) => {
      const aFav = isFavorite(a.name) ? 1 : 0;
      const bFav = isFavorite(b.name) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      
      return categoryOrder[a.category] - categoryOrder[b.category];
    });
  }, [structures, favorites]);

  const getRowClassName = (category: Structure['category'], isSelected: boolean) => {
    const baseClass = 'cursor-pointer transition-colors';
    if (isSelected) return `${baseClass} bg-primary/10`;
    
    switch (category) {
      case 'PTV':
        return `${baseClass} hover:bg-red-50 dark:hover:bg-red-950/20`;
      case 'OAR':
        return `${baseClass} hover:bg-blue-50 dark:hover:bg-blue-950/20`;
      default:
        return `${baseClass} hover:bg-muted/30`;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Structures anatomiques et métriques</CardTitle>
          <ContextualHelp 
            content="Tableau récapitulatif de toutes les structures avec leurs métriques dosimétriques. Cliquez sur les structures pour les afficher/masquer du graphique DVH. Utilisez les favoris pour accéder rapidement aux structures importantes."
            side="right"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12">
                  <div className="flex items-center justify-center">
                    <Star className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Sélection</span>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    Structure
                    <ContextualHelp 
                      content="Nom de la structure anatomique (PTV ou OAR). Les favoris apparaissent en premier."
                      side="top"
                    />
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    Catégorie
                    <ContextualHelp 
                      content="Type de structure : PTV (Planning Target Volume), OAR (Organ At Risk), ou OTHER."
                      side="top"
                    />
                  </div>
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    Volume (cc)
                    <ContextualHelp 
                      content="Volume total de la structure en centimètres cubes."
                      side="top"
                    />
                  </div>
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    D<sub>max</sub> (Gy)
                    <ContextualHelp 
                      content="Dose maximale reçue par la structure. Correspond à D0.03cc ou D2% selon les standards."
                      side="top"
                    />
                  </div>
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    D<sub>mean</sub> (Gy)
                    <ContextualHelp 
                      content="Dose moyenne reçue par l'ensemble de la structure."
                      side="top"
                    />
                  </div>
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    V<sub>20Gy</sub> (%)
                    <ContextualHelp 
                      content="Pourcentage du volume recevant au moins 20 Gy. Métrique clé pour les OARs."
                      side="top"
                    />
                  </div>
                </TableHead>
                <TableHead className="text-right">V<sub>20Gy</sub> (cc)</TableHead>
                <TableHead className="text-right">V<sub>40Gy</sub> (%)</TableHead>
                <TableHead className="text-right">V<sub>40Gy</sub> (cc)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStructures.map((structure) => {
                const metrics = calculateMetrics(structure);
                if (!metrics) return null;

                const isSelected = selectedStructures.includes(structure.name);
                const isFav = isFavorite(structure.name);

                return (
                  <TableRow 
                    key={structure.name}
                    className={getRowClassName(structure.category, isSelected)}
                    onClick={() => onStructureToggle(structure.name)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleToggleFavorite(structure.name, e)}
                      >
                        <Star className={`w-4 h-4 ${isFav ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                      </Button>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox 
                        checked={isSelected}
                        onCheckedChange={() => onStructureToggle(structure.name)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{structure.name}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={structure.category}
                        onValueChange={(val) => handleCategoryChange(structure.name, val as StructureCategory)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PTV">
                            <div className="flex items-center gap-2">
                              <Target className="w-3 h-3" />
                              PTV
                            </div>
                          </SelectItem>
                          <SelectItem value="OAR">
                            <div className="flex items-center gap-2">
                              <Shield className="w-3 h-3" />
                              OAR
                            </div>
                          </SelectItem>
                          <SelectItem value="OTHER">
                            <div className="flex items-center gap-2">
                              <Circle className="w-3 h-3" />
                              Autre
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      {metrics.volume.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {metrics.dmax.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {metrics.dmean.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {metrics.v20Gy?.toFixed(2) || 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      {metrics.v20Gy && structure.totalVolume 
                        ? ((metrics.v20Gy / 100) * structure.totalVolume).toFixed(2) 
                        : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      {metrics.v40Gy?.toFixed(2) || 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      {metrics.v40Gy && structure.totalVolume 
                        ? ((metrics.v40Gy / 100) * structure.totalVolume).toFixed(2) 
                        : 'N/A'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
