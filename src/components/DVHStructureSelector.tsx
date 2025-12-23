import { useMemo, useState } from 'react';
import { Structure, StructureCategory } from '@/types/dvh';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  ChevronDown, 
  Search, 
  CheckSquare, 
  Square,
  Target,
  Shield,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DVHStructureSelectorProps {
  structures: Structure[];
  selectedStructures: string[];
  onStructureToggle: (structureName: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

const getCategoryIcon = (category: StructureCategory) => {
  switch (category) {
    case 'PTV': return Target;
    case 'OAR': return Shield;
    default: return Layers;
  }
};

const getCategoryStyle = (category: StructureCategory) => {
  switch (category) {
    case 'PTV': return 'badge-ptv';
    case 'OAR': return 'badge-oar';
    default: return 'badge-info';
  }
};

export const DVHStructureSelector = ({
  structures,
  selectedStructures,
  onStructureToggle,
  onSelectAll,
  onDeselectAll
}: DVHStructureSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);

  // Group structures by category
  const groupedStructures = useMemo(() => {
    const groups: Record<StructureCategory, Structure[]> = {
      'PTV': [],
      'OAR': [],
      'OTHER': []
    };

    structures.forEach(structure => {
      const category = structure.category || 'OTHER';
      if (groups[category]) {
        groups[category].push(structure);
      } else {
        groups['OTHER'].push(structure);
      }
    });

    return groups;
  }, [structures]);

  // Filter structures based on search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedStructures;

    const query = searchQuery.toLowerCase();
    const filtered: Record<StructureCategory, Structure[]> = {
      'PTV': [],
      'OAR': [],
      'OTHER': []
    };

    Object.entries(groupedStructures).forEach(([category, structs]) => {
      filtered[category as StructureCategory] = structs.filter(s => 
        s.name.toLowerCase().includes(query)
      );
    });

    return filtered;
  }, [groupedStructures, searchQuery]);

  // Count selected per category
  const selectionCounts = useMemo(() => {
    const counts: Record<StructureCategory, { selected: number; total: number }> = {
      'PTV': { selected: 0, total: groupedStructures['PTV'].length },
      'OAR': { selected: 0, total: groupedStructures['OAR'].length },
      'OTHER': { selected: 0, total: groupedStructures['OTHER'].length }
    };

    selectedStructures.forEach(name => {
      const structure = structures.find(s => s.name === name);
      if (structure && counts[structure.category]) {
        counts[structure.category].selected++;
      }
    });

    return counts;
  }, [selectedStructures, structures, groupedStructures]);

  const handleSelectCategory = (category: StructureCategory) => {
    const categoryStructures = groupedStructures[category];
    const allSelected = categoryStructures.every(s => selectedStructures.includes(s.name));
    
    if (allSelected) {
      // Deselect all in category
      categoryStructures.forEach(s => {
        if (selectedStructures.includes(s.name)) {
          onStructureToggle(s.name);
        }
      });
    } else {
      // Select all in category
      categoryStructures.forEach(s => {
        if (!selectedStructures.includes(s.name)) {
          onStructureToggle(s.name);
        }
      });
    }
  };

  const renderCategoryGroup = (category: StructureCategory, label: string) => {
    const structs = filteredGroups[category];
    if (structs.length === 0) return null;

    const Icon = getCategoryIcon(category);
    const allSelected = groupedStructures[category].every(s => selectedStructures.includes(s.name));
    const someSelected = groupedStructures[category].some(s => selectedStructures.includes(s.name));

    return (
      <div key={category} className="mb-4">
        <div 
          className="flex items-center gap-2 mb-2 cursor-pointer hover:bg-muted/50 rounded-md p-1.5 -mx-1.5 transition-colors"
          onClick={() => handleSelectCategory(category)}
        >
          <Checkbox 
            checked={allSelected}
            className={cn(
              someSelected && !allSelected && "data-[state=unchecked]:bg-primary/30"
            )}
          />
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">{label}</span>
          <Badge variant="secondary" className={cn("ml-auto text-xs", getCategoryStyle(category))}>
            {selectionCounts[category].selected}/{selectionCounts[category].total}
          </Badge>
        </div>
        <div className="space-y-0.5 ml-6">
          {structs.map(structure => {
            const isSelected = selectedStructures.includes(structure.name);
            return (
              <div
                key={structure.name}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-all",
                  "hover:bg-muted/50",
                  isSelected && category === 'PTV' && "bg-ptv/10 border-l-2 border-ptv",
                  isSelected && category === 'OAR' && "bg-oar/10 border-l-2 border-oar",
                  isSelected && category === 'OTHER' && "bg-info/10 border-l-2 border-info"
                )}
                onClick={() => onStructureToggle(structure.name)}
              >
                <Checkbox checked={isSelected} />
                <span className={cn(
                  "text-sm truncate flex-1",
                  isSelected && "font-medium"
                )}>
                  {structure.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className={cn(
            "gap-2 min-w-[200px] justify-between",
            selectedStructures.length > 0 && "border-primary/50"
          )}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            <span className="font-medium">
              {selectedStructures.length === 0 
                ? "Sélectionner structures" 
                : `${selectedStructures.length} structure${selectedStructures.length > 1 ? 's' : ''}`}
            </span>
          </div>
          <ChevronDown className={cn(
            "w-4 h-4 transition-transform",
            open && "rotate-180"
          )} />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[320px] p-0 bg-popover border shadow-lg z-50" 
        align="start"
        sideOffset={4}
      >
        {/* Header with search and actions */}
        <div className="p-3 border-b space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une structure..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-1.5 h-8"
              onClick={onSelectAll}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Tout
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-1.5 h-8"
              onClick={onDeselectAll}
            >
              <Square className="w-3.5 h-3.5" />
              Aucun
            </Button>
          </div>
        </div>

        {/* Structure list */}
        <ScrollArea className="h-[300px]">
          <div className="p-3">
            {renderCategoryGroup('PTV', 'Volumes Cibles (PTV)')}
            {renderCategoryGroup('OAR', 'Organes à Risque (OAR)')}
            {renderCategoryGroup('OTHER', 'Autres structures')}
            
            {Object.values(filteredGroups).every(g => g.length === 0) && (
              <div className="text-center text-muted-foreground py-8">
                Aucune structure trouvée
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer with selection summary */}
        <div className="p-3 border-t bg-muted/30 flex items-center justify-between">
          <div className="flex gap-2">
            {selectionCounts['PTV'].selected > 0 && (
              <Badge className="badge-ptv text-xs">
                {selectionCounts['PTV'].selected} PTV
              </Badge>
            )}
            {selectionCounts['OAR'].selected > 0 && (
              <Badge className="badge-oar text-xs">
                {selectionCounts['OAR'].selected} OAR
              </Badge>
            )}
          </div>
          <Button 
            size="sm" 
            className="h-7"
            onClick={() => setOpen(false)}
          >
            Appliquer
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
