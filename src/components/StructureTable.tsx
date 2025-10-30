import { useMemo } from 'react';
import { Structure } from '@/types/dvh';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { calculateMetrics } from '@/utils/dvhParser';
import { Target, Shield, Circle } from 'lucide-react';
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
}

export const StructureTable = ({ 
  structures, 
  selectedStructures, 
  onStructureToggle 
}: StructureTableProps) => {
  // Tri par catégorie: PTV > OAR > OTHER
  const sortedStructures = useMemo(() => {
    const categoryOrder = { PTV: 0, OAR: 1, OTHER: 2 };
    return [...structures].sort((a, b) => {
      return categoryOrder[a.category] - categoryOrder[b.category];
    });
  }, [structures]);

  const getCategoryBadge = (category: Structure['category']) => {
    switch (category) {
      case 'PTV':
        return (
          <Badge variant="destructive" className="gap-1">
            <Target className="w-3 h-3" />
            PTV
          </Badge>
        );
      case 'OAR':
        return (
          <Badge className="gap-1 bg-blue-500 hover:bg-blue-600">
            <Shield className="w-3 h-3" />
            OAR
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <Circle className="w-3 h-3" />
            Autre
          </Badge>
        );
    }
  };

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
                  <span className="sr-only">Sélection</span>
                </TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Structure</TableHead>
                <TableHead className="text-right">Volume (cc)</TableHead>
                <TableHead className="text-right">D<sub>max</sub> (Gy)</TableHead>
                <TableHead className="text-right">D<sub>mean</sub> (Gy)</TableHead>
                <TableHead className="text-right">V<sub>20Gy</sub> (%)</TableHead>
                <TableHead className="text-right">V<sub>40Gy</sub> (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStructures.map((structure) => {
                const metrics = calculateMetrics(structure);
                if (!metrics) return null;

                const isSelected = selectedStructures.includes(structure.name);

                return (
                  <TableRow 
                    key={structure.name}
                    className={getRowClassName(structure.category, isSelected)}
                    onClick={() => onStructureToggle(structure.name)}
                  >
                    <TableCell>
                      <Checkbox 
                        checked={isSelected}
                        onCheckedChange={() => onStructureToggle(structure.name)}
                      />
                    </TableCell>
                    <TableCell>
                      {getCategoryBadge(structure.category)}
                    </TableCell>
                    <TableCell className="font-medium">{structure.name}</TableCell>
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
                      {metrics.v40Gy?.toFixed(2) || 'N/A'}
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
