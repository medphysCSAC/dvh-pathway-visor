import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, AlertTriangle, Settings2, Target } from 'lucide-react';
import { Structure } from '@/types/dvh';
import { TreatmentProtocol, StructureMapping } from '@/types/protocol';
import { LKBParameters, TCPParameters, NTCPResult, TCPResult } from '@/types/ntcp';
import {
  DEFAULT_LKB_PARAMETERS,
  DEFAULT_TCP_PARAMETERS,
  findDefaultLKB,
} from '@/data/ntcpDefaults';
import { evaluateNTCP, evaluateTCP } from '@/utils/ntcpCalculator';
import { NTCPParametersEditor } from './NTCPParametersEditor';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';

const STORAGE_KEY = 'ntcp-lkb-overrides-v1';

interface Props {
  structures: Structure[];
  protocol: TreatmentProtocol | null;
  mappings: StructureMapping[];
  onPickProtocol: () => void;
}

function loadOverrides(): Record<string, LKBParameters> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveOverrides(o: Record<string, LKBParameters>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
}

function severity(ntcp: number): { label: string; cls: string } {
  if (ntcp < 0.05)  return { label: 'Faible',  cls: 'text-success border-success/40 bg-success/10' };
  if (ntcp < 0.20)  return { label: 'Modéré',  cls: 'text-warning border-warning/40 bg-warning/10' };
  return                   { label: 'Élevé',   cls: 'text-destructive border-destructive/40 bg-destructive/10' };
}

function formatPct(v: number): string {
  if (v < 0.005) return '< 0.5%';
  return (v * 100).toFixed(1) + '%';
}

