import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LKBParameters } from '@/types/ntcp';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentPairs: { key: string; params: LKBParameters }[];
  overrides: Record<string, LKBParameters>;
  onSave: (next: Record<string, LKBParameters>) => void;
}

export const NTCPParametersEditor = ({ open, onOpenChange, currentPairs, overrides, onSave }: Props) => {
  const [draft, setDraft] = useState<Record<string, LKBParameters>>({});

  useEffect(() => {
    if (open) {
      const init: Record<string, LKBParameters> = {};
      for (const p of currentPairs) init[p.key] = { ...(overrides[p.key] ?? p.params) };
      setDraft(init);
    }
  }, [open, currentPairs, overrides]);

  const update = (key: string, field: keyof LKBParameters, value: number) => {
    setDraft(d => ({ ...d, [key]: { ...d[key], [field]: value } }));
  };

  const handleSave = () => {
    onSave({ ...overrides, ...draft });
    onOpenChange(false);
  };

  const handleReset = () => {
    const next = { ...overrides };
    for (const p of currentPairs) delete next[p.key];
    onSave(next);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Paramètres LKB par structure</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {currentPairs.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune structure à éditer.</p>
          )}
          {currentPairs.map(p => {
            const d = draft[p.key] ?? p.params;
            return (
              <div key={p.key} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{p.key}</p>
                  <span className="text-xs text-muted-foreground">{d.endpoint}</span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">TD50 (Gy)</Label>
                    <Input type="number" step="0.1" value={d.TD50}
                           onChange={e => update(p.key, 'TD50', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label className="text-xs">m</Label>
                    <Input type="number" step="0.01" value={d.m}
                           onChange={e => update(p.key, 'm', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label className="text-xs">n</Label>
                    <Input type="number" step="0.05" value={d.n}
                           onChange={e => update(p.key, 'n', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label className="text-xs">α/β (Gy)</Label>
                    <Input type="number" step="0.5" value={d.alphaBeta}
                           onChange={e => update(p.key, 'alphaBeta', parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleReset}>Réinitialiser</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NTCPParametersEditor;
