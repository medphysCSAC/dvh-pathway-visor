import { useState, useMemo } from 'react';
import { Structure, DVHPoint } from '@/types/dvh';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bug, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Info, Database } from 'lucide-react';

interface DVHComparisonDebugProps {
  dvhParserStructures: Structure[] | null;
  dicomRTStructures: Structure[] | null;
}

interface MetricComparison {
  name: string;
  dvhValue: number | null;
  dicomValue: number | null;
  difference: number | null;
  percentDiff: number | null;
  status: 'match' | 'close' | 'divergent' | 'missing';
}

interface StructureComparison {
  structureName: string;
  dvhStructure: Structure | null;
  dicomStructure: Structure | null;
  metrics: MetricComparison[];
}

// Calcul Dmean via intégration trapézoïdale (identique pour les deux sources)
const calculateDmean = (points: DVHPoint[]): number => {
  if (points.length < 2) return 0;
  
  const sorted = [...points].sort((a, b) => a.dose - b.dose);
  let dmean = 0;
  
  for (let i = 0; i < sorted.length - 1; i++) {
    const dose1 = sorted[i].dose;
    const dose2 = sorted[i + 1].dose;
    const vol1 = sorted[i].volume;
    const vol2 = sorted[i + 1].volume;
    dmean += ((dose1 + dose2) / 2) * Math.abs(vol2 - vol1);
  }
  
  return dmean / 100; // volumes en %
};

// Calcul Vx (volume recevant au moins dose X)
const calculateVx = (points: DVHPoint[], targetDose: number): number => {
  if (points.length === 0) return 0;
  
  const sorted = [...points].sort((a, b) => a.dose - b.dose);
  
  if (targetDose <= sorted[0].dose) return sorted[0].volume;
  if (targetDose >= sorted[sorted.length - 1].dose) return sorted[sorted.length - 1].volume;
  
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].dose <= targetDose && sorted[i + 1].dose >= targetDose) {
      const t = (targetDose - sorted[i].dose) / (sorted[i + 1].dose - sorted[i].dose);
      return sorted[i].volume + t * (sorted[i + 1].volume - sorted[i].volume);
    }
  }
  
  return sorted[sorted.length - 1].volume;
};

// Calcul Dx (dose reçue par x% du volume)
const calculateDx = (points: DVHPoint[], volumePercent: number): number => {
  if (points.length === 0) return 0;
  
  // DVH décroissant: trier par volume décroissant
  const sorted = [...points].sort((a, b) => b.volume - a.volume);
  
  if (volumePercent >= sorted[0].volume) return sorted[0].dose;
  if (volumePercent <= sorted[sorted.length - 1].volume) return sorted[sorted.length - 1].dose;
  
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].volume >= volumePercent && sorted[i + 1].volume <= volumePercent) {
      const t = (volumePercent - sorted[i].volume) / (sorted[i + 1].volume - sorted[i].volume);
      return sorted[i].dose + t * (sorted[i + 1].dose - sorted[i].dose);
    }
  }
  
  return sorted[sorted.length - 1].dose;
};

