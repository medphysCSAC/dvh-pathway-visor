import { useMemo, useState, useRef } from 'react';
import { Structure } from '@/types/dvh';
import { TreatmentProtocol, StructureMapping as StructureMappingType } from '@/types/protocol';
import { findBestStructureMatch } from '@/utils/protocolValidator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';
import { findMaxDoseAcrossStructures } from '@/utils/dvhParser';
import { Eye, Maximize2, Download, ZoomIn, ZoomOut, Maximize, Target } from 'lucide-react';
import { toast } from 'sonner';
import { DVHStructureSelector } from './DVHStructureSelector';

interface ComparePlan {
  label: string;
  structures: Structure[];
}

interface DVHChartProps {
  structures: Structure[];
  selectedStructures: string[];
  onStructureToggle?: (structureName: string) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  activeProtocol?: TreatmentProtocol | null;
  structureMappings?: StructureMappingType[];
  comparePlans?: ComparePlan[];
  mainPlanLabel?: string;
}

const PLAN_STROKE_STYLES: { strokeDasharray?: string; strokeWidth: number }[] = [
  { strokeDasharray: undefined, strokeWidth: 2.5 },
  { strokeDasharray: '8 4', strokeWidth: 2 },
  { strokeDasharray: '3 3', strokeWidth: 2 },
  { strokeDasharray: '10 4 3 4', strokeWidth: 1.5 },
];

const getColorForStructureName = (
  structureName: string,
  category: 'PTV' | 'OAR' | 'OTHER',
  uniqueNames: string[]
): string => {
  const ptvColors = ['#EF4444', '#F59E0B', '#DC2626', '#FB923C', '#EA580C'];
  const oarColors = ['#3B82F6', '#10B981', '#14B8A6', '#06B6D4', '#8B5CF6'];
  const otherColors = ['#64748B', '#94A3B8', '#475569', '#CBD5E1'];
  const idx = Math.max(0, uniqueNames.indexOf(structureName));
  if (category === 'PTV') return ptvColors[idx % ptvColors.length];
  if (category === 'OAR') return oarColors[idx % oarColors.length];
  return otherColors[idx % otherColors.length];
};

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
// Interpolate volume at a given dose for a structure
const interpolateVolumeAtDose = (
  structure: Structure,
  targetDose: number,
  isAbsolute: boolean
): number | null => {
  const source = isAbsolute && structure.absoluteVolume?.length
    ? structure.absoluteVolume
    : structure.relativeVolume;
  if (!source?.length) return null;
  const sorted = [...source].sort((a, b) => a.dose - b.dose);
  const before = sorted.filter(p => p.dose <= targetDose).at(-1);
  const after = sorted.find(p => p.dose > targetDose);
  if (!before && !after) return null;
  if (!before) return after!.volume;
  if (!after) return before.volume;
  const ratio = (targetDose - before.dose) / (after.dose - before.dose);
  return before.volume + ratio * (after.volume - before.volume);
};

const getDataSource = (
  structure: Structure,
  isDifferential: boolean,
  isAbsolute: boolean
): { dose: number; volume: number }[] => {
  if (isDifferential) {
    const rawDiff = isAbsolute
      ? structure.differentialAbsoluteVolume
      : structure.differentialRelativeVolume;
    if (rawDiff?.length) return rawDiff;
    const cum = isAbsolute && structure.absoluteVolume?.length
      ? structure.absoluteVolume
      : structure.relativeVolume;
    return calculateDifferentialDVH(cum);
  }
  return isAbsolute && structure.absoluteVolume?.length
    ? structure.absoluteVolume
    : structure.relativeVolume;
};

