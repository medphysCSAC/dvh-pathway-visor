import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, FileDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { generateCompactHTMLReport } from '@/utils/reportGenerator';
import { ValidationReport } from '@/types/protocol';

const CompactReportPreview = () => {
  const [reportHTML, setReportHTML] = useState<string>('');

  // Données de test pour générer un rapport exemple
  const sampleReport: ValidationReport = {
    protocolName: 'Sein Gauche Boost 45-50-66 Gy',
    patientId: '2024-001-DEMO',
    evaluationDate: new Date(),
    overallStatus: 'WARNING',
    prescriptionResults: [
      {
        prescription: {
          ptvName: 'PTV_45Gy',
          totalDose: 45,
          numberOfFractions: 25,
          dosePerFraction: 1.8
        },
        isCoherent: true,
        warnings: []
      },
      {
        prescription: {
          ptvName: 'PTV_50Gy',
          totalDose: 50,
          numberOfFractions: 28,
          dosePerFraction: 1.8
        },
        isCoherent: true,
        warnings: []
      }
    ],
    constraintResults: [
      {
        constraint: {
          organName: 'Coeur',
          constraintType: 'Dmean',
          value: 4,
          unit: 'Gy',
          priority: 'mandatory',
          description: 'Dose moyenne au coeur'
        },
        structureName: 'Heart',
        measuredValue: 3.2,
        status: 'PASS',
        message: 'Contrainte respectée'
      },
      {
        constraint: {
          organName: 'Poumon Gauche',
          constraintType: 'Vx',
          value: 20,
          unit: '%',
          target: 20,
          targetUnit: '%',
          priority: 'mandatory',
          description: 'Volume du poumon gauche recevant 20 Gy'
        },
        structureName: 'Lung_L',
        measuredValue: 18.5,
        status: 'PASS'
      },
      {
        constraint: {
          organName: 'Poumon Droit',
          constraintType: 'Vx',
          value: 15,
          unit: '%',
          target: 20,
          targetUnit: '%',
          priority: 'optimal',
          description: 'Volume du poumon droit recevant 20 Gy'
        },
        structureName: 'Lung_R',
        measuredValue: 8.2,
        status: 'PASS'
      },
      {
        constraint: {
          organName: 'Moelle Épinière',
          constraintType: 'Dmax',
          value: 45,
          unit: 'Gy',
          priority: 'mandatory',
          description: 'Dose maximale à la moelle'
        },
        structureName: 'SpinalCord',
        measuredValue: 38.5,
        status: 'PASS'
      },
      {
        constraint: {
          organName: 'Sein Controlatéral',
          constraintType: 'Dmean',
          value: 3,
          unit: 'Gy',
          priority: 'optimal',
          description: 'Dose moyenne au sein controlatéral'
        },
        structureName: 'Breast_R',
        measuredValue: 4.2,
        status: 'WARNING',
        message: 'Légèrement au-dessus de la valeur optimale'
      },
      {
        constraint: {
          organName: 'Thyroïde',
          constraintType: 'Dmax',
          value: 45,
          unit: 'Gy',
          priority: 'desirable',
          description: 'Dose maximale à la thyroïde'
        },
        structureName: 'Thyroid',
        measuredValue: 52.3,
        status: 'FAIL',
        message: 'Dépassement de la contrainte souhaitable'
      }
    ],
    unmatchedStructures: [],
    planSummary: {
      primaryPTV: 'PTV_50Gy',
      prescriptionDose: 50,
      ptvCount: 2,
      oarCount: 6
    },
    ptvQualityMetrics: [
      {
        structureName: 'PTV_45Gy',
        d95: 44.2,
        d98: 43.8,
        d50: 46.5,
        d2: 48.2,
        v95: 98.2,
        hi: 0.095,
        ci: 1.02,
        cn: 0.89
      },
      {
        structureName: 'PTV_50Gy',
        d95: 49.1,
        d98: 48.5,
        d50: 51.2,
        d2: 53.8,
        v95: 97.5,
        hi: 0.104,
        ci: 0.95,
        cn: 0.91
      }
    ]
  };

  const handleGenerateReport = () => {
    const html = generateCompactHTMLReport(
      sampleReport,
      'PASS',
      'Dr. Dupont Jean-Pierre'
    );
    setReportHTML(html);
  };

  const handleDownloadHTML = () => {
    const blob = new Blob([reportHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Rapport_Compact_Preview_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
              </Link>
              <h1 className="text-xl font-bold">Prévisualisation du Rapport Compact</h1>
            </div>
            <div className="flex gap-2">
              {!reportHTML && (
                <Button onClick={handleGenerateReport}>
                  Générer le rapport compact
                </Button>
              )}
              {reportHTML && (
                <Button onClick={handleDownloadHTML} variant="outline">
                  <FileDown className="h-4 w-4 mr-2" />
                  Télécharger HTML
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!reportHTML ? (
          <Card className="p-12 text-center">
            <h2 className="text-2xl font-bold mb-4">Rapport Compact de Démonstration</h2>
            <p className="text-muted-foreground mb-6">
              Cliquez sur le bouton ci-dessus pour générer un exemple de rapport compact
              avec des données de test.
            </p>
            <div className="max-w-2xl mx-auto text-left space-y-4 text-sm text-muted-foreground">
              <p><strong>Le rapport compact inclut :</strong></p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>En-tête institutionnel (Centre Sidi Abdellah de Cancérologie)</li>
                <li>Résumé exécutif avec statut global</li>
                <li>Évaluation des volumes cibles (PTVs) avec métriques de qualité</li>
                <li>Contraintes des organes à risque (OARs)</li>
                <li>Section validation et signature (protégée contre les coupures de page)</li>
              </ul>
              <p className="mt-4 text-xs italic">
                Note : Ce format compact exclut les sections "Informations patient et prescriptions" 
                et "Métadonnées et traçabilité" pour un rapport plus concis.
              </p>
            </div>
          </Card>
        ) : (
          <div className="bg-white border rounded-lg shadow-lg overflow-hidden">
            <div 
              dangerouslySetInnerHTML={{ __html: reportHTML }}
              className="w-full"
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default CompactReportPreview;