export const NTCPTCPAnalysis = ({ structures, protocol, mappings, onPickProtocol }: Props) => {
  const [doseScalePct, setDoseScalePct] = useState(100); // 80..120
  const [editorOpen, setEditorOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, LKBParameters>>(loadOverrides());

  const doseScale = doseScalePct / 100;

  const nFx = protocol?.prescriptions[0]?.numberOfFractions ?? 0;
  const totalDose = protocol?.prescriptions[0]?.totalDose ?? 0;

  // Resolve OAR pairs (protocol structure → DICOM structure + LKB params)
  const oarPairs = useMemo(() => {
    if (!protocol) return [];
    const out: { protName: string; structure: Structure; params: LKBParameters }[] = [];
    const addedStructures = new Set<string>();

    for (const c of protocol.oarConstraints) {
      const protName = c.organName;
      const mapping = mappings.find(m => m.protocolStructureName === protName);
      const dicomName = mapping?.dvhStructureName ?? protName;
      const structure = structures.find(s => s.name === dicomName);
      if (!structure || addedStructures.has(structure.name)) continue;
      const baseParams = findDefaultLKB(protName) ?? findDefaultLKB(structure.name);
      if (!baseParams) continue;
      const ovKey = structure.name;
      const params = overrides[ovKey] ?? baseParams;
      out.push({ protName, structure, params: { ...params, key: ovKey } });
      addedStructures.add(structure.name);
    }
    return out;
  }, [protocol, mappings, structures, overrides]);

  const ptvPairs = useMemo(() => {
    if (!protocol) return [];
    const out: { protName: string; structure: Structure; params: TCPParameters }[] = [];
    const seen = new Set<string>();
    for (const presc of protocol.prescriptions) {
      const protName = presc.ptvName;
      const mapping = mappings.find(m => m.protocolStructureName === protName);
      const dicomName = mapping?.dvhStructureName ?? protName;
      const structure = structures.find(s => s.name === dicomName)
                     ?? structures.find(s => s.category === 'PTV' && s.name.toLowerCase().includes((protName ?? '').toLowerCase()));
      if (!structure || seen.has(structure.name)) continue;
      seen.add(structure.name);
      out.push({
        protName,
        structure,
        params: { ...DEFAULT_TCP_PARAMETERS, TCD50: presc.totalDose * 0.85, organName: protName },
      });
    }
    return out;
  }, [protocol, mappings, structures]);

  const ntcpResults: NTCPResult[] = useMemo(
    () => oarPairs.map(p => evaluateNTCP(p.structure, p.protName, p.params, nFx, doseScale)),
    [oarPairs, nFx, doseScale]
  );

  const tcpResults: TCPResult[] = useMemo(
    () => ptvPairs.map(p => evaluateTCP(p.structure, p.protName, p.params, nFx, doseScale)),
    [ptvPairs, nFx, doseScale]
  );

  // Curves: NTCP vs dose scale (80..120%)
  const curveData = useMemo(() => {
    if (oarPairs.length === 0) return [];
    const points: any[] = [];
    for (let pct = 80; pct <= 120; pct += 2) {
      const scale = pct / 100;
      const row: any = { dose: pct };
      for (const p of oarPairs) {
        const r = evaluateNTCP(p.structure, p.protName, p.params, nFx, scale);
        row[p.structure.name] = +(r.NTCP * 100).toFixed(2);
      }
      points.push(row);
    }
    return points;
  }, [oarPairs, nFx]);

  const handleSaveParams = (next: Record<string, LKBParameters>) => {
    setOverrides(next);
    saveOverrides(next);
  };

  const colors = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--destructive))', 'hsl(var(--warning))', 'hsl(var(--success))', '#8884d8', '#82ca9d', '#ff7f50'];

  if (!protocol) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> Modélisation NTCP / TCP
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Sélectionnez un protocole pour estimer les risques de toxicité (NTCP) et le contrôle tumoral (TCP)
              à partir des DVH déjà chargés.
            </AlertDescription>
          </Alert>
          <Button onClick={onPickProtocol} className="gap-2">
            <Target className="w-4 h-4" /> Choisir un protocole
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" /> Modélisation NTCP / TCP
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Protocole : <span className="font-medium text-foreground">{protocol.name}</span>
              {totalDose > 0 && <> — {totalDose} Gy / {nFx} fx</>}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditorOpen(true)} className="gap-2">
            <Settings2 className="w-4 h-4" /> Paramètres LKB
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Simulation : dose prescrite × {doseScalePct}%</span>
              <Badge variant="outline">{(totalDose * doseScale).toFixed(1)} Gy équiv.</Badge>
            </div>
            <Slider
              value={[doseScalePct]}
              onValueChange={v => setDoseScalePct(v[0])}
              min={80} max={120} step={2}
            />
          </div>
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription className="text-xs">
              <strong>Outil de recherche / aide à la décision.</strong> Les modèles LKB et logistique fournissent
              une estimation populationnelle ; ils ne remplacent pas le jugement clinique. Paramètres par défaut :
              QUANTEC 2010 / Burman 1991 / Emami 1991.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* NTCP Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">NTCP — Risques OAR</CardTitle>
        </CardHeader>
        <CardContent>
          {ntcpResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun OAR du protocole n'a de paramètres LKB par défaut. Utilisez "Paramètres LKB" pour en ajouter.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Structure (DICOM)</TableHead>
                  <TableHead>Protocole</TableHead>
                  <TableHead className="text-right">EUD (Gy EQD2)</TableHead>
                  <TableHead className="text-right">TD50 / m / n</TableHead>
                  <TableHead className="text-right">NTCP</TableHead>
                  <TableHead>Endpoint</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ntcpResults.map(r => {
                  const sev = severity(r.NTCP);
                  return (
                    <TableRow key={r.structureName}>
                      <TableCell className="font-medium">{r.structureName}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{r.protocolStructureName}</TableCell>
                      <TableCell className="text-right font-mono">{r.EUD.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {r.params.TD50} / {r.params.m} / {r.params.n}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={sev.cls}>
                          {formatPct(r.NTCP)} · {sev.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.params.endpoint}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* TCP Table */}
      {tcpResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">TCP — Contrôle tumoral (modèle logistique)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PTV (DICOM)</TableHead>
                  <TableHead>Protocole</TableHead>
                  <TableHead className="text-right">EUD (Gy)</TableHead>
                  <TableHead className="text-right">TCD50 / γ50</TableHead>
                  <TableHead className="text-right">TCP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tcpResults.map(r => (
                  <TableRow key={r.structureName}>
                    <TableCell className="font-medium">{r.structureName}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{r.protocolStructureName}</TableCell>
                    <TableCell className="text-right font-mono">{r.EUD.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {r.params.TCD50.toFixed(1)} / {r.params.gamma50}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/40">
                        {formatPct(r.TCP)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Sensitivity curve */}
      {curveData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sensibilité — NTCP vs % dose prescrite</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curveData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dose" stroke="hsl(var(--muted-foreground))"
                         label={{ value: '% dose prescrite', position: 'insideBottom', offset: -5 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))"
                         label={{ value: 'NTCP (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                  <Legend />
                  <ReferenceLine x={doseScalePct} stroke="hsl(var(--accent))" strokeDasharray="3 3" />
                  {oarPairs.map((p, i) => (
                    <Line key={p.structure.name} type="monotone" dataKey={p.structure.name}
                          stroke={colors[i % colors.length]} dot={false} strokeWidth={2} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <NTCPParametersEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        currentPairs={oarPairs.map(p => ({ key: p.structure.name, params: p.params }))}
        overrides={overrides}
        onSave={handleSaveParams}
      />
    </div>
  );
};

export default NTCPTCPAnalysis;
