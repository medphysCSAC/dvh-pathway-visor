import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const CompactReportPreview = () => {

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
              <h1 className="text-xl font-bold">Prévisualisation des rapports</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="p-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Rapports de Validation</h2>
          <p className="text-muted-foreground mb-6">
            Les rapports sont désormais disponibles uniquement via l'export PDF depuis l'interface principale.
          </p>
          <div className="max-w-2xl mx-auto text-left space-y-4 text-sm text-muted-foreground">
            <p><strong>Deux modèles disponibles :</strong></p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Rapport Essentiel</strong> - Format ultra-compact par défaut</li>
              <li><strong>Rapport Officiel</strong> - Format complet institutionnel</li>
            </ul>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default CompactReportPreview;
