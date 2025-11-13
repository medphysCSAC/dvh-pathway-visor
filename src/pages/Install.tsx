import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Smartphone, CheckCircle } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-foreground">DVH Analyzer</h1>
          <p className="text-muted-foreground">Application d'analyse radiothérapie</p>
        </header>

        {isInstalled ? (
          <Card className="border-primary">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-primary" />
                <CardTitle>Application installée!</CardTitle>
              </div>
              <CardDescription>
                L'application DVH Analyzer est maintenant installée sur votre appareil.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Vous pouvez la retrouver dans vos applications et l'utiliser même hors ligne.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-6 w-6" />
                  Installer l'application
                </CardTitle>
                <CardDescription>
                  Installez DVH Analyzer sur votre appareil pour un accès rapide et hors ligne
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {deferredPrompt ? (
                  <Button onClick={handleInstallClick} size="lg" className="w-full">
                    <Download className="mr-2 h-5 w-5" />
                    Installer maintenant
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Pour installer cette application sur votre appareil:
                    </p>
                    
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <Smartphone className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-medium">Sur iPhone/iPad:</p>
                          <p className="text-sm text-muted-foreground">
                            Appuyez sur le bouton "Partager" puis "Sur l'écran d'accueil"
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex gap-3">
                        <Smartphone className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-medium">Sur Android:</p>
                          <p className="text-sm text-muted-foreground">
                            Appuyez sur le menu (⋮) puis "Installer l'application" ou "Ajouter à l'écran d'accueil"
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t space-y-2">
                  <h4 className="font-medium">Avantages de l'installation:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Accès rapide depuis votre écran d'accueil</li>
                    <li>Fonctionne hors ligne</li>
                    <li>Données sauvegardées localement</li>
                    <li>Expérience application native</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Fonctionnalités principales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              <li>Analyse des courbes DVH (TomoTherapy compatible)</li>
              <li>Validation automatique des protocoles</li>
              <li>Calcul des métriques dosimétriques</li>
              <li>Gestion des protocoles personnalisés</li>
              <li>Export des rapports en PDF</li>
              <li>Fonctionnement 100% hors ligne</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
