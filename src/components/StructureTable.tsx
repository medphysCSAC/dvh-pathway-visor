import { useMemo, useState, useCallback, CSSProperties, ReactElement } from 'react';
import { List } from 'react-window';
import { Structure, StructureCategory } from '@/types/dvh';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { calculateMetrics } from '@/utils/dvhParser';
import { Target, Shield, Circle, Star, Search, X } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';
import { toast } from 'sonner';
import { ContextualHelp } from './ContextualHelp';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';

interface StructureTableProps {
  structures: Structure[];
  selectedStructures: string[];
  onStructureToggle: (structureName: string) => void;
  onCategoryChange?: (structureName: string, newCategory: StructureCategory) => void;
}

const VIRTUALIZATION_THRESHOLD = 50;
const ROW_HEIGHT = 52;
const VISIBLE_ROWS = 10;

interface VirtualizedRowProps {
  data: Structure[];
  selectedStructures: string[];
  isFavorite: (name: string) => boolean;
  onStructureToggle: (name: string) => void;
  onToggleFavorite: (name: string, e: React.MouseEvent) => void;
  onCategoryChange: (name: string, category: StructureCategory) => void;
  getRowClassName: (category: StructureCategory, isSelected: boolean) => string;
}

export const StructureTable = ({ 
  structures, 
  selectedStructures, 
  onStructureToggle,
  onCategoryChange 
}: StructureTableProps) => {
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const handleCategoryChange = useCallback((structureName: string, newCategory: StructureCategory) => {
    if (onCategoryChange) {
      onCategoryChange(structureName, newCategory);
      toast.success(`Catégorie de "${structureName}" changée en ${newCategory}`);
    }
  }, [onCategoryChange]);

  const handleToggleFavorite = useCallback((structureName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(structureName);
    toast.success(
      isFavorite(structureName) 
        ? `"${structureName}" retiré des favoris` 
        : `"${structureName}" ajouté aux favoris`
    );
  }, [toggleFavorite, isFavorite]);

  // Filtered and sorted structures
  const filteredAndSortedStructures = useMemo(() => {
    const categoryOrder = { PTV: 0, OAR: 1, OTHER: 2 };
    
    return [...structures]
      .filter(structure => {
        const matchesSearch = structure.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || structure.category === categoryFilter;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        const aFav = isFavorite(a.name) ? 1 : 0;
        const bFav = isFavorite(b.name) ? 1 : 0;
        if (aFav !== bFav) return bFav - aFav;
        return categoryOrder[a.category] - categoryOrder[b.category];
      });
  }, [structures, favorites, searchQuery, categoryFilter, isFavorite]);

  const getRowClassName = useCallback((category: Structure['category'], isSelected: boolean, index: number) => {
    const baseClass = 'cursor-pointer transition-colors';
    const alternatingClass = index % 2 === 0 ? 'bg-muted/20' : '';
    
    if (isSelected) {
      return `${baseClass} bg-primary/15 border-l-4 border-l-primary`;
    }
    
    switch (category) {
      case 'PTV':
        return `${baseClass} ${alternatingClass} hover:bg-ptv/10 border-l-4 border-l-ptv/50`;
      case 'OAR':
        return `${baseClass} ${alternatingClass} hover:bg-oar/10 border-l-4 border-l-oar/50`;
      default:
        return `${baseClass} ${alternatingClass} hover:bg-muted/30 border-l-4 border-l-other-structure/30`;
    }
  }, []);

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
  };

  const hasActiveFilters = searchQuery !== '' || categoryFilter !== 'all';

  // Row component for virtualized list (react-window v2 API)
  const VirtualizedRowComponent = useCallback(({ 
    index, 
    style 
  }: { 
    ariaAttributes: { "aria-posinset": number; "aria-setsize": number; role: "listitem" };
    index: number; 
    style: CSSProperties;
  }): ReactElement => {
    const structure = filteredAndSortedStructures[index];
    const metrics = calculateMetrics(structure);
    const isSelected = selectedStructures.includes(structure.name);
    const isFav = isFavorite(structure.name);

    if (!metrics) {
      return <div style={style} />;
    }

    return (
      <div 
        style={style} 
        className={`flex items-center border-b ${getRowClassName(structure.category, isSelected, index)}`}
        onClick={() => onStructureToggle(structure.name)}
      >
        <div className="w-12 flex justify-center" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => handleToggleFavorite(structure.name, e)}
          >
            <Star className={`w-4 h-4 ${isFav ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
          </Button>
        </div>
        <div className="w-12 flex justify-center" onClick={(e) => e.stopPropagation()}>
          <Checkbox 
            checked={isSelected}
            onCheckedChange={() => onStructureToggle(structure.name)}
          />
        </div>
        <div className="flex-1 min-w-[150px] px-2 font-medium truncate">{structure.name}</div>
        <div className="w-[140px] px-2" onClick={(e) => e.stopPropagation()}>
          <Select
            value={structure.category}
            onValueChange={(val) => handleCategoryChange(structure.name, val as StructureCategory)}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PTV">
                <div className="flex items-center gap-2">
                  <Target className="w-3 h-3 text-ptv" />
                  <span className="text-ptv font-medium">PTV</span>
                </div>
              </SelectItem>
              <SelectItem value="OAR">
                <div className="flex items-center gap-2">
                  <Shield className="w-3 h-3 text-oar" />
                  <span className="text-oar font-medium">OAR</span>
                </div>
              </SelectItem>
              <SelectItem value="OTHER">
                <div className="flex items-center gap-2">
                  <Circle className="w-3 h-3 text-other-structure" />
                  <span className="text-other-structure font-medium">Autre</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-20 px-2 text-right">{metrics.volume.toFixed(2)}</div>
        <div className="w-20 px-2 text-right">{metrics.dmax.toFixed(2)}</div>
        <div className="w-20 px-2 text-right">{metrics.dmean.toFixed(2)}</div>
        <div className="w-20 px-2 text-right">{metrics.v20Gy?.toFixed(2) || 'N/A'}</div>
        <div className="w-20 px-2 text-right">
          {metrics.v20Gy && structure.totalVolume 
            ? ((metrics.v20Gy / 100) * structure.totalVolume).toFixed(2) 
            : 'N/A'}
        </div>
        <div className="w-20 px-2 text-right">{metrics.v40Gy?.toFixed(2) || 'N/A'}</div>
        <div className="w-20 px-2 text-right">
          {metrics.v40Gy && structure.totalVolume 
            ? ((metrics.v40Gy / 100) * structure.totalVolume).toFixed(2) 
            : 'N/A'}
        </div>
      </div>
    );
  }, [filteredAndSortedStructures, selectedStructures, isFavorite, onStructureToggle, handleToggleFavorite, handleCategoryChange, getRowClassName]);

  const useVirtualization = filteredAndSortedStructures.length > VIRTUALIZATION_THRESHOLD;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Structures anatomiques et métriques</CardTitle>
          <ContextualHelp 
            content="Tableau récapitulatif de toutes les structures avec leurs métriques dosimétriques. Cliquez sur les structures pour les afficher/masquer du graphique DVH. Utilisez les favoris pour accéder rapidement aux structures importantes."
            side="right"
          />
          {useVirtualization && (
            <Badge variant="secondary" className="ml-2">
              Virtualisé ({filteredAndSortedStructures.length} structures)
            </Badge>
          )}
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une structure..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="PTV">PTV uniquement</SelectItem>
              <SelectItem value="OAR">OAR uniquement</SelectItem>
              <SelectItem value="OTHER">Autres</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Effacer filtres
            </Button>
          )}
        </div>
        
        <div className="text-sm text-muted-foreground mt-2">
          {filteredAndSortedStructures.length} structure(s) sur {structures.length}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-hidden">
          {/* Table Header */}
          <div className="flex items-center bg-muted/50 border-b font-medium text-sm">
            <div className="w-12 flex justify-center py-3">
              <Star className="h-4 w-4" />
            </div>
            <div className="w-12 py-3">
              <span className="sr-only">Sélection</span>
            </div>
            <div className="flex-1 min-w-[150px] px-2 py-3">
              <div className="flex items-center gap-1">
                Structure
                <ContextualHelp 
                  content="Nom de la structure anatomique (PTV ou OAR). Les favoris apparaissent en premier."
                  side="top"
                />
              </div>
            </div>
            <div className="w-[140px] px-2 py-3">
              <div className="flex items-center gap-1">
                Catégorie
                <ContextualHelp 
                  content="Type de structure : PTV (Planning Target Volume), OAR (Organ At Risk), ou OTHER."
                  side="top"
                />
              </div>
            </div>
            <div className="w-20 px-2 py-3 text-right">
              <div className="flex items-center justify-end gap-1">
                Volume
                <ContextualHelp 
                  content="Volume total de la structure en centimètres cubes."
                  side="top"
                />
              </div>
            </div>
            <div className="w-20 px-2 py-3 text-right">
              <div className="flex items-center justify-end gap-1">
                D<sub>max</sub>
                <ContextualHelp 
                  content="Dose maximale reçue par la structure."
                  side="top"
                />
              </div>
            </div>
            <div className="w-20 px-2 py-3 text-right">
              <div className="flex items-center justify-end gap-1">
                D<sub>mean</sub>
                <ContextualHelp 
                  content="Dose moyenne reçue par la structure."
                  side="top"
                />
              </div>
            </div>
            <div className="w-20 px-2 py-3 text-right">V<sub>20</sub>%</div>
            <div className="w-20 px-2 py-3 text-right">V<sub>20</sub>cc</div>
            <div className="w-20 px-2 py-3 text-right">V<sub>40</sub>%</div>
            <div className="w-20 px-2 py-3 text-right">V<sub>40</sub>cc</div>
          </div>

          {/* Table Body */}
          {filteredAndSortedStructures.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucune structure trouvée
            </div>
          ) : useVirtualization ? (
            // Virtualized list for large datasets (react-window v2)
            <List
              style={{ height: ROW_HEIGHT * VISIBLE_ROWS }}
              rowCount={filteredAndSortedStructures.length}
              rowHeight={ROW_HEIGHT}
              rowComponent={VirtualizedRowComponent}
              rowProps={{}}
            />
          ) : (
            // Standard table for smaller datasets
            <Table>
              <TableBody>
                {filteredAndSortedStructures.map((structure, index) => {
                  const metrics = calculateMetrics(structure);
                  if (!metrics) return null;

                  const isSelected = selectedStructures.includes(structure.name);
                  const isFav = isFavorite(structure.name);

                  return (
                    <TableRow 
                      key={structure.name}
                      className={getRowClassName(structure.category, isSelected, index)}
                      onClick={() => onStructureToggle(structure.name)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()} className="w-12">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleToggleFavorite(structure.name, e)}
                        >
                          <Star className={`w-4 h-4 ${isFav ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                        </Button>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()} className="w-12">
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
                                <Target className="w-3 h-3 text-ptv" />
                                <span className="text-ptv font-medium">PTV</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="OAR">
                              <div className="flex items-center gap-2">
                                <Shield className="w-3 h-3 text-oar" />
                                <span className="text-oar font-medium">OAR</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="OTHER">
                              <div className="flex items-center gap-2">
                                <Circle className="w-3 h-3 text-other-structure" />
                                <span className="text-other-structure font-medium">Autre</span>
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
          )}
        </div>
      </CardContent>
    </Card>
  );
};