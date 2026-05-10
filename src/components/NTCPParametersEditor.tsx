/**
 * NTCPParametersEditor.tsx
 * Modal d'édition des paramètres LKB et TCP.
 * Les modifications sont persistées dans localStorage et appliquées immédiatement.
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RotateCcw, Save, Info, AlertTriangle } from 'lucide-react';
import { LKBParameters, TCPParameters, OARCanonicalId, TumorHistologyId } from '@/types/ntcp';
import { DEFAULT_LKB_PARAMETERS, DEFAULT_TCP_PARAMETERS } from '@/data/ntcpDefaults';

const LS_LKB_KEY = 'ntcp-lkb-overrides';
const LS_TCP_KEY = 'ntcp-tcp-overrides';

interface NTCPParametersEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** IDs des OAR actuellement actifs dans l'analyse */
  activeOARIds: OARCanonicalId[];
  /** IDs des histologies actuellement actives */
  activeHistologyIds: TumorHistologyId[];
  onParamsChanged: (
    lkbOverrides: Record<string, Partial<LKBParameters>>,
    tcpOverrides: Record<string, Partial<TCPParameters>>,
  ) => void;
}

// ─── Champs éditables LKB ────────────────────────────────────────────────────

const LKB_EDITABLE_FIELDS: Array<{
  key: keyof LKBParameters;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  tooltip: string;
}> = [
  {
    key: 'td50', label: 'TD50', unit: 'Gy',
    min: 1, max: 120, step: 0.5,
    tooltip: 'Dose de tolérance à 50% de complication. Valeur issue de QUANTEC 2010 / Deasy 2021.',
  },
  {
    key: 'm', label: 'm (pente)', unit: '',
    min: 0.01, max: 1.0, step: 0.01,
    tooltip: 'Pente de la courbe dose-réponse. Petit m = courbe très raide. Typiquement 0.10–0.40.',
  },
  {
    key: 'n', label: 'n (volume-effet)', unit: '',
    min: 0.01, max: 1.0, step: 0.01,
    tooltip: 'Effet volume : n≈1 = organe parallèle (poumon, parotide). n≈0 = organe en série (moelle).',
  },
  {
    key: 'alphaBeta', label: 'α/β', unit: 'Gy',
    min: 0.5, max: 15, step: 0.5,
    tooltip: 'Rapport α/β du tissu sain. Tardif ≈ 2-3 Gy, précoce ≈ 6-10 Gy.',
  },
];

// ─── Champs éditables TCP ─────────────────────────────────────────────────────

const TCP_EDITABLE_FIELDS: Array<{
  key: keyof TCPParameters;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  tooltip: string;
}> = [
  {
    key: 'tcd50', label: 'TCD50', unit: 'Gy',
    min: 10, max: 120, step: 1,
    tooltip: 'Dose de contrôle tumoral à 50%. Très dépendant du type histologique.',
  },
  {
    key: 'gamma50', label: 'γ50 (pente normalisée)', unit: '',
    min: 0.5, max: 5, step: 0.1,
    tooltip: 'Paramètre de pente de la courbe TCP. Typiquement 1.5–2.5.',
  },
  {
    key: 'alphaBeta', label: 'α/β tumeur', unit: 'Gy',
    min: 0.5, max: 20, step: 0.5,
    tooltip: 'α/β tumoral. Prolifération rapide (ORL, poumon) ≈ 10 Gy. Prostate ≈ 1.5 Gy.',
  },
];

// ─── Composant ───────────────────────────────────────────────────────────────

