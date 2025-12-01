import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlanData, Structure } from "@/types/dvh";
import {
  calculateDx,
  calculateVx,
  calculateHomogeneityIndex,
  calculateConformityIndex,
} from "@/utils/planQualityMetrics";
import { findStructureByName } from "@/utils/planSummation";
import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContextualHelp } from "@/components/ContextualHelp";

interface PlanComparisonProps {
  plans: PlanData[];
}

interface MetricComparison {
  name: string;
  unit: string;
  values: (number | null)[];
  lowerIsBetter: boolean;
  tooltip: string;
}

export const PlanComparison = ({ plans }: PlanComparisonProps) => {
  const [selectedStructure, setSelectedStructure] = useState<string>("");
  const [prescriptionDose, setPrescriptionDose] = useState<number>(60);

  // Find common structures across all plans
  const commonStructures = useMemo(() => {
    if (plans.length === 0) return [];

    const firstPlanStructures = plans[0].structures.map((s) => s.name);
    return firstPlanStructures.filter((name) => plans.every((plan) => plan.structures.some((s) => s.name === name)));
  }, [plans]);

  // Set first common structure as default
  useMemo(() => {
    if (commonStructures.length > 0 && !selectedStructure) {
      setSelectedStructure(commonStructures[0]);
    }
  }, [commonStructures, selectedStructure]);

  // Calculate metrics for the selected structure across all plans
  const metrics = useMemo((): MetricComparison[] => {
    if (!selectedStructure) return [];

    const structures = plans.map((plan) => findStructureByName(plan.structures, selectedStructure));

    const isPTV = structures[0]?.category === "PTV";

    const baseMetrics: MetricComparison[] = [
      {
        name: "Volume",
        unit: "cc",
        values: structures.map((s) => s?.totalVolume || null),
        lowerIsBetter: false,
        tooltip: "Volume total de la structure en centimètres cubes",
      },
      {
        name: "Dmax",
        unit: "Gy",
        values: structures.map((s) => (s ? calculateDx(s, 0.03, "cc") : null)),
        lowerIsBetter: !isPTV,
        tooltip: "Dose maximale reçue par la structure (dose à 0.03 cc)",
      },
      {
        name: "Dmean",
        unit: "Gy",
        values: structures.map((s) => {
          if (!s?.relativeVolume || s.relativeVolume.length < 2) return null;

          // Trier par dose croissante (important pour la méthode trapézoïdale)
          const sortedPoints = [...s.relativeVolume].sort((a, b) => a.dose - b.dose);

          let totalDoseVolume = 0;
          let totalVolume = 0;

          for (let i = 1; i < sortedPoints.length; i++) {
            const prev = sortedPoints[i - 1];
            const curr = sortedPoints[i];

            // Volume de l'intervalle (différence entre volumes cumulés)
            const deltaVolume = prev.volume - curr.volume;

            // Dose moyenne sur l'intervalle (méthode trapézoïdale)
            const avgDoseInInterval = (prev.dose + curr.dose) / 2;

            totalDoseVolume += avgDoseInInterval * deltaVolume;
            totalVolume += deltaVolume;
          }

          // Ajouter le premier intervalle (volume reçu entre 0 Gy et la première dose)
          if (sortedPoints.length > 0) {
            const firstPoint = sortedPoints[0];
            const deltaVolumeFirst = 100 - firstPoint.volume; // Volume recevant entre 0 et Dose_min
            totalDoseVolume += (firstPoint.dose / 2) * deltaVolumeFirst; // Approximation trapézoïdale
            totalVolume += deltaVolumeFirst;
          }

          // Dmean = Dose moyenne = Total (Dose × Volume) / Volume total
          return totalVolume > 0 ? totalDoseVolume / totalVolume : 0;
        }),
        lowerIsBetter: !isPTV,
        tooltip: "Dose moyenne reçue par la structure (calculée par intégration trapézoïdale)",
      },
    ];

    if (isPTV) {
      baseMetrics.push(
        {
          name: "D95%",
          unit: "Gy",
          values: structures.map((s) => (s ? calculateDx(s, 95) : null)),
          lowerIsBetter: false,
          tooltip: "Dose reçue par 95% du volume (couverture du PTV)",
        },
        {
          name: "D98%",
          unit: "Gy",
          values: structures.map((s) => (s ? calculateDx(s, 98) : null)),
          lowerIsBetter: false,
          tooltip: "Dose reçue par 98% du volume",
        },
        {
          name: "D2%",
          unit: "Gy",
          values: structures.map((s) => (s ? calculateDx(s, 2) : null)),
          lowerIsBetter: false,
          tooltip: "Dose reçue par 2% du volume (points chauds)",
        },
        {
          name: "V95%",
          unit: "%",
          values: structures.map((s) => (s ? calculateVx(s, prescriptionDose * 0.95) : null)),
          lowerIsBetter: false,
          tooltip: `Volume recevant au moins 95% de la dose de prescription (${(prescriptionDose * 0.95).toFixed(1)} Gy)`,
        },
        {
          name: "HI",
          unit: "",
          values: structures.map((s) => (s ? calculateHomogeneityIndex(s) : null)),
          lowerIsBetter: true,
          tooltip: "Indice d'Homogénéité : (D2% - D98%) / D50%. Plus bas = plus homogène",
        },
        {
          name: "CI",
          unit: "",
          values: structures.map((s) => (s ? calculateConformityIndex(s, prescriptionDose) : null)),
          lowerIsBetter: false,
          tooltip: `Indice de Conformité : V${prescriptionDose}Gy / Volume PTV. Plus proche de 1 = meilleure conformité`,
        },
      );
    } else {
      // OAR metrics
      baseMetrics.push(
        {
          name: "V20Gy",
          unit: "%",
          values: structures.map((s) => (s ? calculateVx(s, 20) : null)),
          lowerIsBetter: true,
          tooltip: "Pourcentage du volume recevant au moins 20 Gy",
        },
        {
          name: "V30Gy",
          unit: "%",
          values: structures.map((s) => (s ? calculateVx(s, 30) : null)),
          lowerIsBetter: true,
          tooltip: "Pourcentage du volume recevant au moins 30 Gy",
        },
        {
          name: "V40Gy",
          unit: "%",
          values: structures.map((s) => (s ? calculateVx(s, 40) : null)),
          lowerIsBetter: true,
          tooltip: "Pourcentage du volume recevant au moins 40 Gy",
        },
      );
    }

    return baseMetrics;
  }, [selectedStructure, plans, prescriptionDose]);

  // Determine best value for each metric
  const getBestValueIndex = (metric: MetricComparison): number | null => {
    const validValues = metric.values.map((v, i) => ({ value: v, index: i })).filter((v) => v.value !== null);
    if (validValues.length === 0) return null;

    if (metric.lowerIsBetter) {
      return validValues.reduce((min, curr) => (curr.value! < min.value! ? curr : min)).index;
    } else {
      return validValues.reduce((max, curr) => (curr.value! > max.value! ? curr : max)).index;
    }
  };

  // Calculate difference from reference (first plan)
  const getDifference = (value: number | null, referenceValue: number | null): number | null => {
    if (value === null || referenceValue === null) return null;
    return value - referenceValue;
  };

  // Get color class based on difference and whether lower is better
  const getDiffColorClass = (diff: number | null, lowerIsBetter: boolean, isBest: boolean): string => {
    if (diff === null || Math.abs(diff) < 0.01) return "text-muted-foreground";
    if (isBest) return "text-primary font-semibold";

    const isImprovement = lowerIsBetter ? diff < 0 : diff > 0;
    return isImprovement ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
  };

  const getDiffIcon = (diff: number | null, lowerIsBetter: boolean) => {
    if (diff === null || Math.abs(diff) < 0.01) return <Minus className="w-3 h-3" />;

    const isImprovement = lowerIsBetter ? diff < 0 : diff > 0;
    return isImprovement ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />;
  };

  if (plans.length < 2) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Veuillez charger au moins 2 plans pour activer la comparaison
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Comparaison de Plans
            <ContextualHelp
              content="Comparez les métriques dosimétriques de plusieurs plans côte-à-côte. Les meilleures valeurs sont en bleu, les améliorations en vert, les dégradations en rouge."
              side="right"
            />
          </CardTitle>
          <CardDescription>Analyse comparative des métriques dosimétriques entre {plans.length} plans</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Structure à comparer</label>
              <Select value={selectedStructure} onValueChange={setSelectedStructure}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une structure" />
                </SelectTrigger>
                <SelectContent>
                  {commonStructures.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[150px]">
              <label className="text-sm font-medium mb-2 block">Dose prescription (Gy)</label>
              <input
                type="number"
                value={prescriptionDose}
                onChange={(e) => setPrescriptionDose(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md border bg-background"
                step="0.1"
              />
            </div>
          </div>

          {selectedStructure && (
            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
              <span>Légende:</span>
              <span className="flex items-center gap-1 text-primary font-semibold">
                <TrendingUp className="w-3 h-3" /> Meilleure valeur
              </span>
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <TrendingUp className="w-3 h-3" /> Amélioration
              </span>
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <TrendingDown className="w-3 h-3" /> Dégradation
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Minus className="w-3 h-3" /> Identique
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedStructure && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-semibold sticky left-0 bg-muted/50 z-10">Métrique</th>
                    {plans.map((plan, idx) => (
                      <th key={plan.id} className="text-center p-4 min-w-[140px]">
                        <div className="space-y-1">
                          <div className="font-semibold">{plan.name}</div>
                          {idx === 0 && (
                            <Badge variant="outline" className="text-xs">
                              Référence
                            </Badge>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((metric, metricIdx) => {
                    const bestIdx = getBestValueIndex(metric);
                    const referenceValue = metric.values[0];

                    return (
                      <tr key={metric.name} className={metricIdx % 2 === 0 ? "bg-muted/20" : ""}>
                        <td className="p-4 font-medium sticky left-0 bg-background border-r">
                          <div className="flex items-center gap-2">
                            {metric.name}
                            <ContextualHelp content={metric.tooltip} side="right" />
                          </div>
                        </td>
                        {metric.values.map((value, planIdx) => {
                          const diff = planIdx > 0 ? getDifference(value, referenceValue) : null;
                          const isBest = planIdx === bestIdx;
                          const colorClass = getDiffColorClass(diff, metric.lowerIsBetter, isBest);

                          return (
                            <td key={planIdx} className="p-4 text-center">
                              <div className="space-y-1">
                                <div className={`font-semibold ${isBest ? "text-primary" : ""}`}>
                                  {value !== null ? `${value.toFixed(2)} ${metric.unit}` : "N/A"}
                                </div>
                                {planIdx > 0 && diff !== null && (
                                  <div className={`text-xs flex items-center justify-center gap-1 ${colorClass}`}>
                                    {getDiffIcon(diff, metric.lowerIsBetter)}
                                    {diff > 0 ? "+" : ""}
                                    {diff.toFixed(2)} {metric.unit}
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {commonStructures.length < plans[0].structures.length && (
        <Card className="border-orange-500/50 bg-orange-500/5">
          <CardContent className="py-4">
            <p className="text-sm text-orange-600 dark:text-orange-400">
              ⚠️ Attention : Certaines structures ne sont pas présentes dans tous les plans et ne peuvent pas être
              comparées. Seules {commonStructures.length} structures communes sont disponibles pour la comparaison.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
