import { useState, useEffect } from 'react';
import { Structure } from '@/types/dvh';
import { TreatmentProtocol, ValidationReport, StructureMapping as StructureMappingType } from '@/types/protocol';
import { getAllProtocols } from '@/data/predefinedProtocols';
import { generateValidationReport, findBestStructureMatch } from '@/utils/protocolValidator';
import { generateAndDownloadPDF, ReportTemplate } from '@/utils/pdfGenerator';
import { calculatePTVQualityMetrics } from '@/utils/planQualityMetrics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAnalysisHistory } from '@/hooks/useAnalysisHistory';
import { FileDown, FileText, AlertTriangle, CheckCircle2, XCircle, AlertCircle, Target } from 'lucide-react';
import StructureMapping from './StructureMapping';
import ExportReportDialog from './ExportReportDialog';

interface ProtocolValidationProps {
  structures: Structure[];
  patientId: string;
}

export default function ProtocolValidation({ structures, patientId }: ProtocolValidationProps) {
  const { toast } = useToast();
  const { addToHistory } = useAnalysisHistory();
  const [protocols, setProtocols] = useState<TreatmentProtocol[]>([]);
  const [selectedProtocolId, setSelectedProtocolId] = useState<string>('');
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [mappings, setMappings] = useState<StructureMappingType[]>([]);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  useEffect(() => {
    const loadProtocols = async () => {
      const allProtocols = await getAllProtocols();
      // Récupérer les protocoles archivés depuis localStorage
      const archivedProtocolIds = localStorage.getItem('archived-protocols');
      const archivedSet = archivedProtocolIds ? new Set(JSON.parse(archivedProtocolIds)) : new Set();
      // Filtrer les protocoles archivés
      const nonArchivedProtocols = allProtocols.filter(p => !archivedSet.has(p.id));
      setProtocols(nonArchivedProtocols);
    };
    loadProtocols();
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

    // Ajouter à l'historique
    addToHistory({
      patientId,
      protocolName: protocol.name,
      overallStatus: validationReport.overallStatus,
      report: validationReport,
    });

    const statusMessage = 
      validationReport.overallStatus === 'PASS' ? 'Toutes les contraintes sont respectées ✅' :
      validationReport.overallStatus === 'FAIL' ? 'Certaines contraintes obligatoires ne sont pas respectées ❌' :
      'Certaines contraintes optimales ne sont pas atteintes ⚠️';

    toast({
      title: 'Validation terminée',
      description: statusMessage,
    });
  };

  const handleExport = async (format: 'pdf', overallStatus: 'PASS' | 'FAIL', doctorName: string, template: ReportTemplate, observations?: string) => {
    if (!report) return;
    
    try {
      setIsExportingPDF(true);
      await generateAndDownloadPDF(report, template, overallStatus, doctorName, observations);
      setIsExportingPDF(false);
    } catch (error) {
      toast({
        title: 'Erreur d\'export',
        description: 'Impossible de générer le rapport',
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

      {selectedProtocol && (
        <StructureMapping
          unmatchedStructures={report ? report.unmatchedStructures : []}
          availableStructures={structures}
          onMappingsChange={setMappings}
          protocolId={selectedProtocolId}
          protocol={selectedProtocol}
          currentMappings={mappings}
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
                <Button 
                  onClick={() => setExportDialogOpen(true)} 
                  variant="default"
                  size="sm"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Exporter le Rapport
                </Button>
              </div>
            </CardHeader>
          </Card>


          {selectedProtocol && selectedProtocol.prescriptions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Évaluation des PTVs
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const ptvResults = selectedProtocol.prescriptions.map((prescription, idx) => {
                    const ptvStructure = findBestStructureMatch(
                      prescription.ptvName,
                      structures,
                      mappings
                    );
                    
                    if (!ptvStructure) {
                      return {
                        prescription,
                        structure: null,
                        metrics: null
                      };
                    }
                    
                    const metrics = calculatePTVQualityMetrics(
                      ptvStructure,
                      structures,
                      prescription.totalDose
                    );
                    
                    return {
                      prescription,
                      structure: ptvStructure,
                      metrics
                    };
                  });
                  
                  const foundPTVs = ptvResults.filter(r => r.structure !== null);
                  
                  if (foundPTVs.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">Aucun PTV trouvé</p>
                        <p className="text-sm mt-1">
                          Les PTVs du protocole ({selectedProtocol.prescriptions.map(p => p.ptvName).join(', ')}) 
                          n'ont pas été trouvés dans les structures DVH.
                        </p>
                        <p className="text-sm mt-2">
                          Utilisez le mapping manuel ci-dessous pour associer les structures.
                        </p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">PTV</th>
                            <th className="text-left p-2">D95%</th>
                            <th className="text-left p-2">D98%</th>
                            <th className="text-left p-2">D50%</th>
                            <th className="text-left p-2">D2%</th>
                            <th className="text-left p-2">HI</th>
                            <th className="text-left p-2">CI</th>
                            <th className="text-left p-2">CN</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ptvResults.map((result, idx) => {
                            if (!result.metrics || !result.structure) {
                              return (
                                <tr key={idx} className="border-b bg-destructive/5">
                                  <td className="p-2 font-medium text-destructive" colSpan={8}>
                                    <div className="flex items-center gap-2">
                                      <XCircle className="h-4 w-4" />
                                      {result.prescription.ptvName} - Non trouvé
                                    </div>
                                  </td>
                                </tr>
                              );
                            }
                            
                            return (
                              <tr key={idx} className="border-b">
                                <td className="p-2 font-medium">{result.metrics.structureName}</td>
                                <td className="p-2 font-mono">{result.metrics.d95.toFixed(2)} Gy</td>
                                <td className="p-2 font-mono">{result.metrics.d98.toFixed(2)} Gy</td>
                                <td className="p-2 font-mono">{result.metrics.d50.toFixed(2)} Gy</td>
                                <td className="p-2 font-mono">{result.metrics.d2.toFixed(2)} Gy</td>
                                <td className="p-2 font-mono">{result.metrics.hi.toFixed(3)}</td>
                                <td className="p-2 font-mono">{result.metrics.ci.toFixed(3)}</td>
                                <td className="p-2 font-mono">{result.metrics.cn.toFixed(3)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

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

                      // Déterminer l'unité correcte pour la valeur mesurée
                      const measuredUnit = cr.constraint.constraintType === 'Vx' 
                        ? (cr.constraint.targetUnit || '%')  // Pour Vx, utiliser targetUnit (cc ou %)
                        : cr.constraint.unit;  // Pour Dmax, Dmean, Dx: toujours Gy

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
                            {cr.measuredValue.toFixed(1)} {measuredUnit}
                          </td>
                          <td className="p-2 font-mono">
                            &lt; {cr.constraint.value} {measuredUnit}
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={
                                  cr.status === 'PASS' ? 'default' : 
                                  cr.status === 'FAIL' ? 'destructive' : 
                                  'secondary'
                                }
                                className={`gap-1 ${
                                  cr.status === 'PASS' ? 'bg-green-600 hover:bg-green-700 text-white' : 
                                  cr.status === 'WARNING' ? 'bg-orange-500 hover:bg-orange-600 text-white' : 
                                  ''
                                }`}
                              >
                                {getStatusIcon(cr.status)}
                                {cr.status}
                              </Badge>
                              {cr.status === 'WARNING' && (
                                <span className="text-xs text-muted-foreground">
                                  (contrainte optimale)
                                </span>
                              )}
                            </div>
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

      <ExportReportDialog
        report={report}
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={handleExport}
        isExporting={isExportingPDF}
      />
    </div>
  );
}
