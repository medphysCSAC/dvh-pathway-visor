import { useState } from 'react';
import { TreatmentProtocol, PrescriptionDose, OARConstraint, ConstraintType } from '@/types/protocol';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Save, MoveUp, MoveDown } from 'lucide-react';
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
  const [prescriptionToDelete, setPrescriptionToDelete] = useState<number | null>(null);
  const [constraintToDelete, setConstraintToDelete] = useState<number | null>(null);

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
          targetUnit: '%',
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
    setEditedProtocol((prev) => {
      const newConstraints = [...prev.oarConstraints];
      newConstraints[index] = { ...newConstraints[index], [field]: value };
      return { ...prev, oarConstraints: newConstraints };
    });
  };

  const movePrescription = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === editedProtocol.prescriptions.length - 1)) {
      return;
    }
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newPrescriptions = [...editedProtocol.prescriptions];
    [newPrescriptions[index], newPrescriptions[newIndex]] = [newPrescriptions[newIndex], newPrescriptions[index]];
    setEditedProtocol({ ...editedProtocol, prescriptions: newPrescriptions });
  };

  const moveConstraint = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === editedProtocol.oarConstraints.length - 1)) {
      return;
    }
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newConstraints = [...editedProtocol.oarConstraints];
    [newConstraints[index], newConstraints[newIndex]] = [newConstraints[newIndex], newConstraints[index]];
    setEditedProtocol({ ...editedProtocol, oarConstraints: newConstraints });
  };

  const moveConstraintToPosition = (fromIndex: number, toPosition: number) => {
    const newPosition = Math.max(1, Math.min(toPosition, editedProtocol.oarConstraints.length)) - 1;
    if (fromIndex === newPosition) return;
    
    const newConstraints = [...editedProtocol.oarConstraints];
    const [removed] = newConstraints.splice(fromIndex, 1);
    newConstraints.splice(newPosition, 0, removed);
    setEditedProtocol({ ...editedProtocol, oarConstraints: newConstraints });
  };

  const movePrescriptionToPosition = (fromIndex: number, toPosition: number) => {
    const newPosition = Math.max(1, Math.min(toPosition, editedProtocol.prescriptions.length)) - 1;
    if (fromIndex === newPosition) return;
    
    const newPrescriptions = [...editedProtocol.prescriptions];
    const [removed] = newPrescriptions.splice(fromIndex, 1);
    newPrescriptions.splice(newPosition, 0, removed);
    setEditedProtocol({ ...editedProtocol, prescriptions: newPrescriptions });
  };

  // Tri alphabétique des prescriptions et contraintes
  const sortPrescriptionsAlphabetically = () => {
    const sorted = [...editedProtocol.prescriptions].sort((a, b) => a.ptvName.localeCompare(b.ptvName));
    setEditedProtocol({ ...editedProtocol, prescriptions: sorted });
  };

  const sortConstraintsAlphabetically = () => {
    const sorted = [...editedProtocol.oarConstraints].sort((a, b) => a.organName.localeCompare(b.organName));
    setEditedProtocol({ ...editedProtocol, oarConstraints: sorted });
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
                <div className="flex justify-end mb-2">
                  <Button onClick={sortPrescriptionsAlphabetically} variant="outline" size="sm">
                    Trier alphabétiquement
                  </Button>
                </div>
                {editedProtocol.prescriptions.map((presc, idx) => (
                  <div key={idx} className="border rounded-lg p-4 space-y-3 bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Prescription</span>
                        <Input
                          type="number"
                          min="1"
                          max={editedProtocol.prescriptions.length}
                          value={idx + 1}
                          onChange={(e) => {
                            const newPos = parseInt(e.target.value);
                            if (!isNaN(newPos)) movePrescriptionToPosition(idx, newPos);
                          }}
                          className="w-16 h-8 text-center"
                        />
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => movePrescription(idx, 'up')}
                          disabled={idx === 0}
                        >
                          <MoveUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => movePrescription(idx, 'down')}
                          disabled={idx === editedProtocol.prescriptions.length - 1}
                        >
                          <MoveDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPrescriptionToDelete(idx)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
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
                <div className="flex justify-end mb-2">
                  <Button onClick={sortConstraintsAlphabetically} variant="outline" size="sm">
                    Trier alphabétiquement
                  </Button>
                </div>
                {editedProtocol.oarConstraints.map((constraint, idx) => (
                  <div key={idx} className="border rounded-lg p-4 space-y-3 bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Contrainte</span>
                        <Input
                          type="number"
                          min="1"
                          max={editedProtocol.oarConstraints.length}
                          value={idx + 1}
                          onChange={(e) => {
                            const newPos = parseInt(e.target.value);
                            if (!isNaN(newPos)) moveConstraintToPosition(idx, newPos);
                          }}
                          className="w-16 h-8 text-center"
                        />
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveConstraint(idx, 'up')}
                          disabled={idx === 0}
                        >
                          <MoveUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveConstraint(idx, 'down')}
                          disabled={idx === editedProtocol.oarConstraints.length - 1}
                        >
                          <MoveDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConstraintToDelete(idx)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
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
                          onValueChange={(v) => {
                            updateConstraint(idx, 'constraintType', v as ConstraintType);
                            // Initialiser l'unité et targetUnit en fonction du type
                            if (v === 'Dx' || v === 'Dmax' || v === 'Dmean') {
                              updateConstraint(idx, 'unit', 'Gy');
                            } else if (v === 'Vx') {
                              updateConstraint(idx, 'unit', 'Gy');
                              if (!constraint.targetUnit) {
                                updateConstraint(idx, 'targetUnit', '%');
                              }
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="z-50">
                            <SelectItem value="Dmax">Dose maximale (Dmax)</SelectItem>
                            <SelectItem value="Dmean">Dose moyenne (Dmean)</SelectItem>
                            <SelectItem value="Vx">Volume recevant une dose (Vx)</SelectItem>
                            <SelectItem value="Dx">Dose reçue par un volume (Dx)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Pour Vx : besoin de la dose seuil en Gy et choix de l'unité du résultat */}
                      {constraint.constraintType === 'Vx' && (
                        <>
                          <div>
                            <Label>Dose seuil (Gy)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={constraint.target || ''}
                              onChange={(e) => updateConstraint(idx, 'target', parseFloat(e.target.value))}
                              placeholder="Ex: 40.8"
                            />
                          </div>
                          <div>
                            <Label>Unité du résultat</Label>
                            <Select
                              value={constraint.targetUnit || '%'}
                              onValueChange={(v) => updateConstraint(idx, 'targetUnit', v as '%' | 'cc')}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="z-50">
                                <SelectItem value="%">% (pourcentage du volume)</SelectItem>
                                <SelectItem value="cc">cc (volume absolu)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      {/* Pour Dx : besoin du volume en % */}
                      {constraint.constraintType === 'Dx' && (
                        <div>
                          <Label>Volume (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={constraint.target || ''}
                            onChange={(e) => updateConstraint(idx, 'target', parseFloat(e.target.value))}
                            placeholder="Ex: 50"
                          />
                        </div>
                      )}

                      <div>
                        <Label>
                          {constraint.constraintType === 'Vx' 
                            ? `Valeur maximum (${constraint.targetUnit || '%'})`
                            : constraint.constraintType === 'Dx' 
                            ? 'Dose maximum (Gy)' 
                            : 'Dose maximum (Gy)'}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={constraint.value}
                          onChange={(e) => updateConstraint(idx, 'value', parseFloat(e.target.value))}
                          placeholder={
                            constraint.constraintType === 'Vx' 
                              ? (constraint.targetUnit === 'cc' ? 'Ex: 17' : 'Ex: 50')
                              : constraint.constraintType === 'Dx' 
                              ? 'Ex: 30' 
                              : 'Ex: 45'
                          }
                        />
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

      {/* Confirmation suppression prescription */}
      <AlertDialog open={prescriptionToDelete !== null} onOpenChange={() => setPrescriptionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment supprimer cette prescription ? Cette action ne peut pas être annulée après l'enregistrement du protocole.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (prescriptionToDelete !== null) {
                  removePrescription(prescriptionToDelete);
                  setPrescriptionToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation suppression contrainte */}
      <AlertDialog open={constraintToDelete !== null} onOpenChange={() => setConstraintToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment supprimer cette contrainte OAR ? Cette action ne peut pas être annulée après l'enregistrement du protocole.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (constraintToDelete !== null) {
                  removeConstraint(constraintToDelete);
                  setConstraintToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
