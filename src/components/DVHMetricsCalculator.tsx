import { useState } from 'react';
import { Structure } from '@/types/dvh';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calculator, Trash2 } from 'lucide-react';

interface DVHMetricsCalculatorProps {
  structures: Structure[];
}

interface MetricResult {
  id: string;
  structureName: string;
  dose: number;
  volumePercent: number;
  volumeAbsolute: number;
}

export default function DVHMetricsCalculator({ structures }: DVHMetricsCalculatorProps) {
  const [selectedStructure, setSelectedStructure] = useState('');
  const [targetDose, setTargetDose] = useState('');
  const [results, setResults] = useState<MetricResult[]>([]);

  const calculateVxAbsolute = () => {
    if (!selectedStructure || !targetDose) return;

    const structure = structures.find(s => s.name === selectedStructure);
    if (!structure) return;

    const dose = parseFloat(targetDose);
    if (isNaN(dose)) return;

    // Utiliser les points du DVH relatif cumulatif (décroissant)
    let volumePercent = 0;
    const sortedPoints = [...structure.relativeVolume].sort((a, b) => a.dose - b.dose);
    
    // Trouver le volume qui reçoit >= dose (DVH cumulatif)
    let found = false;
    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const p1 = sortedPoints[i];
      const p2 = sortedPoints[i + 1];
      
      if (p1.dose <= dose && p2.dose >= dose) {
        // Interpolation linéaire entre p1 et p2
        const ratio = (dose - p1.dose) / (p2.dose - p1.dose);
        volumePercent = p1.volume - ratio * (p1.volume - p2.volume);
        found = true;
        break;
      }
    }
    
    // Si la dose est inférieure à la dose minimale
    if (!found && dose < sortedPoints[0].dose) {
      volumePercent = sortedPoints[0].volume;
    }
    
    // Si la dose est supérieure à la dose maximale
    if (!found && dose > sortedPoints[sortedPoints.length - 1].dose) {
      volumePercent = sortedPoints[sortedPoints.length - 1].volume;
    }

    // Convertir en volume absolu (cc)
    const volumeAbsolute = structure.totalVolume 
      ? (volumePercent / 100) * structure.totalVolume 
      : 0;

    const result: MetricResult = {
      id: `${Date.now()}-${Math.random()}`,
      structureName: structure.name,
      dose,
      volumePercent,
      volumeAbsolute,
    };

    setResults([result, ...results]);
    setTargetDose('');
  };

  const removeResult = (id: string) => {
    setResults(results.filter(r => r.id !== id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Calculateur de Métriques DVH - Volume Absolu
        </CardTitle>
        <CardDescription>
          Calculez le volume (en cc) d'une structure qui reçoit une dose ≥ à une valeur spécifiée
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <Label htmlFor="structure">Structure</Label>
            <Select value={selectedStructure} onValueChange={setSelectedStructure}>
              <SelectTrigger id="structure">
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {structures.map(structure => (
                  <SelectItem key={structure.name} value={structure.name}>
                    {structure.name}
                    <Badge variant="outline" className="ml-2 text-xs">
                      {structure.category}
                    </Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-1">
            <Label htmlFor="dose">Dose seuil (Gy)</Label>
            <Input
              id="dose"
              type="number"
              step="0.1"
              value={targetDose}
              onChange={(e) => setTargetDose(e.target.value)}
              placeholder="Ex: 45"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  calculateVxAbsolute();
                }
              }}
            />
          </div>

          <div className="flex items-end">
            <Button 
              onClick={calculateVxAbsolute}
              disabled={!selectedStructure || !targetDose}
              className="w-full"
            >
              <Calculator className="h-4 w-4 mr-2" />
              Calculer
            </Button>
          </div>
        </div>

        {results.length > 0 && (
          <div className="space-y-2 mt-6">
            <h4 className="font-semibold text-sm text-muted-foreground">Résultats</h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">Structure</th>
                    <th className="text-left p-3 text-sm font-medium">Dose (Gy)</th>
                    <th className="text-left p-3 text-sm font-medium">Volume (%)</th>
                    <th className="text-left p-3 text-sm font-medium">Volume (cc)</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr key={result.id} className="border-t hover:bg-muted/50">
                      <td className="p-3 font-medium">{result.structureName}</td>
                      <td className="p-3 font-mono">≥ {result.dose.toFixed(1)}</td>
                      <td className="p-3 font-mono">{result.volumePercent.toFixed(2)}%</td>
                      <td className="p-3 font-mono text-primary font-semibold">
                        {result.volumeAbsolute.toFixed(2)} cc
                      </td>
                      <td className="p-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeResult(result.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {results.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">
              Sélectionnez une structure et entrez une dose pour calculer le volume absolu
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
