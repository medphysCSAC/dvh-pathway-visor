import { useState } from 'react';
import { Structure } from '@/types/dvh';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { calculateDx, calculateVx } from '@/utils/planQualityMetrics';
import { CustomCalculation } from '@/types/calculations';
import { Calculator, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface DoseCalculatorProps {
  structures: Structure[];
}

export const DoseCalculator = ({ structures }: DoseCalculatorProps) => {
  const [selectedStructure, setSelectedStructure] = useState<string>('');
  const [calculationType, setCalculationType] = useState<'Vx' | 'Dx'>('Vx');
  const [inputValue, setInputValue] = useState<string>('');
  const [history, setHistory] = useState<CustomCalculation[]>([]);

  const handleCalculate = () => {
    if (!selectedStructure || !inputValue) {
      toast.error('Veuillez sélectionner une structure et entrer une valeur');
      return;
    }

    const structure = structures.find(s => s.name === selectedStructure);
    if (!structure) return;

    const input = parseFloat(inputValue);
    let result: number;
    let unit: string;

    if (calculationType === 'Vx') {
      result = calculateVx(structure, input);
      unit = '%';
      toast.success(`V${input}Gy = ${result.toFixed(2)}%`);
    } else {
      result = calculateDx(structure, input);
      unit = 'Gy';
      toast.success(`D${input}% = ${result.toFixed(2)} Gy`);
    }

    const calculation: CustomCalculation = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      structureName: selectedStructure,
      type: calculationType,
      input,
      result,
      unit
    };

    setHistory(prev => [calculation, ...prev]);
    setInputValue('');
  };

  const clearHistory = () => {
    setHistory([]);
    toast.success('Historique effacé');
  };

  const deleteCalculation = (id: string) => {
    setHistory(prev => prev.filter(calc => calc.id !== id));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          <CardTitle>Calculateur de dose personnalisé</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Calculateur */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Structure</Label>
            <Select value={selectedStructure} onValueChange={setSelectedStructure}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {structures.map(s => (
                  <SelectItem key={s.name} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Type de calcul</Label>
            <Select value={calculationType} onValueChange={(val) => setCalculationType(val as 'Vx' | 'Dx')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Vx">Vx (Volume à dose X)</SelectItem>
                <SelectItem value="Dx">Dx (Dose à volume X%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{calculationType === 'Vx' ? 'Dose (Gy)' : 'Volume (%)'}</Label>
            <Input
              type="number"
              step="0.1"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={calculationType === 'Vx' ? 'Ex: 20' : 'Ex: 95'}
            />
          </div>

          <div className="flex items-end">
            <Button onClick={handleCalculate} className="w-full">
              Calculer
            </Button>
          </div>
        </div>

        {/* Historique */}
        {history.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Historique des calculs</h3>
              <Button variant="outline" size="sm" onClick={clearHistory}>
                <Trash2 className="w-4 h-4 mr-2" />
                Effacer
              </Button>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Structure</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Entrée</TableHead>
                    <TableHead>Résultat</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((calc) => (
                    <TableRow key={calc.id}>
                      <TableCell className="font-medium">{calc.structureName}</TableCell>
                      <TableCell>
                        {calc.type === 'Vx' ? 'Volume' : 'Dose'}
                      </TableCell>
                      <TableCell>
                        {calc.type === 'Vx' ? `${calc.input} Gy` : `${calc.input}%`}
                      </TableCell>
                      <TableCell className="font-semibold text-primary">
                        {calc.result.toFixed(2)} {calc.unit}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteCalculation(calc.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
