import { useMemo, useState, useRef } from 'react';
import { Structure } from '@/types/dvh';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { findMaxDoseAcrossStructures } from '@/utils/dvhParser';
import { Eye, Maximize2, Download, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { toast } from 'sonner';
import { DVHStructureSelector } from './DVHStructureSelector';

interface DVHChartProps {
  structures: Structure[];
  selectedStructures: string[];
  onStructureToggle?: (structureName: string) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
}

const getColorForStructure = (structure: Structure, index: number): string => {
  const ptvColors = ['#EF4444', '#F59E0B', '#DC2626', '#FB923C', '#EA580C'];
  const oarColors = ['#3B82F6', '#10B981', '#14B8A6', '#06B6D4', '#8B5CF6'];
  const otherColors = ['#64748B', '#94A3B8', '#475569', '#CBD5E1'];

  if (structure.category === 'PTV') {
    return ptvColors[index % ptvColors.length];
  } else if (structure.category === 'OAR') {
    return oarColors[index % oarColors.length];
  } else {
    return otherColors[index % otherColors.length];
  }
};

type DVHType = 'cumulative-relative' | 'differential-relative' | 'cumulative-absolute' | 'differential-absolute';

// Helper to calculate differential from cumulative DVH
const calculateDifferentialDVH = (cumulativePoints: { dose: number; volume: number }[]): { dose: number; volume: number }[] => {
  if (cumulativePoints.length === 0) return [];
  
  const differential: { dose: number; volume: number }[] = [];
  const sortedPoints = [...cumulativePoints].sort((a, b) => a.dose - b.dose);
  
  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const currentPoint = sortedPoints[i];
    const nextPoint = sortedPoints[i + 1];
    
    // Le volume différentiel est la différence de volume divisée par la différence de dose
    const volumeDiff = Math.abs(nextPoint.volume - currentPoint.volume);
    const doseDiff = nextPoint.dose - currentPoint.dose;
    
    if (doseDiff > 0) {
      differential.push({
        dose: currentPoint.dose,
        volume: volumeDiff / doseDiff // dV/dD
      });
    }
  }
  
  return differential;
};
export const DVHChart = ({ 
  structures, 
  selectedStructures, 
  onStructureToggle,
  onSelectAll,
  onDeselectAll 
}: DVHChartProps) => {
  const [viewMode, setViewMode] = useState<'optimal' | 'full'>('optimal');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [dvhType, setDvhType] = useState<DVHType>('cumulative-relative');
  const chartRef = useRef<HTMLDivElement>(null);

  const handleExportPNG = () => {
    toast.info('Exportation PNG - Utilisez le clic droit > Enregistrer l\'image');
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.2, 0.5));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  // Calculer la dose maximale globale
  const maxDoseGlobal = useMemo(() => {
    return findMaxDoseAcrossStructures(structures);
  }, [structures]);

  // Domaine X selon le mode de vue
  const xDomain: [number, number] | undefined = useMemo(() => {
    if (viewMode === 'full' || maxDoseGlobal === 0) {
      return undefined;
    }
    // Vue optimale: 0 à 120% de la dose maximale
    return [0, Math.ceil(maxDoseGlobal * 1.2)];
  }, [viewMode, maxDoseGlobal]);

  const prepareChartData = useMemo(() => {
    const filteredStructures = structures.filter(s => 
      selectedStructures.includes(s.name)
    );

    if (filteredStructures.length === 0) return [];

    const isDifferential = dvhType.includes('differential');
    const isAbsolute = dvhType.includes('absolute');

    // Get all unique dose points — choose source matching the requested mode
    const allDoses = new Set<number>();
    filteredStructures.forEach(structure => {
      let doseSource: { dose: number; volume: number }[] | undefined;

      if (isDifferential) {
        const rawDiff = isAbsolute
          ? structure.differentialAbsoluteVolume
          : structure.differentialRelativeVolume;
        if (rawDiff && rawDiff.length > 0) {
          doseSource = rawDiff;
        }
      }

      if (!doseSource || doseSource.length === 0) {
        doseSource = isAbsolute && structure.absoluteVolume && structure.absoluteVolume.length > 0
          ? structure.absoluteVolume
          : structure.relativeVolume;
      }

      doseSource.forEach(point => {
        allDoses.add(parseFloat(point.dose.toFixed(2)));
      });
    });

    const sortedDoses = Array.from(allDoses).sort((a, b) => a - b);

    // Create chart data
    return sortedDoses.map(dose => {
      const dataPoint: any = { dose };
      
      filteredStructures.forEach(structure => {
        // 🔥 Sélection de la source selon le mode demandé
        let dataSource: { dose: number; volume: number }[];

        if (isDifferential) {
          // Préférer les données différentielles BRUTES préservées du DICOM
          const rawDiff = isAbsolute
            ? structure.differentialAbsoluteVolume
            : structure.differentialRelativeVolume;

          if (rawDiff && rawDiff.length > 0) {
            dataSource = rawDiff;
          } else {
            // Fallback: dérivation numérique du cumulatif (cas DVH Parser CSV ou DICOM nativement CUMULATIVE)
            const cumulativeSource = isAbsolute && structure.absoluteVolume && structure.absoluteVolume.length > 0
              ? structure.absoluteVolume
              : structure.relativeVolume;
            dataSource = calculateDifferentialDVH(cumulativeSource);
          }
        } else {
          dataSource = isAbsolute && structure.absoluteVolume && structure.absoluteVolume.length > 0
            ? structure.absoluteVolume
            : structure.relativeVolume;
        }

        // Find the volume for this dose (interpolate if needed)
        const point = dataSource.find(p => 
          Math.abs(p.dose - dose) < 0.01
        );
        
        if (point) {
          dataPoint[structure.name] = point.volume;
        } else {
          // Linear interpolation
          const before = dataSource
            .filter(p => p.dose < dose)
            .sort((a, b) => b.dose - a.dose)[0];
          const after = dataSource
            .filter(p => p.dose > dose)
            .sort((a, b) => a.dose - b.dose)[0];
          
          if (before && after) {
            const ratio = (dose - before.dose) / (after.dose - before.dose);
            dataPoint[structure.name] = before.volume + ratio * (after.volume - before.volume);
          }
        }
      });
      
      return dataPoint;
    });
  }, [structures, selectedStructures, dvhType]);

  const selectedFilteredStructures = useMemo(() => {
    return structures.filter(s => selectedStructures.includes(s.name));
  }, [structures, selectedStructures]);

  // Show selector even when no structures selected
  const showEmptyState = selectedStructures.length === 0 && !onStructureToggle;
  
  if (showEmptyState) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">
            Sélectionnez des structures pour afficher les courbes DVH
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle>Courbes Dose-Volume-Histogramme (DVH)</CardTitle>
            {maxDoseGlobal > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Dose maximale globale: {maxDoseGlobal.toFixed(2)} Gy
              </p>
            )}
          </div>
          
          <div className="flex gap-2 flex-wrap items-center">
            {/* Structure Selector - integrated directly in the chart */}
            {onStructureToggle && onSelectAll && onDeselectAll && (
              <DVHStructureSelector
                structures={structures}
                selectedStructures={selectedStructures}
                onStructureToggle={onStructureToggle}
                onSelectAll={onSelectAll}
                onDeselectAll={onDeselectAll}
              />
            )}
            <Select value={dvhType} onValueChange={(val) => setDvhType(val as DVHType)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cumulative-relative">DVH Cumulatif Relatif</SelectItem>
                <SelectItem value="differential-relative">DVH Différentiel Relatif</SelectItem>
                <SelectItem value="cumulative-absolute">DVH Cumulatif Absolu</SelectItem>
                <SelectItem value="differential-absolute">DVH Différentiel Absolu</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetZoom}
              >
                <Maximize className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
            <Button
              variant={viewMode === 'optimal' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('optimal')}
            >
              <Eye className="w-4 h-4 mr-2" />
              Vue optimale
            </Button>
            <Button
              variant={viewMode === 'full' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('full')}
            >
              <Maximize2 className="w-4 h-4 mr-2" />
              Vue complète
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPNG}
            >
              <Download className="w-4 h-4 mr-2" />
              PNG
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div 
          ref={chartRef} 
          style={{ 
            transform: `scale(${zoomLevel})`, 
            transformOrigin: 'top left', 
            transition: 'transform 0.3s' 
          }}
        >
          <ResponsiveContainer width="100%" height={500}>
            <LineChart data={prepareChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="dose"
                domain={xDomain ? xDomain : [0, 'auto']}
                label={{ value: 'Dose (Gy)', position: 'insideBottom', offset: -5 }}
                type="number"
                tickCount={Math.ceil((xDomain ? xDomain[1] : maxDoseGlobal * 1.2) / 5) + 1}
                interval={0}
                ticks={(() => {
                  const max = xDomain ? xDomain[1] : Math.ceil(maxDoseGlobal * 1.2);
                  const ticks = [];
                  for (let i = 0; i <= max; i += 5) {
                    ticks.push(i);
                  }
                  return ticks;
                })()}
              />
              <YAxis 
                label={{ 
                  value: dvhType === 'cumulative-absolute' 
                    ? 'Volume (cc)' 
                    : dvhType === 'differential-absolute'
                    ? 'Volume différentiel (cc)'
                    : dvhType === 'differential-relative'
                    ? '% Normalized'
                    : 'Volume (%)', 
                  angle: -90, 
                  position: 'insideLeft' 
                }}
                type="number"
                domain={dvhType === 'cumulative-relative' ? [0, 100] : [0, 'auto']}
                tickCount={dvhType === 'cumulative-relative' ? 21 : undefined}
                interval={0}
                ticks={(() => {
                  if (dvhType === 'cumulative-relative') {
                    const ticks = [];
                    for (let i = 0; i <= 100; i += 5) {
                      ticks.push(i);
                    }
                    return ticks;
                  }
                  return undefined;
                })()}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
              {selectedFilteredStructures.map((structure, index) => {
                const categoryIndex = selectedFilteredStructures
                  .filter(s => s.category === structure.category)
                  .findIndex(s => s.name === structure.name);
                
                return (
                  <Line
                    key={structure.name}
                    type="monotone"
                    dataKey={structure.name}
                    stroke={getColorForStructure(structure, categoryIndex)}
                    strokeWidth={structure.category === 'PTV' ? 3 : 2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
