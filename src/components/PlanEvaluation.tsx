import { useMemo } from 'react';
import { Structure } from '@/types/dvh';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  calculatePTVQualityMetrics,
  calculateOARMetrics,
  findPrimaryPTV,
  calculateDx,
  PTVQualityMetrics,
  OARMetrics
} from '@/utils/planQualityMetrics';
import { Target, Shield, Award, AlertCircle, CheckCircle } from 'lucide-react';

interface PlanEvaluationProps {
  structures: Structure[];
}

export const PlanEvaluation = ({ structures }: PlanEvaluationProps) => {
  // Trouver le PTV principal et la dose de prescription
  const primaryPTV = useMemo(() => findPrimaryPTV(structures), [structures]);
  const prescriptionDose = useMemo(() => {
    if (!primaryPTV) return 50; // Valeur par défaut
    return calculateDx(primaryPTV, 50);
  }, [primaryPTV]);

  // Calculer les métriques pour tous les PTVs
  const ptvMetrics = useMemo(() => {
    return structures
      .filter(s => s.category === 'PTV')
      .map(ptv => calculatePTVQualityMetrics(ptv, structures, prescriptionDose));
  }, [structures, prescriptionDose]);

  // Calculer les métriques pour tous les OARs
  const oarMetrics = useMemo(() => {
    return structures
      .filter(s => s.category === 'OAR')
      .map(oar => calculateOARMetrics(oar));
  }, [structures]);

  const getQualityBadge = (hi: number, ci: number) => {
    // HI idéal < 0.1, CI idéal proche de 1
    const hiGood = hi < 0.15;
    const ciGood = ci >= 0.95 && ci <= 1.1;
    
    if (hiGood && ciGood) {
      return (
        <Badge className="gap-1 bg-green-500 hover:bg-green-600">
          <CheckCircle className="w-3 h-3" />
          Excellent
        </Badge>
      );
    } else if (hiGood || ciGood) {
      return (
        <Badge className="gap-1 bg-yellow-500 hover:bg-yellow-600">
          <AlertCircle className="w-3 h-3" />
          Acceptable
        </Badge>
      );
    } else {
      return (
        <Badge className="gap-1 bg-red-500 hover:bg-red-600">
          <AlertCircle className="w-3 h-3" />
          À améliorer
        </Badge>
      );
    }
  };

  const getCellColor = (value: number, threshold: number, isLower: boolean = true) => {
    const acceptable = isLower ? value <= threshold : value >= threshold;
    return acceptable ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold';
  };

  return (
    <div className="space-y-6">
      {/* Résumé du plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            <CardTitle>Résumé du plan de traitement</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">PTV principal</p>
              <p className="text-lg font-semibold">{primaryPTV?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dose de prescription (D50)</p>
              <p className="text-lg font-semibold text-primary">{prescriptionDose.toFixed(2)} Gy</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nombre de structures</p>
              <p className="text-lg font-semibold">
                {ptvMetrics.length} PTV • {oarMetrics.length} OAR
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Qualité des volumes cibles (PTV) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-red-500" />
            <CardTitle>Qualité des volumes cibles (PTV)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Structure</TableHead>
                  <TableHead className="text-right">D<sub>95%</sub> (Gy)</TableHead>
                  <TableHead className="text-right">D<sub>98%</sub> (Gy)</TableHead>
                  <TableHead className="text-right">D<sub>50%</sub> (Gy)</TableHead>
                  <TableHead className="text-right">D<sub>2%</sub> (Gy)</TableHead>
                  <TableHead className="text-right">V<sub>95%</sub></TableHead>
                  <TableHead className="text-right">HI</TableHead>
                  <TableHead className="text-right">CI</TableHead>
                  <TableHead className="text-right">CN</TableHead>
                  <TableHead>Qualité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ptvMetrics.map((metrics: PTVQualityMetrics) => (
                  <TableRow 
                    key={metrics.structureName}
                    className="hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    <TableCell className="font-medium">{metrics.structureName}</TableCell>
                    <TableCell className="text-right">{metrics.d95.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{metrics.d98.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">{metrics.d50.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{metrics.d2.toFixed(2)}</TableCell>
                    <TableCell className={`text-right ${getCellColor(metrics.v95, 95, false)}`}>
                      {metrics.v95.toFixed(1)}%
                    </TableCell>
                    <TableCell className={`text-right ${getCellColor(metrics.hi, 0.15)}`}>
                      {metrics.hi.toFixed(3)}
                    </TableCell>
                    <TableCell className={`text-right ${getCellColor(Math.abs(1 - metrics.ci), 0.1)}`}>
                      {metrics.ci.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right">{metrics.cn.toFixed(3)}</TableCell>
                    <TableCell>
                      {getQualityBadge(metrics.hi, metrics.ci)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {/* Légende des indices */}
          <div className="mt-4 p-4 bg-muted/30 rounded-lg text-sm space-y-2">
            <p className="font-semibold">Indices de qualité :</p>
            <ul className="space-y-1 text-muted-foreground">
              <li><strong>HI (Homogeneity Index)</strong> : (D2% - D98%) / D50%. Idéal &lt; 0.1</li>
              <li><strong>CI (Conformity Index)</strong> : V95% / 95%. Idéal ≈ 1</li>
              <li><strong>CN (Conformation Number)</strong> : Mesure la conformation 3D. Idéal ≈ 1</li>
              <li><strong>V95%</strong> : Volume recevant 95% de la dose. Objectif ≥ 95%</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Doses aux organes à risque (OAR) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-500" />
            <CardTitle>Doses aux organes à risque (OAR)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Structure</TableHead>
                  <TableHead className="text-right">Volume (cc)</TableHead>
                  <TableHead className="text-right">D<sub>max</sub> (Gy)</TableHead>
                  <TableHead className="text-right">D<sub>mean</sub> (Gy)</TableHead>
                  <TableHead className="text-right">V<sub>20Gy</sub> (%)</TableHead>
                  <TableHead className="text-right">V<sub>30Gy</sub> (%)</TableHead>
                  <TableHead className="text-right">V<sub>40Gy</sub> (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {oarMetrics.map((metrics: OARMetrics) => (
                  <TableRow 
                    key={metrics.structureName}
                    className="hover:bg-blue-50 dark:hover:bg-blue-950/20"
                  >
                    <TableCell className="font-medium">{metrics.structureName}</TableCell>
                    <TableCell className="text-right">{metrics.volume.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">{metrics.dmax.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{metrics.dmean.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{metrics.v20Gy.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{metrics.v30Gy.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{metrics.v40Gy.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {/* Note sur les contraintes */}
          <div className="mt-4 p-4 bg-muted/30 rounded-lg text-sm">
            <p className="font-semibold mb-2">Note :</p>
            <p className="text-muted-foreground">
              Les valeurs affichées sont à comparer avec les contraintes QUANTEC, RTOG ou protocoles institutionnels 
              selon l'organe et la localisation du traitement.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
