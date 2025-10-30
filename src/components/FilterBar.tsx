import { Structure, StructureCategory } from '@/types/dvh';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Target, Shield, Circle } from 'lucide-react';

interface FilterBarProps {
  structures: Structure[];
  selectedStructures: string[];
  onFilterChange: (category: StructureCategory | 'ALL') => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  activeFilter: StructureCategory | 'ALL';
}

export const FilterBar = ({
  structures,
  selectedStructures,
  onFilterChange,
  onSelectAll,
  onDeselectAll,
  activeFilter
}: FilterBarProps) => {
  const ptvCount = structures.filter(s => s.category === 'PTV').length;
  const oarCount = structures.filter(s => s.category === 'OAR').length;
  const totalCount = structures.length;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          {/* Filter buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={activeFilter === 'PTV' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onFilterChange('PTV')}
              className="gap-2"
            >
              <Target className="w-4 h-4" />
              PTV
              <Badge variant="secondary" className="ml-1">
                {ptvCount}
              </Badge>
            </Button>
            
            <Button
              variant={activeFilter === 'OAR' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onFilterChange('OAR')}
              className="gap-2"
            >
              <Shield className="w-4 h-4" />
              OAR
              <Badge variant="secondary" className="ml-1">
                {oarCount}
              </Badge>
            </Button>
            
            <Button
              variant={activeFilter === 'ALL' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onFilterChange('ALL')}
              className="gap-2"
            >
              <Circle className="w-4 h-4" />
              Toutes
              <Badge variant="secondary" className="ml-1">
                {totalCount}
              </Badge>
            </Button>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground">
              {selectedStructures.length} sélectionnée{selectedStructures.length > 1 ? 's' : ''}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onSelectAll}
            >
              Tout sélectionner
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDeselectAll}
            >
              Tout désélectionner
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
