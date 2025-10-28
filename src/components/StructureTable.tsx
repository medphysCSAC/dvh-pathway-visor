import { Structure } from '@/types/dvh';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { calculateMetrics } from '@/utils/dvhParser';
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
                <TableHead>Structure</TableHead>
                <TableHead className="text-right">Volume (cc)</TableHead>
                <TableHead className="text-right">D<sub>max</sub> (Gy)</TableHead>
                <TableHead className="text-right">D<sub>mean</sub> (Gy)</TableHead>
                <TableHead className="text-right">V<sub>20Gy</sub> (%)</TableHead>
                <TableHead className="text-right">V<sub>40Gy</sub> (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {structures.map((structure) => {
                const metrics = calculateMetrics(structure);
                if (!metrics) return null;

                const isSelected = selectedStructures.includes(structure.name);

                return (
                  <TableRow 
                    key={structure.name}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                    }`}
                    onClick={() => onStructureToggle(structure.name)}
                  >
                    <TableCell>
                      <Checkbox 
                        checked={isSelected}
                        onCheckedChange={() => onStructureToggle(structure.name)}
                      />
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
