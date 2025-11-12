import { useState } from 'react';
import { Structure } from '@/types/dvh';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { calculateDx, calculateVx } from '@/utils/planQualityMetrics';
import { Calculator, Trash2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface UnifiedMetricsCalculatorProps {
  structures: Structure[];
  selectedStructures: string[];
}

interface CalculationResult {
  id: string;
  timestamp: number;
  structureName: string;
  type: 'Vx' | 'Dx' | 'VxAbsolute';
  input: number;
  result: number;
  unit: string;
  volumeAbsolute?: number;
}

export default function UnifiedMetricsCalculator({ structures, selectedStructures }: UnifiedMetricsCalculatorProps) {
  const [selectedStructure, setSelectedStructure] = useState<string>('');
  const [calculationType, setCalculationType] = useState<'Vx' | 'Dx' | 'VxAbsolute'>('Vx');
  const [inputValue, setInputValue] = useState<string>('');
  const [history, setHistory] = useState<CalculationResult[]>([]);

  // Filtrer pour afficher seulement les structures sélectionnées dans le graphique
  const availableStructures = structures.filter(s => 
    selectedStructures.length === 0 || selectedStructures.includes(s.name)
  );

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
    let volumeAbsolute: number | undefined;

    if (calculationType === 'Vx') {
      // Volume en % recevant une dose ≥ X Gy
      result = calculateVx(structure, input);
      unit = '%';
      toast.success(`V${input}Gy = ${result.toFixed(2)}%`);
    } else if (calculationType === 'Dx') {
      // Dose reçue par X% du volume
      result = calculateDx(structure, input);
      unit = 'Gy';
      toast.success(`D${input}% = ${result.toFixed(2)} Gy`);
    } else {
      // Volume absolu (cc) recevant une dose ≥ X Gy
      result = calculateVx(structure, input);
      volumeAbsolute = structure.totalVolume ? (result / 100) * structure.totalVolume : 0;
      unit = '%';
      toast.success(`V${input}Gy = ${volumeAbsolute.toFixed(2)} cc (${result.toFixed(2)}%)`);
    }

    const calculation: CalculationResult = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      structureName: selectedStructure,
      type: calculationType,
      input,
      result,
      unit,
      volumeAbsolute
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
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          <CardTitle>Calculateur de Métriques DVH</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={calculationType} onValueChange={(v) => setCalculationType(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="Vx">
              <TrendingUp className="w-4 h-4 mr-2" />
              Vx (%)
            </TabsTrigger>
            <TabsTrigger value="VxAbsolute">
              <Calculator className="w-4 h-4 mr-2" />
              Vx (cc)
            </TabsTrigger>
            <TabsTrigger value="Dx">
              <TrendingUp className="w-4 h-4 mr-2" />
              Dx
            </TabsTrigger>
          </TabsList>

          <TabsContent value="Vx" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Calcule le pourcentage de volume (%) recevant une dose ≥ à une valeur spécifiée
            </p>
          </TabsContent>

          <TabsContent value="VxAbsolute" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Calcule le volume absolu (cc) recevant une dose ≥ à une valeur spécifiée
            </p>
          </TabsContent>

          <TabsContent value="Dx" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Calcule la dose (Gy) reçue par un pourcentage de volume spécifié
            </p>
          </TabsContent>
        </Tabs>

        {/* Calculateur */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Structure</Label>
            <Select value={selectedStructure} onValueChange={setSelectedStructure}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {availableStructures.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Aucune structure sélectionnée dans le graphique
                  </div>
                ) : (
                  availableStructures.map(s => (
                    <SelectItem key={s.name} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>
              {calculationType === 'Dx' ? 'Volume (%)' : 'Dose (Gy)'}
            </Label>
            <Input
              type="number"
              step="0.1"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={calculationType === 'Dx' ? 'Ex: 95' : 'Ex: 20'}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCalculate();
                }
              }}
            />
          </div>

          <div className="flex items-end">
            <Button 
              onClick={handleCalculate} 
              className="w-full"
              disabled={!selectedStructure || !inputValue}
            >
              Calculer
            </Button>
          </div>
        </div>

        {/* Historique */}
        {history.length > 0 && (
          <div className="space-y-3 mt-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Résultats</h3>
              <Button variant="outline" size="sm" onClick={clearHistory}>
                <Trash2 className="w-4 h-4 mr-2" />
                Effacer tout
              </Button>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Structure</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Paramètre</TableHead>
                    <TableHead>Résultat</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((calc) => (
                    <TableRow key={calc.id}>
                      <TableCell className="font-medium">{calc.structureName}</TableCell>
                      <TableCell>
                        {calc.type === 'Vx' ? 'Volume (%)' : 
                         calc.type === 'VxAbsolute' ? 'Volume (cc)' : 
                         'Dose'}
                      </TableCell>
                      <TableCell>
                        {calc.type === 'Dx' ? `${calc.input}%` : `${calc.input} Gy`}
                      </TableCell>
                      <TableCell className="font-semibold text-primary">
                        {calc.type === 'VxAbsolute' 
                          ? `${calc.volumeAbsolute?.toFixed(2)} cc (${calc.result.toFixed(2)}%)`
                          : `${calc.result.toFixed(2)} ${calc.unit}`
                        }
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

        {history.length === 0 && (
          <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
            <Calculator className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">Aucun calcul effectué</p>
            <p className="text-xs mt-1">
              Sélectionnez une structure et entrez une valeur pour commencer
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
