import { useState } from 'react';
import { ValidationReport } from '@/types/protocol';
import { ReportTemplate } from '@/utils/pdfGenerator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileDown } from 'lucide-react';

interface ExportReportDialogProps {
  report: ValidationReport | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (format: 'pdf', overallStatus: 'PASS' | 'FAIL', doctorName: string, template: ReportTemplate, observations?: string) => void;
  isExporting?: boolean;
}

export default function ExportReportDialog({ 
  report, 
  open, 
  onOpenChange, 
  onExport,
  isExporting = false
}: ExportReportDialogProps) {
  const [overallStatus, setOverallStatus] = useState<'PASS' | 'FAIL'>('PASS');
  const [doctorName, setDoctorName] = useState('');
  const [observations, setObservations] = useState('');
  const [template, setTemplate] = useState<ReportTemplate>('essential');

  const handleExport = () => {
    if (!doctorName.trim()) {
      return;
    }
    onExport('pdf', overallStatus, doctorName, template, observations);
  };

  if (!report) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Exporter le Rapport de Validation</DialogTitle>
          <DialogDescription>
            Configurez les paramètres avant d'exporter le rapport
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 h-full">
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Modèle de rapport</Label>
              <RadioGroup value={template} onValueChange={(v) => setTemplate(v as ReportTemplate)} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="essential" id="essential" />
                  <Label htmlFor="essential" className="font-normal cursor-pointer text-sm">
                    ⭐ Rapport Essentiel - Format ultra-compact (par défaut)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="official" id="official" />
                  <Label htmlFor="official" className="font-normal cursor-pointer text-sm">
                    📋 Rapport Officiel - Format complet institutionnel
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Statut global du plan</Label>
              <Select value={overallStatus} onValueChange={(v) => setOverallStatus(v as 'PASS' | 'FAIL')}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PASS">✅ PASS - Plan validé</SelectItem>
                  <SelectItem value="FAIL">❌ FAIL - Plan rejeté</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="doctor">Nom du médecin validateur *</Label>
              <Input
                id="doctor"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="Dr. Nom Prénom"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observations">Observations (facultatif)</Label>
              <Textarea 
                id="observations" 
                placeholder="Ajoutez vos observations ici..." 
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={3}
              />
            </div>

            <div className="bg-muted p-3 rounded-lg text-sm">
              <p className="font-medium mb-1">Nom du fichier :</p>
              <p className="text-muted-foreground font-mono text-xs break-all">
                {report.patientId}_{report.protocolName.replace(/\s+/g, '_')}_{new Date().toISOString().split('T')[0]}.pdf
              </p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={!doctorName.trim() || isExporting}
          >
            <FileDown className="h-4 w-4 mr-2" />
            {isExporting ? 'Export en cours...' : 'Exporter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