export const DVHChart = ({ 
  structures, 
  selectedStructures, 
  onStructureToggle,
  onSelectAll,
  onDeselectAll,
  activeProtocol,
  structureMappings,
  comparePlans,
  mainPlanLabel,
}: DVHChartProps) => {
  const [viewMode, setViewMode] = useState<'optimal' | 'full'>('optimal');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [dvhType, setDvhType] = useState<DVHType>('cumulative-relative');
  const [showConstraints, setShowConstraints] = useState(true);
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
    const allPlans: { structures: Structure[]; planIndex: number }[] = [
      { structures, planIndex: 0 },
      ...(comparePlans || []).map((p, i) => ({ structures: p.structures, planIndex: i + 1 })),
    ];

    const isDifferential = dvhType.includes('differential');
    const isAbsolute = dvhType.includes('absolute');

    const allDoses = new Set<number>();
    allPlans.forEach(({ structures: planStructures }) => {
      planStructures
        .filter(s => selectedStructures.includes(s.name))
        .forEach(structure => {
          const ds = getDataSource(structure, isDifferential, isAbsolute);
          ds.forEach(p => allDoses.add(parseFloat(p.dose.toFixed(2))));
        });
    });

    if (allDoses.size === 0) return [];

    const sortedDoses = Array.from(allDoses).sort((a, b) => a - b);

    return sortedDoses.map(dose => {
      const dataPoint: any = { dose };

      allPlans.forEach(({ structures: planStructures, planIndex }) => {
        planStructures
          .filter(s => selectedStructures.includes(s.name))
          .forEach(structure => {
            const key = `${planIndex}::${structure.name}`;
            const dataSource = getDataSource(structure, isDifferential, isAbsolute);

            const point = dataSource.find(p => Math.abs(p.dose - dose) < 0.01);
            if (point) {
              dataPoint[key] = point.volume;
            } else {
              const before = dataSource
                .filter(p => p.dose < dose)
                .sort((a, b) => b.dose - a.dose)[0];
              const after = dataSource
                .filter(p => p.dose > dose)
                .sort((a, b) => a.dose - b.dose)[0];
              if (before && after) {
                const ratio = (dose - before.dose) / (after.dose - before.dose);
                dataPoint[key] = before.volume + ratio * (after.volume - before.volume);
              }
            }
          });
      });

      return dataPoint;
    });
  }, [structures, selectedStructures, dvhType, comparePlans]);

  const selectedFilteredStructures = useMemo(() => {
    return structures.filter(s => selectedStructures.includes(s.name));
  }, [structures, selectedStructures]);

  // Unique structure names across all plans (for color stability)
  const allUniqueStructureNames = useMemo(() => {
    const names = new Set<string>();
    structures.filter(s => selectedStructures.includes(s.name)).forEach(s => names.add(s.name));
    (comparePlans || []).forEach(p =>
      p.structures.filter(s => selectedStructures.includes(s.name)).forEach(s => names.add(s.name))
    );
    return Array.from(names);
  }, [structures, comparePlans, selectedStructures]);

  // Constraint overlays — only in cumulative mode, when a protocol is active
  const constraintOverlays = useMemo(() => {
    if (!activeProtocol || dvhType.includes('differential')) return [];
    const isAbsolute = dvhType.includes('absolute');

    return activeProtocol.oarConstraints
      .filter(c => c.constraintType === 'Vx' && c.target !== undefined)
      .filter(c => isAbsolute ? c.targetUnit === 'cc' : c.targetUnit !== 'cc')
      .flatMap(constraint => {
        const structure = findBestStructureMatch(
          constraint.organName, structures, structureMappings || []
        );
        if (!structure || !selectedStructures.includes(structure.name)) return [];
        const measured = interpolateVolumeAtDose(structure, constraint.target!, isAbsolute);
        if (measured === null) return [];
        const pass = measured <= constraint.value;
        const unit = constraint.targetUnit || '%';
        return [{
          dose: constraint.target!,
          volume: measured,
          label: `V${constraint.target}Gy`,
          measuredLabel: `${measured.toFixed(1)}${unit}`,
          color: pass ? '#16a34a' : '#dc2626',
          status: pass ? 'PASS' : 'FAIL',
        }];
      });
  }, [activeProtocol, structures, selectedStructures, structureMappings, dvhType]);

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
            {activeProtocol && !dvhType.includes('differential') && (
              <Button
                variant={showConstraints ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowConstraints(v => !v)}
                title={`Protocole : ${activeProtocol.name}`}
              >
                <Target className="w-4 h-4 mr-2" />
                Contraintes {showConstraints ? 'ON' : 'OFF'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {comparePlans && comparePlans.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 p-3 rounded-md bg-muted/40 border text-sm">
            <span className="font-medium text-muted-foreground">Comparaison :</span>
            <div className="flex items-center gap-2">
              <svg width="32" height="8"><line x1="0" y1="4" x2="32" y2="4" stroke="currentColor" strokeWidth="2.5" /></svg>
              <span>{mainPlanLabel || 'Plan principal'}</span>
            </div>
            {comparePlans.map((p, i) => {
              const style = PLAN_STROKE_STYLES[(i + 1) % PLAN_STROKE_STYLES.length];
              return (
                <div key={i} className="flex items-center gap-2">
                  <svg width="32" height="8">
                    <line
                      x1="0" y1="4" x2="32" y2="4"
                      stroke="currentColor"
                      strokeWidth={style.strokeWidth}
                      strokeDasharray={style.strokeDasharray}
                    />
                  </svg>
                  <span>{p.label}</span>
                </div>
              );
            })}
            <span className="text-xs text-muted-foreground ml-auto">
              Même couleur = même structure · style de trait = plan
            </span>
          </div>
        )}
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
              {/* Plan principal */}
              {selectedFilteredStructures.map((structure) => {
                const color = getColorForStructureName(structure.name, structure.category, allUniqueStructureNames);
                const style = PLAN_STROKE_STYLES[0];
                return (
                  <Line
                    key={`0::${structure.name}`}
                    type="monotone"
                    dataKey={`0::${structure.name}`}
                    name={comparePlans && comparePlans.length > 0 ? `${structure.name} — ${mainPlanLabel || 'Plan 1'}` : structure.name}
                    stroke={color}
                    strokeWidth={structure.category === 'PTV' ? Math.max(style.strokeWidth, 2.5) : style.strokeWidth}
                    strokeDasharray={style.strokeDasharray}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                );
              })}
              {/* Plans secondaires */}
              {(comparePlans || []).flatMap((plan, planIdx) =>
                plan.structures
                  .filter(s => selectedStructures.includes(s.name))
                  .map((structure) => {
                    const color = getColorForStructureName(structure.name, structure.category, allUniqueStructureNames);
                    const style = PLAN_STROKE_STYLES[(planIdx + 1) % PLAN_STROKE_STYLES.length];
                    return (
                      <Line
                        key={`${planIdx + 1}::${structure.name}`}
                        type="monotone"
                        dataKey={`${planIdx + 1}::${structure.name}`}
                        name={`${structure.name} — ${plan.label}`}
                        stroke={color}
                        strokeWidth={style.strokeWidth}
                        strokeDasharray={style.strokeDasharray}
                        dot={false}
                        activeDot={{ r: 4 }}
                        connectNulls
                      />
                    );
                  })
              )}
              {showConstraints && constraintOverlays.flatMap((o, i) => [
                <ReferenceLine
                  key={`rl-${i}`}
                  x={o.dose}
                  stroke={o.color}
                  strokeDasharray="5 3"
                  strokeWidth={1.5}
                  label={{ value: o.label, position: 'insideTopRight', fontSize: 10, fill: o.color }}
                />,
                <ReferenceDot
                  key={`rd-${i}`}
                  x={o.dose}
                  y={o.volume}
                  r={6}
                  fill={o.color}
                  stroke="white"
                  strokeWidth={2}
                  label={{ value: o.measuredLabel, position: 'right', fontSize: 10, fill: o.color }}
                />
              ])}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
