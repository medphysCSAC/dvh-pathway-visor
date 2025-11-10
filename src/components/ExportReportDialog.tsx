import { useState } from 'react';
import { ValidationReport } from '@/types/protocol';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown } from 'lucide-react';

interface ExportReportDialogProps {
  report: ValidationReport | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (format: 'html' | 'pdf', overallStatus: 'PASS' | 'FAIL', doctorName: string) => void;
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
  const [exportFormat, setExportFormat] = useState<'html' | 'pdf'>('pdf');

  const handleExport = () => {
    if (!doctorName.trim()) {
      return;
    }
    onExport(exportFormat, overallStatus, doctorName);
  };

  if (!report) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exporter le Rapport de Validation</DialogTitle>
          <DialogDescription>
            Configurez les paramètres avant d'exporter le rapport
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="format">Format d'export</Label>
            <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as 'html' | 'pdf')}>
              <SelectTrigger id="format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
              </SelectContent>
            </Select>
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

          <div className="bg-muted p-3 rounded-lg text-sm">
            <p className="font-medium mb-1">Nom du fichier :</p>
            <p className="text-muted-foreground font-mono text-xs break-all">
              {report.patientId}_{report.protocolName.replace(/\s+/g, '_')}_{new Date().toISOString().split('T')[0]}.{exportFormat}
            </p>
          </div>
        </div>

        <DialogFooter>
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
