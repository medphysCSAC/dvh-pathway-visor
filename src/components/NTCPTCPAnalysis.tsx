/**
 * NTCPTCPAnalysis.tsx — Composant principal du module NTCP/TCP
 *
 * Reçoit depuis Index :
 *   - structures (DVH chargés)
 *   - sharedProtocol + sharedMappings (protocole + mapping confirmés)
 *   - onPickProtocol (callback pour ouvrir ProtocolSelectorDialog si aucun protocole)
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Structure } from '@/types/dvh';
import { TreatmentProtocol, StructureMapping } from '@/types/protocol';
import {
  NTCPTCPAnalysisResult, WhatIfConfig, NTCPStructureAssignment,
  OARCanonicalId, TumorHistologyId, LKBParameters, TCPParameters,
} from '@/types/ntcp';
import { DEFAULT_TCP_PARAMETERS } from '@/data/ntcpDefaults';
import { computeFullAnalysis, resolveOARCanonicalId } from '@/utils/ntcpCalculator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertTriangle, CheckCircle2, XCircle, SlidersHorizontal,
  Info, RefreshCw, Target, Shield, ChevronRight,
} from 'lucide-react';
import NTCPParametersEditor from './NTCPParametersEditor';

// ─── Types internes ───────────────────────────────────────────────────────────

interface NTCPTCPAnalysisProps {
  structures: Structure[];
  protocol: TreatmentProtocol | null;
  mappings: StructureMapping[];
  onPickProtocol: () => void;
}

// ─── Helpers d'affichage ──────────────────────────────────────────────────────

function riskBadge(ntcpPercent: number, threshold: number) {
  if (ntcpPercent < 5)   return <Badge className="bg-success/15 text-success border-success/30 font-mono">{ntcpPercent.toFixed(1)}%</Badge>;
  if (ntcpPercent < threshold) return <Badge className="bg-warning/15 text-warning border-warning/30 font-mono">{ntcpPercent.toFixed(1)}%</Badge>;
  return <Badge className="bg-destructive/15 text-destructive border-destructive/30 font-mono">{ntcpPercent.toFixed(1)}%</Badge>;
}

function tcpBadge(tcpPercent: number) {
  if (tcpPercent >= 70)  return <Badge className="bg-success/15 text-success border-success/30 font-mono">{tcpPercent.toFixed(1)}%</Badge>;
  if (tcpPercent >= 40)  return <Badge className="bg-warning/15 text-warning border-warning/30 font-mono">{tcpPercent.toFixed(1)}%</Badge>;
  return <Badge className="bg-destructive/15 text-destructive border-destructive/30 font-mono">{tcpPercent.toFixed(1)}%</Badge>;
}

function confidenceDot(level: 'high' | 'moderate' | 'low') {
  const colors = { high: 'bg-success', moderate: 'bg-warning', low: 'bg-destructive' };
  const labels = { high: 'Haute certitude', moderate: 'Certitude modérée', low: 'Faible certitude' };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors[level]} cursor-help`} />
      </TooltipTrigger>
      <TooltipContent>{labels[level]}</TooltipContent>
    </Tooltip>
  );
}

// ─── Génération de la courbe dose-NTCP what-if ───────────────────────────────

function generateNTCPCurvePoints(
  td50: number, m: number,
  eud: number, doseFactor: number,
): Array<{ factor: number; ntcp: number }> {
  const points = [];
  for (let pct = -30; pct <= 30; pct += 2) {
    const f = 1 + pct / 100;
    const adjustedEUD = eud * (f / doseFactor);
    const t = (adjustedEUD - td50) / (m * td50);
    const p = Math.abs(t);
    const sign = t < 0 ? -1 : 1;
    const ax = p;
    const tv = 1.0 / (1.0 + 0.3275911 * ax);
    const poly = tv * (0.254829592 + tv * (-0.284496736 + tv * (1.421413741 + tv * (-1.453152027 + tv * 1.061405429))));
    const erfVal = sign * (1.0 - poly * Math.exp(-ax * ax));
    const ntcp = 50 * (1 + erfVal);
    points.push({ factor: Math.round(pct), ntcp: Math.min(Math.max(ntcp, 0), 100) });
  }
  return points;
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function NTCPTCPAnalysis({
  structures, protocol, mappings, onPickProtocol,
}: NTCPTCPAnalysisProps) {

  // ── Histologies par PTV ──────────────────────────────────────────────────
  const [histologyMap, setHistologyMap] = useState<Record<string, TumorHistologyId>>({});

  // ── What-if ───────────────────────────────────────────────────────────────
  const [whatIf, setWhatIf] = useState<WhatIfConfig>({
    doseFactor: 1.0,
    alphaBetaOverride: null,
    nFractionsOverride: null,
  });

  // ── Paramètres utilisateur ────────────────────────────────────────────────
  const [userLKBOverrides, setUserLKBOverrides] = useState<Record<string, Partial<LKBParameters>>>({});
  const [userTCPOverrides, setUserTCPOverrides] = useState<Record<string, Partial<TCPParameters>>>({});
  const [editorOpen, setEditorOpen] = useState(false);

  // ── Résultats ─────────────────────────────────────────────────────────────
  const [result, setResult] = useState<NTCPTCPAnalysisResult | null>(null);
  const [selectedOARForChart, setSelectedOARForChart] = useState<string | null>(null);

  // Charger les surcharges depuis localStorage au montage
  useEffect(() => {
    try {
      const lkb = localStorage.getItem('ntcp-lkb-overrides');
      const tcp = localStorage.getItem('ntcp-tcp-overrides');
      if (lkb) setUserLKBOverrides(JSON.parse(lkb));
      if (tcp) setUserTCPOverrides(JSON.parse(tcp));
    } catch { /* ignore */ }
  }, []);

  // ── Calcul des assignments OAR → canonique ───────────────────────────────
  const assignments: NTCPStructureAssignment[] = useMemo(() => {
    if (!protocol) return [];
    const result: NTCPStructureAssignment[] = [];

    for (const constraint of protocol.oarConstraints) {
      const mapping = mappings.find(m => m.protocolStructureName === constraint.organName);
      const dvhName = mapping?.dvhStructureName ?? constraint.organName;
      const oarId = resolveOARCanonicalId(constraint.organName);
      result.push({
        dvhStructureName: dvhName,
        type: 'oar',
        oarId: oarId ?? undefined,
        isAutoAssigned: true,
      });
    }

    for (const prescription of protocol.prescriptions) {
      const mapping = mappings.find(m => m.protocolStructureName === prescription.ptvName);
      const dvhName = mapping?.dvhStructureName ?? prescription.ptvName;
      const histologyId = histologyMap[prescription.ptvName];
      result.push({
        dvhStructureName: dvhName,
        type: 'tumor',
        histologyId,
        isAutoAssigned: false,
      });
    }

    return result;
  }, [protocol, mappings, histologyMap]);

  // ── Recalcul automatique ─────────────────────────────────────────────────
  const runAnalysis = useCallback(() => {
    if (!protocol) return;
    const res = computeFullAnalysis(
      structures, protocol, mappings, assignments,
      userLKBOverrides, userTCPOverrides, whatIf,
    );
    setResult(res);
    if (!selectedOARForChart && res.ntcpResults.length > 0) {
      setSelectedOARForChart(res.ntcpResults[0].structureName);
    }
  }, [structures, protocol, mappings, assignments, userLKBOverrides, userTCPOverrides, whatIf, selectedOARForChart]);

  useEffect(() => {
    if (protocol) runAnalysis();
  }, [protocol, mappings, userLKBOverrides, userTCPOverrides, whatIf]);

  // ── IDs actifs pour l'éditeur ─────────────────────────────────────────────
  const activeOARIds = useMemo(() =>
    [...new Set(
      assignments
        .filter(a => a.type === 'oar' && a.oarId)
        .map(a => a.oarId as OARCanonicalId)
    )], [assignments]);

  const activeHistologyIds = useMemo(() =>
    [...new Set(
      assignments
        .filter(a => a.type === 'tumor' && a.histologyId)
        .map(a => a.histologyId as TumorHistologyId)
    )], [assignments]);

  // ── Courbe what-if ────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!result || !selectedOARForChart) return null;
    const ntcpResult = result.ntcpResults.find(r => r.structureName === selectedOARForChart);
    if (!ntcpResult) return null;
    const points = generateNTCPCurvePoints(
      ntcpResult.parameters.td50,
      ntcpResult.parameters.m,
      ntcpResult.eudResult.eud,
      whatIf.doseFactor,
    );
    return { points, currentFactor: Math.round((whatIf.doseFactor - 1) * 100) };
  }, [result, selectedOARForChart, whatIf.doseFactor]);

  // ── Affichage si pas de protocole ─────────────────────────────────────────
  if (!protocol) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-4 mt-4">
        <div className="flex items-center gap-3">
          <Target className="w-5 h-5 text-primary shrink-0" />
          <p className="text-sm">Sélectionnez un protocole pour calculer les probabilités NTCP/TCP.</p>
        </div>
        <Button size="sm" onClick={onPickProtocol}>
          Choisir un protocole <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    );
  }

  const prescription = protocol.prescriptions[0];

  return (
    <TooltipProvider>
      <div className="space-y-4">

        {/* ── En-tête et contrôles ── */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <CardTitle>Modélisation NTCP / TCP</CardTitle>
                <CardDescription>
                  {protocol.name}
                  {prescription && (
                    <span className="ml-2 font-mono">
                      — {prescription.totalDose} Gy / {prescription.numberOfFractions} fx
                      ({prescription.dosePerFraction.toFixed(2)} Gy/fx)
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={runAnalysis}>
                  <RefreshCw className="h-4 w-4 mr-2" />Recalculer
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditorOpen(true)}>
                  <SlidersHorizontal className="h-4 w-4 mr-2" />Éditer paramètres
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">

            {/* What-if slider dose */}
            <div className="space-y-2 border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Simulation what-if — Dose
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 ml-1 text-muted-foreground cursor-help inline" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Applique un facteur multiplicatif sur toutes les doses du DVH.
                      Ne modifie pas le fichier DVH source. Usage comparatif uniquement.
                    </TooltipContent>
                  </Tooltip>
                </label>
                <span className={`text-sm font-mono font-semibold ${
                  whatIf.doseFactor > 1 ? 'text-destructive' :
                  whatIf.doseFactor < 1 ? 'text-success' : 'text-muted-foreground'
                }`}>
                  {whatIf.doseFactor === 1 ? 'Nominal (0%)' :
                   `${whatIf.doseFactor > 1 ? '+' : ''}${Math.round((whatIf.doseFactor - 1) * 100)}%`}
                </span>
              </div>
              <Slider
                value={[Math.round((whatIf.doseFactor - 1) * 100)]}
                min={-20} max={20} step={1}
                onValueChange={([v]) => setWhatIf(prev => ({ ...prev, doseFactor: 1 + v / 100 }))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>−20%</span>
                <span>Nominal</span>
                <span>+20%</span>
              </div>
            </div>

            {/* Légende certitude */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="font-medium">Certitude paramètres :</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success inline-block" /> Haute (cohorte IMRT ≥200 pts)</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning inline-block" /> Modérée (QUANTEC ou partiel IMRT)</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive inline-block" /> Faible (extrapolé / données limitées)</span>
            </div>
          </CardContent>
        </Card>

        {/* ── Avertissements globaux ── */}
        {result?.globalWarnings && result.globalWarnings.length > 0 && (
          <Card className="border-warning/40">
            <CardContent className="pt-4">
              <div className="space-y-1">
                {result.globalWarnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-warning-foreground">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Tableau NTCP OAR ── */}
        {result && result.ntcpResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-5 w-5" />
                NTCP — Risques OAR
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm text-xs">
                    Modèle LKB (Lyman-Kutcher-Burman). EUD calculé sur le DVH différentiel absolu
                    avec correction EQD2 (modèle linéaire-quadratique). Paramètres QUANTEC 2010
                    mis à jour (Deasy 2021 pour parotide, ESTRO ACROP 2022 pour cœur).
                    Usage recommandé : comparaison ΔNTCP entre plans (pas valeur absolue isolée).
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left p-2">Structure</th>
                      <th className="text-left p-2">Endpoint</th>
                      <th className="text-right p-2">EUD (Gy)</th>
                      <th className="text-right p-2">TD50 (Gy)</th>
                      <th className="text-right p-2">m</th>
                      <th className="text-right p-2">n</th>
                      <th className="text-right p-2">NTCP</th>
                      <th className="text-center p-2">Seuil</th>
                      <th className="text-center p-2">Certitude</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.ntcpResults.map((r, i) => (
                      <tr
                        key={i}
                        className={`border-b hover:bg-muted/30 cursor-pointer ${
                          selectedOARForChart === r.structureName ? 'bg-primary/5' : ''
                        }`}
                        onClick={() => setSelectedOARForChart(r.structureName)}
                      >
                        <td className="p-2 font-medium">
                          {r.structureName}
                          {selectedOARForChart === r.structureName && (
                            <Badge variant="outline" className="ml-2 text-xs">graphique</Badge>
                          )}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground max-w-[180px] truncate">
                          {r.parameters.endpoint}
                        </td>
                        <td className="p-2 text-right font-mono">{r.eudResult.eud.toFixed(1)}</td>
                        <td className="p-2 text-right font-mono">{r.parameters.td50}</td>
                        <td className="p-2 text-right font-mono">{r.parameters.m}</td>
                        <td className="p-2 text-right font-mono">{r.parameters.n}</td>
                        <td className="p-2 text-right">
                          {riskBadge(r.ntcpPercent, r.constraintThreshold)}
                        </td>
                        <td className="p-2 text-center">
                          {r.isAboveConstraint ? (
                            <XCircle className="h-4 w-4 text-destructive mx-auto" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-success mx-auto" />
                          )}
                          <span className="text-xs text-muted-foreground block">&lt;{r.constraintThreshold}%</span>
                        </td>
                        <td className="p-2 text-center">
                          {confidenceDot(r.parameters.confidence)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Note NTCP */}
              <div className="flex items-start gap-2 mt-3 text-xs text-muted-foreground bg-muted/40 rounded p-2">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Cliquez sur une ligne pour afficher la courbe dose-réponse.
                  Les valeurs absolues de NTCP sont sensibles aux paramètres du modèle —
                  la comparaison ΔNTCP entre deux plans est l'usage cliniquement le plus robuste.
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Graphique dose-réponse (what-if) ── */}
        {chartData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Courbe NTCP — {selectedOARForChart}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  (simulation what-if ±20% dose)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData.points} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis
                    dataKey="factor"
                    tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`}
                    label={{ value: 'Variation dose (%)', position: 'insideBottom', offset: -2, fontSize: 11 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={v => `${v}%`}
                    label={{ value: 'NTCP (%)', angle: -90, position: 'insideLeft', fontSize: 11 }}
                  />
                  <RechartsTooltip
                    formatter={(v: number) => [`${v.toFixed(1)}%`, 'NTCP']}
                    labelFormatter={v => `Dose ${v > 0 ? '+' : ''}${v}%`}
                  />
                  <ReferenceLine
                    x={chartData.currentFactor}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    label={{ value: 'Plan actuel', fill: 'hsl(var(--primary))', fontSize: 10 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ntcp"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* ── Tableau TCP PTV ── */}
        {protocol.prescriptions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-5 w-5" />
                TCP — Contrôle tumoral (PTV)
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm text-xs">
                    Modèle logistique de Niemierko (1997). gEUD calculé avec paramètre a négatif
                    (sensibilité aux zones froides). Sélectionnez l'histologie tumorale pour activer le calcul.
                    ⚠ Les valeurs absolues de TCP sont très incertaines — usage comparatif ΔTCP uniquement.
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Sélection histologie par PTV */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">
                  Sélectionnez l'histologie tumorale pour chaque PTV :
                </p>
                {protocol.prescriptions.map(prescription => (
                  <div key={prescription.ptvName} className="flex items-center gap-3">
                    <span className="text-sm font-mono w-28 shrink-0">{prescription.ptvName}</span>
                    <Select
                      value={histologyMap[prescription.ptvName] ?? ''}
                      onValueChange={v => setHistologyMap(prev => ({
                        ...prev,
                        [prescription.ptvName]: v as TumorHistologyId,
                      }))}
                    >
                      <SelectTrigger className="flex-1 h-8 text-sm">
                        <SelectValue placeholder="Sélectionner l'histologie..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(DEFAULT_TCP_PARAMETERS).map(p => (
                          <SelectItem key={p.histologyId} value={p.histologyId}>
                            <div className="flex items-center gap-2">
                              <span>{p.histologyName}</span>
                              <span className={`text-xs ${
                                p.confidence === 'high' ? 'text-success' :
                                p.confidence === 'moderate' ? 'text-warning' : 'text-muted-foreground'
                              }`}>
                                ({p.confidence === 'high' ? '●' : p.confidence === 'moderate' ? '◑' : '○'})
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Résultats TCP */}
              {result && result.tcpResults.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left p-2">Structure</th>
                        <th className="text-left p-2">Histologie</th>
                        <th className="text-right p-2">gEUD (Gy)</th>
                        <th className="text-right p-2">TCD50 (Gy)</th>
                        <th className="text-right p-2">γ50</th>
                        <th className="text-right p-2">TCP</th>
                        <th className="text-center p-2">Certitude</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.tcpResults.map((r, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2 font-medium">{r.structureName}</td>
                          <td className="p-2 text-xs text-muted-foreground">{r.parameters.histologyName}</td>
                          <td className="p-2 text-right font-mono">
                            {r.eudResult.eud.toFixed(1)}
                            {r.coldSpotWarning && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertTriangle className="h-3.5 w-3.5 text-warning inline ml-1 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="text-xs max-w-xs">
                                  gEUD &lt; 95% de la dose prescrite — zone froide significative détectée.
                                  Risque de sous-dosage tumoral.
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </td>
                          <td className="p-2 text-right font-mono">{r.parameters.tcd50}</td>
                          <td className="p-2 text-right font-mono">{r.parameters.gamma50}</td>
                          <td className="p-2 text-right">{tcpBadge(r.tcpPercent)}</td>
                          <td className="p-2 text-center">{confidenceDot(r.parameters.confidence)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(!result || result.tcpResults.length === 0) && Object.keys(histologyMap).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sélectionnez une histologie pour activer le calcul TCP.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Pas de résultats OAR ── */}
        {result && result.ntcpResults.length === 0 && (
          <Card className="border-warning/40">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-warning-foreground">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span>
                  Aucun OAR calculé. Vérifiez que les structures du protocole sont correctement
                  mappées aux structures DVH et que les données DVH différentielles sont disponibles.
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Disclaimer médical obligatoire ── */}
        <Card className="border-muted bg-muted/20">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Outil d'aide à la décision — Usage comparatif</p>
                <p>
                  Les probabilités NTCP/TCP sont calculées selon les modèles LKB et Niemierko avec des
                  paramètres issus de QUANTEC 2010, Deasy 2021 et ESTRO ACROP 2022. Ces modèles ont été
                  dérivés principalement sur des données de radiothérapie 3D conformationnelle et IMRT —
                  pas spécifiquement sur des cohortes de tomothérapie.
                </p>
                <p>
                  <strong>La valeur absolue du NTCP/TCP ne doit pas être utilisée seule</strong> comme
                  critère de décision clinique. L'usage recommandé est la comparaison de la variation
                  relative ΔNTCP entre deux plans (plan A vs plan B). Toute décision clinique reste
                  sous la responsabilité du médecin radiothérapeute et du physicien médical.
                </p>
                <p className="text-muted-foreground/70">
                  Sources : Kutcher &amp; Burman 1989 · QUANTEC 2010 · Niemierko 1997 ·
                  Deasy 2021 · ESTRO ACROP 2022 · HyTEC 2021 · NRG CC001 2020
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Éditeur paramètres ── */}
        <NTCPParametersEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          activeOARIds={activeOARIds}
          activeHistologyIds={activeHistologyIds}
          onParamsChanged={(lkb, tcp) => {
            setUserLKBOverrides(lkb);
            setUserTCPOverrides(tcp);
          }}
        />
      </div>
    </TooltipProvider>
  );
}
