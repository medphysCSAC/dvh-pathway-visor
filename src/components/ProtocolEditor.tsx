import { useState } from 'react';
import { TreatmentProtocol, PrescriptionDose, OARConstraint, ConstraintType } from '@/types/protocol';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Save } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ProtocolEditorProps {
  protocol: TreatmentProtocol;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (protocol: TreatmentProtocol) => void;
}

export default function ProtocolEditor({ protocol, open, onOpenChange, onSave }: ProtocolEditorProps) {
  const { toast } = useToast();
  const [editedProtocol, setEditedProtocol] = useState<TreatmentProtocol>(JSON.parse(JSON.stringify(protocol)));

  const handleSave = () => {
    if (!editedProtocol.name.trim()) {
      toast({
        title: 'Erreur',
        description: 'Le nom du protocole est requis',
        variant: 'destructive',
      });
      return;
    }

    onSave({
      ...editedProtocol,
      modifiedAt: new Date(),
    });

    toast({
      title: 'Protocole enregistré',
      description: 'Les modifications ont été enregistrées avec succès',
    });
    onOpenChange(false);
  };

  const addPrescription = () => {
    setEditedProtocol({
      ...editedProtocol,
      prescriptions: [
        ...editedProtocol.prescriptions,
        { ptvName: '', totalDose: 0, numberOfFractions: 0, dosePerFraction: 0 }
      ]
    });
  };

  const removePrescription = (index: number) => {
    setEditedProtocol({
      ...editedProtocol,
      prescriptions: editedProtocol.prescriptions.filter((_, i) => i !== index)
    });
  };

  const updatePrescription = (index: number, field: keyof PrescriptionDose, value: any) => {
    const newPrescriptions = [...editedProtocol.prescriptions];
    newPrescriptions[index] = { ...newPrescriptions[index], [field]: value };
    
    // Auto-calculer les doses si nécessaire
    if (field === 'totalDose' || field === 'numberOfFractions') {
      const p = newPrescriptions[index];
      if (p.totalDose && p.numberOfFractions) {
        p.dosePerFraction = p.totalDose / p.numberOfFractions;
      }
    } else if (field === 'dosePerFraction' && newPrescriptions[index].numberOfFractions) {
      newPrescriptions[index].totalDose = value * newPrescriptions[index].numberOfFractions;
    }
    
    setEditedProtocol({ ...editedProtocol, prescriptions: newPrescriptions });
  };

  const addConstraint = () => {
    setEditedProtocol({
      ...editedProtocol,
      oarConstraints: [
        ...editedProtocol.oarConstraints,
        {
          organName: '',
          constraintType: 'Dmax',
          value: 0,
          unit: 'Gy',
          priority: 'optimal',
        }
      ]
    });
  };

  const removeConstraint = (index: number) => {
    setEditedProtocol({
      ...editedProtocol,
      oarConstraints: editedProtocol.oarConstraints.filter((_, i) => i !== index)
    });
  };

  const updateConstraint = (index: number, field: keyof OARConstraint, value: any) => {
    const newConstraints = [...editedProtocol.oarConstraints];
    newConstraints[index] = { ...newConstraints[index], [field]: value };
    setEditedProtocol({ ...editedProtocol, oarConstraints: newConstraints });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Éditer le Protocole</DialogTitle>
          <DialogDescription>
            Modifiez les informations, prescriptions et contraintes du protocole
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Informations générales */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Informations Générales</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="name">Nom du protocole *</Label>
                  <Input
                    id="name"
                    value={editedProtocol.name}
                    onChange={(e) => setEditedProtocol({ ...editedProtocol, name: e.target.value })}
                    placeholder="Ex: Prostate 60Gy"
                  />
                </div>
                <div>
                  <Label htmlFor="location">Localisation anatomique</Label>
                  <Input
                    id="location"
                    value={editedProtocol.location}
                    onChange={(e) => setEditedProtocol({ ...editedProtocol, location: e.target.value })}
                    placeholder="Ex: Prostate"
                  />
                </div>
              </div>
            </div>

            <Tabs defaultValue="prescriptions" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="prescriptions">Prescriptions ({editedProtocol.prescriptions.length})</TabsTrigger>
                <TabsTrigger value="constraints">Contraintes OAR ({editedProtocol.oarConstraints.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="prescriptions" className="space-y-4 mt-4">
                {editedProtocol.prescriptions.map((presc, idx) => (
                  <div key={idx} className="border rounded-lg p-4 space-y-3 bg-muted/50">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Prescription {idx + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePrescription(idx)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <Label>Nom du PTV</Label>
                        <Input
                          value={presc.ptvName}
                          onChange={(e) => updatePrescription(idx, 'ptvName', e.target.value)}
                          placeholder="Ex: PTV_60"
                        />
                      </div>
                      <div>
                        <Label>Dose totale (Gy)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={presc.totalDose}
                          onChange={(e) => updatePrescription(idx, 'totalDose', parseFloat(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label>Nombre de fractions</Label>
                        <Input
                          type="number"
                          value={presc.numberOfFractions}
                          onChange={(e) => updatePrescription(idx, 'numberOfFractions', parseInt(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label>Dose par fraction (Gy)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={presc.dosePerFraction.toFixed(2)}
                          onChange={(e) => updatePrescription(idx, 'dosePerFraction', parseFloat(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <Button onClick={addPrescription} variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter une prescription
                </Button>
              </TabsContent>

              <TabsContent value="constraints" className="space-y-4 mt-4">
                {editedProtocol.oarConstraints.map((constraint, idx) => (
                  <div key={idx} className="border rounded-lg p-4 space-y-3 bg-muted/50">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Contrainte {idx + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeConstraint(idx)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <Label>Organe à risque</Label>
                        <Input
                          value={constraint.organName}
                          onChange={(e) => updateConstraint(idx, 'organName', e.target.value)}
                          placeholder="Ex: Rectum"
                        />
                      </div>
                      <div>
                        <Label>Type de contrainte</Label>
                        <Select
                          value={constraint.constraintType}
                          onValueChange={(v) => updateConstraint(idx, 'constraintType', v as ConstraintType)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Dmax">Dmax - Dose maximale</SelectItem>
                            <SelectItem value="Dmean">Dmean - Dose moyenne</SelectItem>
                            <SelectItem value="Vx">Vx - Volume recevant X Gy</SelectItem>
                            <SelectItem value="Dx">Dx - Dose reçue par X% du volume</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {(constraint.constraintType === 'Vx' || constraint.constraintType === 'Dx') && (
                        <div>
                          <Label>{constraint.constraintType === 'Vx' ? 'Dose (Gy)' : 'Volume (%)'}</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={constraint.target || 0}
                            onChange={(e) => updateConstraint(idx, 'target', parseFloat(e.target.value))}
                          />
                        </div>
                      )}
                      <div>
                        <Label>Valeur seuil</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={constraint.value}
                          onChange={(e) => updateConstraint(idx, 'value', parseFloat(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label>Unité</Label>
                        <Select
                          value={constraint.unit}
                          onValueChange={(v) => updateConstraint(idx, 'unit', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Gy">Gy</SelectItem>
                            <SelectItem value="%">%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Priorité</Label>
                        <Select
                          value={constraint.priority}
                          onValueChange={(v) => updateConstraint(idx, 'priority', v as any)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mandatory">Obligatoire</SelectItem>
                            <SelectItem value="optimal">Optimal</SelectItem>
                            <SelectItem value="desirable">Souhaitable</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2">
                        <Label>Description (optionnel)</Label>
                        <Input
                          value={constraint.description || ''}
                          onChange={(e) => updateConstraint(idx, 'description', e.target.value)}
                          placeholder="Description ou note"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <Button onClick={addConstraint} variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter une contrainte
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
