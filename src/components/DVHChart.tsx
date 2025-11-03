import { useMemo, useState, useRef } from 'react';
import { Structure } from '@/types/dvh';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { findMaxDoseAcrossStructures } from '@/utils/dvhParser';
import { Eye, Maximize2, Download, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { toast } from 'sonner';

interface DVHChartProps {
  structures: Structure[];
  selectedStructures: string[];
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

export const DVHChart = ({ structures, selectedStructures }: DVHChartProps) => {
  const [viewMode, setViewMode] = useState<'optimal' | 'full'>('optimal');
  const [zoomLevel, setZoomLevel] = useState(1);
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

    // Get all unique dose points
    const allDoses = new Set<number>();
    filteredStructures.forEach(structure => {
      structure.relativeVolume.forEach(point => {
        allDoses.add(parseFloat(point.dose.toFixed(2)));
      });
    });

    const sortedDoses = Array.from(allDoses).sort((a, b) => a - b);

    // Create chart data
    return sortedDoses.map(dose => {
      const dataPoint: any = { dose };
      
      filteredStructures.forEach(structure => {
        // Find the volume for this dose (interpolate if needed)
        const point = structure.relativeVolume.find(p => 
          Math.abs(p.dose - dose) < 0.01
        );
        
        if (point) {
          dataPoint[structure.name] = point.volume;
        } else {
          // Linear interpolation
          const before = structure.relativeVolume
            .filter(p => p.dose < dose)
            .sort((a, b) => b.dose - a.dose)[0];
          const after = structure.relativeVolume
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
  }, [structures, selectedStructures]);

  const selectedFilteredStructures = useMemo(() => {
    return structures.filter(s => selectedStructures.includes(s.name));
  }, [structures, selectedStructures]);

  if (selectedStructures.length === 0) {
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
          
          <div className="flex gap-2 flex-wrap">
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
                domain={xDomain}
                label={{ value: 'Dose (Gy)', position: 'insideBottom', offset: -5 }}
                className="text-sm"
              />
              <YAxis 
                label={{ value: 'Volume (%)', angle: -90, position: 'insideLeft' }}
                className="text-sm"
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