export default function NTCPParametersEditor({
  open, onOpenChange, activeOARIds, activeHistologyIds, onParamsChanged,
}: NTCPParametersEditorProps) {

  const [lkbOverrides, setLkbOverrides] = useState<Record<string, Partial<LKBParameters>>>({});
  const [tcpOverrides, setTcpOverrides] = useState<Record<string, Partial<TCPParameters>>>({});

  // Chargement depuis localStorage
  useEffect(() => {
    try {
      const lkb = localStorage.getItem(LS_LKB_KEY);
      const tcp = localStorage.getItem(LS_TCP_KEY);
      if (lkb) setLkbOverrides(JSON.parse(lkb));
      if (tcp) setTcpOverrides(JSON.parse(tcp));
    } catch { /* ignore */ }
  }, []);

  const handleLKBChange = (oarId: OARCanonicalId, field: keyof LKBParameters, value: number) => {
    setLkbOverrides(prev => ({
      ...prev,
      [oarId]: { ...prev[oarId], [field]: value },
    }));
  };

  const handleTCPChange = (histId: TumorHistologyId, field: keyof TCPParameters, value: number) => {
    setTcpOverrides(prev => ({
      ...prev,
      [histId]: { ...prev[histId], [field]: value },
    }));
  };

  const handleResetLKB = (oarId: OARCanonicalId) => {
    setLkbOverrides(prev => {
      const next = { ...prev };
      delete next[oarId];
      return next;
    });
  };

  const handleResetTCP = (histId: TumorHistologyId) => {
    setTcpOverrides(prev => {
      const next = { ...prev };
      delete next[histId];
      return next;
    });
  };

  const handleSave = () => {
    localStorage.setItem(LS_LKB_KEY, JSON.stringify(lkbOverrides));
    localStorage.setItem(LS_TCP_KEY, JSON.stringify(tcpOverrides));
    onParamsChanged(lkbOverrides, tcpOverrides);
    onOpenChange(false);
  };

  const handleResetAll = () => {
    setLkbOverrides({});
    setTcpOverrides({});
    localStorage.removeItem(LS_LKB_KEY);
    localStorage.removeItem(LS_TCP_KEY);
    onParamsChanged({}, {});
  };

  const confidenceBadge = (level: 'high' | 'moderate' | 'low') => {
    const colors = {
      high: 'bg-success/10 text-success border-success/30',
      moderate: 'bg-warning/10 text-warning border-warning/30',
      low: 'bg-destructive/10 text-destructive border-destructive/30',
    };
    const labels = { high: 'Haute', moderate: 'Modérée', low: 'Faible' };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border font-medium ${colors[level]}`}>
        {labels[level]}
      </span>
    );
  };

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Édition des Paramètres NTCP / TCP</DialogTitle>
            <DialogDescription className="space-y-1">
              <span className="block">Modifiez les paramètres pour les structures actives de cette analyse.</span>
              <span className="flex items-center gap-1.5 text-warning text-xs">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Toute modification s'écarte des valeurs publiées (QUANTEC / Deasy). Documenter les raisons cliniques.
              </span>
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <Tabs defaultValue="lkb" className="mt-2">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="lkb">Paramètres NTCP — OAR ({activeOARIds.length})</TabsTrigger>
                <TabsTrigger value="tcp">Paramètres TCP — Tumeur ({activeHistologyIds.length})</TabsTrigger>
              </TabsList>

              {/* ── OAR LKB ── */}
              <TabsContent value="lkb" className="mt-4 space-y-6">
                {activeOARIds.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Aucun OAR actif — sélectionnez un protocole avec des contraintes OAR.
                  </p>
                )}
                {activeOARIds.map(oarId => {
                  const defaults = DEFAULT_LKB_PARAMETERS[oarId];
                  if (!defaults) return null;
                  const overrides = lkbOverrides[oarId] ?? {};
                  const hasOverride = Object.keys(overrides).length > 0;

                  return (
                    <div key={oarId} className={`border rounded-lg p-4 space-y-3 ${hasOverride ? 'border-primary/40 bg-primary/5' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{defaults.organName}</span>
                            {confidenceBadge(defaults.confidence)}
                            {hasOverride && <Badge variant="outline" className="text-xs text-primary">Modifié</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{defaults.endpoint}</p>
                          <p className="text-xs text-muted-foreground">Source : {defaults.source}</p>
                        </div>
                        {hasOverride && (
                          <Button variant="ghost" size="sm" onClick={() => handleResetLKB(oarId)}>
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />Réinitialiser
                          </Button>
                        )}
                      </div>

                      {defaults.notes && (
                        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
                          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>{defaults.notes}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        {LKB_EDITABLE_FIELDS.map(field => {
                          const currentVal = (overrides[field.key] as number) ?? (defaults[field.key] as number);
                          const isModified = overrides[field.key] !== undefined;

                          return (
                            <div key={String(field.key)}>
                              <div className="flex items-center gap-1 mb-1">
                                <Label className={`text-xs ${isModified ? 'text-primary font-semibold' : ''}`}>
                                  {field.label}
                                  {field.unit && <span className="text-muted-foreground ml-1">({field.unit})</span>}
                                </Label>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-xs">
                                    {field.tooltip}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  value={currentVal}
                                  min={field.min}
                                  max={field.max}
                                  step={field.step}
                                  onChange={e => handleLKBChange(oarId, field.key, parseFloat(e.target.value))}
                                  className={`h-8 text-sm font-mono ${isModified ? 'border-primary' : ''}`}
                                />
                                {isModified && (
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    défaut: {defaults[field.key] as number}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </TabsContent>

              {/* ── TCP ── */}
              <TabsContent value="tcp" className="mt-4 space-y-6">
                {activeHistologyIds.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Aucune histologie sélectionnée — choisissez une histologie pour chaque PTV.
                  </p>
                )}
                {activeHistologyIds.map(histId => {
                  const defaults = DEFAULT_TCP_PARAMETERS[histId];
                  if (!defaults) return null;
                  const overrides = tcpOverrides[histId] ?? {};
                  const hasOverride = Object.keys(overrides).length > 0;

                  return (
                    <div key={histId} className={`border rounded-lg p-4 space-y-3 ${hasOverride ? 'border-primary/40 bg-primary/5' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{defaults.histologyName}</span>
                            {confidenceBadge(defaults.confidence)}
                            {hasOverride && <Badge variant="outline" className="text-xs text-primary">Modifié</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">Source : {defaults.source}</p>
                        </div>
                        {hasOverride && (
                          <Button variant="ghost" size="sm" onClick={() => handleResetTCP(histId)}>
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />Réinitialiser
                          </Button>
                        )}
                      </div>

                      {defaults.notes && (
                        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
                          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>{defaults.notes}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        {TCP_EDITABLE_FIELDS.map(field => {
                          const currentVal = (overrides[field.key] as number) ?? (defaults[field.key] as number);
                          const isModified = overrides[field.key] !== undefined;

                          return (
                            <div key={String(field.key)}>
                              <div className="flex items-center gap-1 mb-1">
                                <Label className={`text-xs ${isModified ? 'text-primary font-semibold' : ''}`}>
                                  {field.label}
                                  {field.unit && <span className="text-muted-foreground ml-1">({field.unit})</span>}
                                </Label>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-xs">
                                    {field.tooltip}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  value={currentVal}
                                  min={field.min}
                                  max={field.max}
                                  step={field.step}
                                  onChange={e => handleTCPChange(histId, field.key, parseFloat(e.target.value))}
                                  className={`h-8 text-sm font-mono ${isModified ? 'border-primary' : ''}`}
                                />
                                {isModified && (
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    défaut: {defaults[field.key] as number}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </TabsContent>
            </Tabs>
          </ScrollArea>

          <div className="flex items-center justify-between pt-4 border-t mt-4">
            <Button variant="ghost" size="sm" onClick={handleResetAll} className="text-destructive hover:text-destructive">
              <RotateCcw className="h-4 w-4 mr-2" />
              Tout réinitialiser
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Sauvegarder et recalculer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
