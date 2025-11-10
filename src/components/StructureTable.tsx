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
        <CardTitle>Structures anatomiques et métriques</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12">
                  <span className="sr-only">Favori</span>
                </TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Sélection</span>
                </TableHead>
                <TableHead>Structure</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead className="text-right">Volume (cc)</TableHead>
                <TableHead className="text-right">D<sub>max</sub> (Gy)</TableHead>
                <TableHead className="text-right">D<sub>mean</sub> (Gy)</TableHead>
                <TableHead className="text-right">V<sub>20Gy</sub> (%)</TableHead>
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