const DVHComparisonDebug = ({ dvhParserStructures, dicomRTStructures }: DVHComparisonDebugProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStructure, setSelectedStructure] = useState<string>('');
  const [showRawData, setShowRawData] = useState(false);

  // Trouver les structures communes
  const structureComparisons = useMemo((): StructureComparison[] => {
    if (!dvhParserStructures && !dicomRTStructures) return [];

    const allNames = new Set<string>();
    dvhParserStructures?.forEach(s => allNames.add(s.name.toLowerCase()));
    dicomRTStructures?.forEach(s => allNames.add(s.name.toLowerCase()));

    const comparisons: StructureComparison[] = [];

    allNames.forEach(nameLower => {
      const dvhStruct = dvhParserStructures?.find(s => s.name.toLowerCase() === nameLower) || null;
      const dicomStruct = dicomRTStructures?.find(s => s.name.toLowerCase() === nameLower) || null;

      const metrics: MetricComparison[] = [];

      // Dmax
      const dvhDmax = dvhStruct?.relativeVolume?.length 
        ? Math.max(...dvhStruct.relativeVolume.map(p => p.dose)) 
        : null;
      const dicomDmax = dicomStruct?.relativeVolume?.length 
        ? Math.max(...dicomStruct.relativeVolume.map(p => p.dose)) 
        : null;
      
      metrics.push(createMetricComparison('Dmax (Gy)', dvhDmax, dicomDmax));

      // Dmean
      const dvhDmean = dvhStruct?.relativeVolume?.length 
        ? calculateDmean(dvhStruct.relativeVolume) 
        : null;
      const dicomDmean = dicomStruct?.relativeVolume?.length 
        ? calculateDmean(dicomStruct.relativeVolume) 
        : null;
      
      metrics.push(createMetricComparison('Dmean (Gy)', dvhDmean, dicomDmean));

      // D95
      const dvhD95 = dvhStruct?.relativeVolume?.length 
        ? calculateDx(dvhStruct.relativeVolume, 95) 
        : null;
      const dicomD95 = dicomStruct?.relativeVolume?.length 
        ? calculateDx(dicomStruct.relativeVolume, 95) 
        : null;
      
      metrics.push(createMetricComparison('D95% (Gy)', dvhD95, dicomD95));

      // V20Gy
      const dvhV20 = dvhStruct?.relativeVolume?.length 
        ? calculateVx(dvhStruct.relativeVolume, 20) 
        : null;
      const dicomV20 = dicomStruct?.relativeVolume?.length 
        ? calculateVx(dicomStruct.relativeVolume, 20) 
        : null;
      
      metrics.push(createMetricComparison('V20Gy (%)', dvhV20, dicomV20));

      // V13Gy (pour le coeur comme dans ton exemple)
      const dvhV13 = dvhStruct?.relativeVolume?.length 
        ? calculateVx(dvhStruct.relativeVolume, 13) 
        : null;
      const dicomV13 = dicomStruct?.relativeVolume?.length 
        ? calculateVx(dicomStruct.relativeVolume, 13) 
        : null;
      
      metrics.push(createMetricComparison('V13Gy (%)', dvhV13, dicomV13));

      // Volume total
      metrics.push(createMetricComparison(
        'Volume Total (cc)', 
        dvhStruct?.totalVolume || null, 
        dicomStruct?.totalVolume || null
      ));

      // Nombre de points DVH
      metrics.push(createMetricComparison(
        'Nb points DVH', 
        dvhStruct?.relativeVolume?.length || null, 
        dicomStruct?.relativeVolume?.length || null
      ));

      // Dose min (premier point)
      const dvhDoseMin = dvhStruct?.relativeVolume?.length 
        ? Math.min(...dvhStruct.relativeVolume.map(p => p.dose)) 
        : null;
      const dicomDoseMin = dicomStruct?.relativeVolume?.length 
        ? Math.min(...dicomStruct.relativeVolume.map(p => p.dose)) 
        : null;
      
      metrics.push(createMetricComparison('Dose min (Gy)', dvhDoseMin, dicomDoseMin));

      // Volume @ dose min
      const dvhVolAtMin = dvhStruct?.relativeVolume?.length 
        ? dvhStruct.relativeVolume.find(p => p.dose === dvhDoseMin)?.volume 
        : null;
      const dicomVolAtMin = dicomStruct?.relativeVolume?.length 
        ? dicomStruct.relativeVolume.find(p => p.dose === dicomDoseMin)?.volume 
        : null;
      
      metrics.push(createMetricComparison('Vol @ Dose min (%)', dvhVolAtMin || null, dicomVolAtMin || null));

      comparisons.push({
        structureName: dvhStruct?.name || dicomStruct?.name || nameLower,
        dvhStructure: dvhStruct,
        dicomStructure: dicomStruct,
        metrics
      });
    });

    return comparisons.sort((a, b) => a.structureName.localeCompare(b.structureName));
  }, [dvhParserStructures, dicomRTStructures]);

  const selectedComparison = useMemo(() => {
    return structureComparisons.find(c => c.structureName === selectedStructure);
  }, [structureComparisons, selectedStructure]);

  // Statistiques globales
  const stats = useMemo(() => {
    let totalMetrics = 0;
    let matches = 0;
    let close = 0;
    let divergent = 0;
    let missing = 0;

    structureComparisons.forEach(comp => {
      comp.metrics.forEach(m => {
        totalMetrics++;
        if (m.status === 'match') matches++;
        else if (m.status === 'close') close++;
        else if (m.status === 'divergent') divergent++;
        else missing++;
      });
    });

    return { totalMetrics, matches, close, divergent, missing };
  }, [structureComparisons]);

  if (!dvhParserStructures && !dicomRTStructures) {
    return null;
  }

  return (
    <Card className="border-dashed border-2 border-amber-500/50 bg-amber-500/5">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bug className="w-5 h-5 text-amber-500" />
                <span>Debug: Comparaison DVH Parser vs DICOM RT</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex gap-2 text-sm">
                  <Badge variant="outline" className="bg-green-500/10 text-green-600">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {stats.matches} identiques
                  </Badge>
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">
                    <Info className="w-3 h-3 mr-1" />
                    {stats.close} proches
                  </Badge>
                  <Badge variant="outline" className="bg-red-500/10 text-red-600">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {stats.divergent} divergents
                  </Badge>
                </div>
                {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Sélecteur de structure */}
            <div className="flex items-center gap-4">
              <Select value={selectedStructure} onValueChange={setSelectedStructure}>
                <SelectTrigger className="w-64 bg-background">
                  <SelectValue placeholder="Sélectionner une structure..." />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {structureComparisons.map(comp => (
                    <SelectItem key={comp.structureName} value={comp.structureName}>
                      {comp.structureName}
                      {!comp.dvhStructure && <span className="text-muted-foreground ml-2">(DICOM only)</span>}
                      {!comp.dicomStructure && <span className="text-muted-foreground ml-2">(DVH only)</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowRawData(!showRawData)}
                className="gap-2"
              >
                <Database className="w-4 h-4" />
                {showRawData ? 'Masquer' : 'Afficher'} données brutes
              </Button>
            </div>

            {/* Tableau comparatif */}
            {selectedComparison && (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">Métrique</TableHead>
                      <TableHead className="text-right">DVH Parser</TableHead>
                      <TableHead className="text-right">DICOM RT</TableHead>
                      <TableHead className="text-right">Différence</TableHead>
                      <TableHead className="text-right">% Écart</TableHead>
                      <TableHead className="w-24">Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedComparison.metrics.map((metric, idx) => (
                      <TableRow key={idx} className={getRowClassName(metric.status)}>
                        <TableCell className="font-medium">{metric.name}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatValue(metric.dvhValue)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatValue(metric.dicomValue)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {metric.difference !== null ? formatValue(metric.difference, true) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {metric.percentDiff !== null ? `${metric.percentDiff.toFixed(2)}%` : '-'}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={metric.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Données brutes */}
                {showRawData && (
                  <div className="grid grid-cols-2 gap-4">
                    {/* DVH Parser points */}
                    <div className="border rounded-lg p-3">
                      <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500" />
                        DVH Parser ({selectedComparison.dvhStructure?.relativeVolume?.length || 0} points)
                      </h4>
                      <ScrollArea className="h-48">
                        <div className="font-mono text-xs space-y-0.5">
                          {selectedComparison.dvhStructure?.relativeVolume?.slice(0, 50).map((p, i) => (
                            <div key={i} className="flex justify-between text-muted-foreground">
                              <span>{p.dose.toFixed(4)} Gy</span>
                              <span>{p.volume.toFixed(4)} %</span>
                            </div>
                          ))}
                          {(selectedComparison.dvhStructure?.relativeVolume?.length || 0) > 50 && (
                            <div className="text-center text-muted-foreground pt-2">
                              ... et {(selectedComparison.dvhStructure?.relativeVolume?.length || 0) - 50} points de plus
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>

                    {/* DICOM RT points */}
                    <div className="border rounded-lg p-3">
                      <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-orange-500" />
                        DICOM RT ({selectedComparison.dicomStructure?.relativeVolume?.length || 0} points)
                      </h4>
                      <ScrollArea className="h-48">
                        <div className="font-mono text-xs space-y-0.5">
                          {selectedComparison.dicomStructure?.relativeVolume?.slice(0, 50).map((p, i) => (
                            <div key={i} className="flex justify-between text-muted-foreground">
                              <span>{p.dose.toFixed(4)} Gy</span>
                              <span>{p.volume.toFixed(4)} %</span>
                            </div>
                          ))}
                          {(selectedComparison.dicomStructure?.relativeVolume?.length || 0) > 50 && (
                            <div className="text-center text-muted-foreground pt-2">
                              ... et {(selectedComparison.dicomStructure?.relativeVolume?.length || 0) - 50} points de plus
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tableau récapitulatif de toutes les structures */}
            {!selectedStructure && (
              <div className="space-y-2">
                <h4 className="font-semibold">Résumé par structure</h4>
                <ScrollArea className="h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Structure</TableHead>
                        <TableHead className="text-center">DVH</TableHead>
                        <TableHead className="text-center">DICOM</TableHead>
                        <TableHead className="text-right">Dmean Δ</TableHead>
                        <TableHead className="text-right">Dmax Δ</TableHead>
                        <TableHead className="text-right">Vol Δ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {structureComparisons.map(comp => {
                        const dmean = comp.metrics.find(m => m.name.includes('Dmean'));
                        const dmax = comp.metrics.find(m => m.name.includes('Dmax'));
                        const vol = comp.metrics.find(m => m.name.includes('Volume Total'));
                        
                        return (
                          <TableRow 
                            key={comp.structureName}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedStructure(comp.structureName)}
                          >
                            <TableCell className="font-medium">{comp.structureName}</TableCell>
                            <TableCell className="text-center">
                              {comp.dvhStructure ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              {comp.dicomStructure ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {dmean?.percentDiff !== null && dmean?.percentDiff !== undefined 
                                ? <span className={getPercentColor(dmean.percentDiff)}>{dmean.percentDiff.toFixed(2)}%</span>
                                : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {dmax?.percentDiff !== null && dmax?.percentDiff !== undefined
                                ? <span className={getPercentColor(dmax.percentDiff)}>{dmax.percentDiff.toFixed(2)}%</span>
                                : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {vol?.percentDiff !== null && vol?.percentDiff !== undefined
                                ? <span className={getPercentColor(vol.percentDiff)}>{vol.percentDiff.toFixed(2)}%</span>
                                : '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

// Helpers
function createMetricComparison(name: string, dvhValue: number | null, dicomValue: number | null): MetricComparison {
  let difference: number | null = null;
  let percentDiff: number | null = null;
  let status: MetricComparison['status'] = 'missing';

  if (dvhValue !== null && dicomValue !== null) {
    difference = dicomValue - dvhValue;
    const refValue = Math.abs(dvhValue) > 0.001 ? dvhValue : dicomValue;
    percentDiff = refValue !== 0 ? (difference / Math.abs(refValue)) * 100 : 0;

    if (Math.abs(percentDiff) < 0.5) {
      status = 'match';
    } else if (Math.abs(percentDiff) < 3) {
      status = 'close';
    } else {
      status = 'divergent';
    }
  } else if (dvhValue !== null || dicomValue !== null) {
    status = 'missing';
  }

  return { name, dvhValue, dicomValue, difference, percentDiff, status };
}

function formatValue(value: number | null, showSign = false): string {
  if (value === null) return '-';
  const formatted = value.toFixed(4);
  if (showSign && value > 0) return `+${formatted}`;
  return formatted;
}

function getRowClassName(status: MetricComparison['status']): string {
  switch (status) {
    case 'match': return 'bg-green-500/5';
    case 'close': return 'bg-yellow-500/5';
    case 'divergent': return 'bg-red-500/5';
    default: return 'bg-muted/30';
  }
}

function getPercentColor(percent: number): string {
  const abs = Math.abs(percent);
  if (abs < 0.5) return 'text-green-600';
  if (abs < 3) return 'text-yellow-600';
  return 'text-red-600';
}

function StatusBadge({ status }: { status: MetricComparison['status'] }) {
  switch (status) {
    case 'match':
      return <Badge className="bg-green-500/20 text-green-600 text-xs">✓ Identique</Badge>;
    case 'close':
      return <Badge className="bg-yellow-500/20 text-yellow-600 text-xs">~ Proche</Badge>;
    case 'divergent':
      return <Badge className="bg-red-500/20 text-red-600 text-xs">✗ Divergent</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">Manquant</Badge>;
  }
}

export default DVHComparisonDebug;
