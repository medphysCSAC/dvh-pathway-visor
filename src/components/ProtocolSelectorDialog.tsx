import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { ProtocolSelectorStep } from './ProtocolSelectorStep';
import { Structure } from '@/types/dvh';
import { TreatmentProtocol, StructureMapping } from '@/types/protocol';
import { autoMapStructures, saveGlobalMemory } from '@/utils/structureMappingUtils';

interface ProtocolSelectorDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  structures: Structure[];
  initialMappings?: StructureMapping[];
  initialProtocol?: TreatmentProtocol | null;
  onConfirm: (protocol: TreatmentProtocol, mappings: StructureMapping[]) => void;
}

type Step = 'select' | 'map';

export const ProtocolSelectorDialog = ({
  open,
  onOpenChange,
  structures,
  initialMappings = [],
  initialProtocol = null,
  onConfirm,
}: ProtocolSelectorDialogProps) => {
  const [step, setStep] = useState<Step>('select');
  const [picked, setPicked] = useState<TreatmentProtocol | null>(null);
  const [mappingMap, setMappingMap] = useState<Record<string, string>>({});

  // Reset à l'ouverture
  useEffect(() => {
    if (open) {
      setStep('select');
      setPicked(null);
      setMappingMap({});
    }
  }, [open]);

  const protocolStructureNames = useMemo(() => {
    if (!picked) return [];
    const ptvs = picked.prescriptions.map(p => p.ptvName);
    const oars = picked.oarConstraints.map(c => c.organName);
    return Array.from(new Set([...ptvs, ...oars]));
  }, [picked]);

  const dicomNames = useMemo(() => structures.map(s => s.name), [structures]);

  // Quand on entre en step map, déclencher l'auto-mapping
  useEffect(() => {
    if (step !== 'map' || !picked) return;
    const initialFromProps: Record<string, string> = {};
    initialMappings.forEach(m => { initialFromProps[m.protocolStructureName] = m.dvhStructureName; });
    const auto = autoMapStructures(dicomNames, protocolStructureNames);
    const next: Record<string, string> = { ...initialFromProps };
    auto.forEach(r => {
      if (!next[r.protocolStructureName] && r.matchedDicomName) {
        next[r.protocolStructureName] = r.matchedDicomName;
      }
    });
    setMappingMap(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, picked]);

  const handleProtocolSelected = (protocol: TreatmentProtocol) => {
    setPicked(protocol);
    setStep('map');
  };

  const handleConfirm = () => {
    if (!picked) return;
    const mappings: StructureMapping[] = Object.entries(mappingMap)
      .filter(([, dvh]) => dvh && dvh !== 'none')
      .map(([protocolStructureName, dvhStructureName]) => ({
        protocolStructureName,
        dvhStructureName,
      }));
    saveGlobalMemory(mappings);
    onConfirm(picked, mappings);
    onOpenChange(false);
  };

  const matchedCount = protocolStructureNames.filter(n => mappingMap[n] && mappingMap[n] !== 'none').length;
  const unmatchedNames = protocolStructureNames.filter(n => !mappingMap[n] || mappingMap[n] === 'none');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'select' ? 'Choisir un protocole' : `Associer les structures — ${picked?.name ?? ''}`}
          </DialogTitle>
        </DialogHeader>

        {step === 'select' && (
          <ProtocolSelectorStep
            structures={structures}
            onSelect={handleProtocolSelected}
            onSkip={() => onOpenChange(false)}
          />
        )}

        {step === 'map' && picked && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('select')}
                className="gap-1 -ml-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Changer de protocole
              </Button>
              <span className="ml-auto flex items-center gap-2 text-muted-foreground">
                <Sparkles className="w-4 h-4 text-accent" />
                {matchedCount}/{protocolStructureNames.length} structures associées
              </span>
            </div>

            {unmatchedNames.length === 0 ? (
              <Card className="border-success/40 bg-success/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <p className="text-sm">
                    Toutes les structures du protocole ont été associées automatiquement.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-warning/40 bg-warning/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  <p className="text-sm">
                    Vérifiez les correspondances ci-dessous. {unmatchedNames.length} structure(s) non associée(s).
                  </p>
                </CardContent>
              </Card>
            )}

            <ScrollArea className="h-80 rounded-md border">
              <div className="divide-y">
                {protocolStructureNames.map(protName => {
                  const isPTV = picked.prescriptions.some(p => p.ptvName === protName);
                  const value = mappingMap[protName] || 'none';
                  const isMatched = value !== 'none';
                  return (
                    <div key={protName} className="flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={isPTV ? 'default' : 'secondary'}
                            className="text-[10px]"
                          >
                            {isPTV ? 'PTV' : 'OAR'}
                          </Badge>
                          <span className="font-mono text-sm truncate">{protName}</span>
                        </div>
                      </div>
                      <div className="w-64">
                        <Select
                          value={value}
                          onValueChange={(v) =>
                            setMappingMap(prev => ({ ...prev, [protName]: v }))
                          }
                        >
                          <SelectTrigger className={!isMatched ? 'border-warning' : ''}>
                            <SelectValue placeholder="-- Non associée --" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <span className="text-muted-foreground">-- Non associée --</span>
                            </SelectItem>
                            {structures.map(s => (
                              <SelectItem key={s.name} value={s.name}>
                                <span className="flex items-center gap-2">
                                  <Badge
                                    variant={
                                      s.category === 'PTV'
                                        ? 'default'
                                        : s.category === 'OAR'
                                        ? 'destructive'
                                        : 'secondary'
                                    }
                                    className="text-[10px]"
                                  >
                                    {s.category}
                                  </Badge>
                                  <span className="font-mono text-xs">{s.name}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleConfirm}
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
              >
                Confirmer & analyser
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProtocolSelectorDialog;
