import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Structure } from '@/types/dvh';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DVHChartProps {
  structures: Structure[];
  selectedStructures: string[];
}

const COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'
];

export const DVHChart = ({ structures, selectedStructures }: DVHChartProps) => {
  // Prepare data for chart
  const prepareChartData = () => {
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
  };

  const chartData = prepareChartData();

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
        <CardTitle>Courbes Dose-Volume Histogram</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="dose" 
              label={{ value: 'Dose (Gy)', position: 'insideBottom', offset: -5 }}
              stroke="hsl(var(--foreground))"
            />
            <YAxis 
              label={{ value: 'Volume (%)', angle: -90, position: 'insideLeft' }}
              stroke="hsl(var(--foreground))"
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            <Legend />
            {selectedStructures.map((structureName, idx) => (
              <Line
                key={structureName}
                type="monotone"
                dataKey={structureName}
                stroke={COLORS[idx % COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
