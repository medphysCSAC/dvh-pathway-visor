import { useState, useEffect } from 'react';
import { Structure } from '@/types/dvh';
import { TreatmentProtocol, ValidationReport, StructureMapping as StructureMappingType } from '@/types/protocol';
import { getAllProtocols } from '@/data/predefinedProtocols';
import { generateValidationReport } from '@/utils/protocolValidator';
import { downloadHTMLReport, downloadPDFReport } from '@/utils/reportGenerator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { FileDown, FileText, AlertTriangle, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import StructureMapping from './StructureMapping';

interface ProtocolValidationProps {
  structures: Structure[];
  patientId: string;
}

export default function ProtocolValidation({ structures, patientId }: ProtocolValidationProps) {
  const { toast } = useToast();
  const [protocols, setProtocols] = useState<TreatmentProtocol[]>([]);
  const [selectedProtocolId, setSelectedProtocolId] = useState<string>('');
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [mappings, setMappings] = useState<StructureMappingType[]>([]);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  useEffect(() => {
    const allProtocols = getAllProtocols();
    setProtocols(allProtocols);
  }, []);

  const handleProtocolChange = (protocolId: string) => {
    setSelectedProtocolId(protocolId);
    setReport(null);
    setMappings([]);
  };

  const handleValidate = () => {
    const protocol = protocols.find(p => p.id === selectedProtocolId);
    if (!protocol) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner un protocole',
        variant: 'destructive',
      });
      return;
    }

    const validationReport = generateValidationReport(protocol, structures, patientId, mappings);
    setReport(validationReport);

    const statusMessage = 
      validationReport.overallStatus === 'PASS' ? 'Toutes les contraintes sont respectées ✅' :
      validationReport.overallStatus === 'FAIL' ? 'Certaines contraintes obligatoires ne sont pas respectées ❌' :
      'Certaines contraintes optimales ne sont pas atteintes ⚠️';

    toast({
      title: 'Validation terminée',
      description: statusMessage,
    });
  };

  const handleExportHTML = () => {
    if (!report) return;
    downloadHTMLReport(report);
  };

  const handleExportPDF = async () => {
    if (!report) return;
    
    setIsExportingPDF(true);
    toast({
      title: 'Génération du PDF...',
      description: 'Veuillez patienter',
    });

    try {
      await downloadPDFReport(report);
      toast({
        title: 'PDF exporté',
        description: 'Le rapport PDF a été téléchargé avec succès',
      });
    } catch (error) {
      toast({
        title: 'Erreur d\'export',
        description: 'Impossible de générer le PDF',
        variant: 'destructive',
      });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const getStatusIcon = (status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_EVALUATED') => {
    switch (status) {
      case 'PASS':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'FAIL':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'WARNING':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_EVALUATED') => {
    const variants = {
      PASS: 'default',
      FAIL: 'destructive',
      WARNING: 'secondary',
      NOT_EVALUATED: 'outline',
    } as const;

    return (
      <Badge variant={variants[status]} className="gap-1">
        {getStatusIcon(status)}
        {status}
      </Badge>
    );
  };

  const selectedProtocol = protocols.find(p => p.id === selectedProtocolId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Validation du Plan de Traitement</CardTitle>
          <CardDescription>
            Sélectionnez un protocole pour valider les contraintes de dose selon les standards cliniques
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-2 block">Protocole</label>
              <Select value={selectedProtocolId} onValueChange={handleProtocolChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un protocole..." />
                </SelectTrigger>
                <SelectContent>
                  {protocols.map(protocol => (
                    <SelectItem key={protocol.id} value={protocol.id}>
                      {protocol.name}
                      {protocol.isCustom && ' (Personnalisé)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Patient ID</label>
              <div className="h-10 px-3 border rounded-md flex items-center bg-muted">
                <span className="font-mono">{patientId}</span>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleValidate} 
            disabled={!selectedProtocolId}
            className="w-full"
          >
            Lancer la validation
          </Button>
        </CardContent>
      </Card>

      {selectedProtocol && report && report.unmatchedStructures.length > 0 && (
        <StructureMapping
          unmatchedStructures={report.unmatchedStructures}
          availableStructures={structures}
          onMappingsChange={setMappings}
          protocolId={selectedProtocolId}
        />
      )}

      {report && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    Résultats de la Validation
                  </CardTitle>
                  <CardDescription>
                    Protocole : {report.protocolName} • Patient : {report.patientId}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleExportHTML} variant="outline" size="sm">
                    <FileText className="h-4 w-4 mr-2" />
                    Export HTML
                  </Button>
                  <Button 
                    onClick={handleExportPDF} 
                    variant="outline" 
                    size="sm"
                    disabled={isExportingPDF}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    {isExportingPDF ? 'Génération...' : 'Export PDF'}
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📋 Prescriptions de Dose</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Volume Cible (PTV)</th>
                      <th className="text-left p-2">Dose Totale</th>
                      <th className="text-left p-2">Fractions</th>
                      <th className="text-left p-2">Dose/Fraction</th>
                      <th className="text-left p-2">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.prescriptionResults.map((pr, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2 font-medium">{pr.prescription.ptvName}</td>
                        <td className="p-2">{pr.prescription.totalDose} Gy</td>
                        <td className="p-2">{pr.prescription.numberOfFractions}</td>
                        <td className="p-2">{pr.prescription.dosePerFraction} Gy</td>
                        <td className="p-2">
                          {pr.isCoherent ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Cohérent
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              Incohérent
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {report.prescriptionResults.some(pr => pr.warnings.length > 0) && (
                <div className="mt-4 space-y-2">
                  {report.prescriptionResults.map((pr, idx) =>
                    pr.warnings.length > 0 ? (
                      <div key={idx} className="bg-warning/10 border border-warning/20 p-3 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            {pr.warnings.map((warning, wIdx) => (
                              <p key={wIdx} className="text-sm">{warning}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🛡️ Contraintes OAR (Organes à Risque)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Organe</th>
                      <th className="text-left p-2">Contrainte</th>
                      <th className="text-left p-2">Mesuré</th>
                      <th className="text-left p-2">Seuil</th>
                      <th className="text-left p-2">Observation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.constraintResults.map((cr, idx) => {
                      const constraintDesc = 
                        cr.constraint.constraintType === 'Vx' ? `V${cr.constraint.target}Gy` :
                        cr.constraint.constraintType === 'Dx' ? `D${cr.constraint.target}%` :
                        cr.constraint.constraintType;

                      return (
                        <tr key={idx} className="border-b">
                          <td className="p-2">
                            <div className="font-medium">{cr.structureName}</div>
                            {cr.constraint.description && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {cr.constraint.description}
                              </div>
                            )}
                          </td>
                          <td className="p-2 font-mono text-sm">{constraintDesc}</td>
                          <td className="p-2 font-mono">
                            {cr.measuredValue.toFixed(1)} {cr.constraint.unit}
                          </td>
                          <td className="p-2 font-mono">
                            &lt; {cr.constraint.value} {cr.constraint.unit}
                          </td>
                          <td className="p-2">
                            {cr.message}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {report.unmatchedStructures.length > 0 && (
            <Card className="border-warning">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-5 w-5" />
                  Structures Non Trouvées
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-2">
                  Les structures suivantes du protocole n'ont pas été trouvées dans le fichier DVH :
                </p>
                <div className="flex flex-wrap gap-2">
                  {report.unmatchedStructures.map(structure => (
                    <Badge key={structure} variant="outline">
                      {structure}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  💡 Utilisez le mapping manuel ci-dessus pour faire correspondre ces structures avec celles disponibles dans votre fichier DVH.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
