import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUp, BarChart3, CheckCircle, FileText, History, BookOpen } from "lucide-react";

const HelpGuide = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            Guide d'utilisation
          </CardTitle>
          <CardDescription>
            Apprenez à utiliser DVH Analyzer pour analyser vos plans de traitement de tomotherapy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {/* Section 1: Upload de fichiers */}
            <AccordionItem value="upload">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-3">
                  <FileUp className="w-5 h-5 text-primary" />
                  <span className="font-semibold">1. Chargement des fichiers DVH</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-muted-foreground">
                <div className="space-y-3">
                  <p className="font-medium text-foreground">Comment charger vos fichiers :</p>
                  <ol className="list-decimal list-inside space-y-2 ml-2">
                    <li>Cliquez sur l'onglet <strong>"Charger un plan"</strong> si vous êtes sur la page d'accueil</li>
                    <li>Sélectionnez le fichier DVH REL (dose relative - obligatoire)</li>
                    <li>Sélectionnez le fichier DVH ABS (dose absolue - optionnel mais recommandé)</li>
                    <li>Cliquez sur <strong>"Analyser les fichiers"</strong></li>
                  </ol>
                  
                  <div className="bg-muted/50 p-4 rounded-lg border mt-4">
                    <p className="font-medium text-foreground mb-2">⚠️ Points importants :</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Le fichier DVH REL est obligatoire pour l'analyse</li>
                      <li>Le fichier DVH ABS permet le calcul de métriques en valeurs absolues (cc)</li>
                      <li>Les fichiers doivent être au format TomoTherapy</li>
                      <li>L'ID patient est automatiquement extrait du nom de fichier</li>
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 2: Analyse DVH */}
            <AccordionItem value="analysis">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <span className="font-semibold">2. Analyse des courbes DVH</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-muted-foreground">
                <div className="space-y-3">
                  <p className="font-medium text-foreground">Utilisation de l'onglet "Analyse DVH" :</p>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="font-medium text-foreground">Filtrage des structures :</p>
                      <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                        <li><strong>Boutons de catégorie</strong> : PTV, OAR, ou ALL pour afficher des groupes spécifiques</li>
                        <li><strong>Sélection multiple</strong> : Cliquez sur les structures dans le tableau pour les ajouter au graphique</li>
                        <li><strong>Tout sélectionner/Désélectionner</strong> : Boutons rapides pour gérer la sélection</li>
                      </ul>
                    </div>

                    <div>
                      <p className="font-medium text-foreground">Lecture du graphique DVH :</p>
                      <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                        <li>Axe X : Dose en Gray (Gy)</li>
                        <li>Axe Y : Volume en pourcentage (%)</li>
                        <li>Survol : Affiche les valeurs exactes dose/volume</li>
                        <li>Codes couleur : Chaque structure a une couleur unique</li>
                      </ul>
                    </div>

                    <div>
                      <p className="font-medium text-foreground">Calculateur de métriques :</p>
                      <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                        <li><strong>D(volume)</strong> : Dose reçue par un volume donné (ex: D95% = dose reçue par 95% du volume)</li>
                        <li><strong>V(dose)</strong> : Volume recevant une dose donnée (ex: V20Gy = volume recevant 20 Gy)</li>
                        <li>Résultats affichés pour chaque structure sélectionnée</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 3: Évaluation de plan */}
            <AccordionItem value="evaluation">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  <span className="font-semibold">3. Évaluation et validation de plan</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-muted-foreground">
                <div className="space-y-3">
                  <p className="font-medium text-foreground">Deux onglets complémentaires :</p>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="font-medium text-foreground">Évaluation de plan :</p>
                      <ol className="list-decimal list-inside space-y-2 ml-2 mt-2">
                        <li>Sélectionnez un protocole dans la liste déroulante</li>
                        <li>Le système calcule automatiquement tous les indices de qualité</li>
                        <li>Consultez les métriques : CI, HI, GI, score global</li>
                        <li>Exportez le rapport d'évaluation en PDF</li>
                      </ol>
                    </div>

                    <div>
                      <p className="font-medium text-foreground">Validation Protocole :</p>
                      <ol className="list-decimal list-inside space-y-2 ml-2 mt-2">
                        <li>Mappez les structures DVH avec les structures du protocole</li>
                        <li>Vérifiez la conformité aux contraintes définies</li>
                        <li>Visualisez les résultats (✓ Conforme, ✗ Non conforme, - Non applicable)</li>
                        <li>Prévisualisez et exportez le rapport de validation</li>
                      </ol>
                    </div>

                    <div className="bg-primary/10 p-4 rounded-lg border border-primary/20 mt-4">
                      <p className="font-medium text-foreground mb-2">💡 Astuce :</p>
                      <p>Utilisez le bouton "Aperçu" dans la fenêtre d'export pour visualiser le rapport avant de le générer en PDF.</p>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 4: Gestion des protocoles */}
            <AccordionItem value="protocols">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-primary" />
                  <span className="font-semibold">4. Gestion des protocoles</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-muted-foreground">
                <div className="space-y-3">
                  <p className="font-medium text-foreground">Créer et gérer vos protocoles :</p>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="font-medium text-foreground">Options disponibles :</p>
                      <ul className="list-disc list-inside space-y-2 ml-2 mt-2">
                        <li><strong>Créer un nouveau protocole</strong> : Définissez nom, prescriptions et contraintes dosimétriques</li>
                        <li><strong>Importer un protocole</strong> : Chargez un fichier JSON existant</li>
                        <li><strong>Modifier un protocole</strong> : Éditez les paramètres, ajoutez/supprimez des contraintes</li>
                        <li><strong>Dupliquer</strong> : Créez une copie pour variante du protocole</li>
                        <li><strong>Favoris</strong> : Marquez vos protocoles fréquemment utilisés</li>
                      </ul>
                    </div>

                    <div>
                      <p className="font-medium text-foreground">Convertisseur de protocole :</p>
                      <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                        <li>Collez le texte d'un document protocole (Word, PDF)</li>
                        <li>L'IA extrait automatiquement les contraintes</li>
                        <li>Vérifiez et ajustez si nécessaire</li>
                        <li>Sauvegardez comme nouveau protocole</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 5: Historique */}
            <AccordionItem value="history">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-3">
                  <History className="w-5 h-5 text-primary" />
                  <span className="font-semibold">5. Historique des analyses</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-muted-foreground">
                <div className="space-y-3">
                  <p className="font-medium text-foreground">Suivez vos analyses passées :</p>
                  
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li>Toutes les validations sont automatiquement enregistrées</li>
                    <li>Recherchez par ID patient, protocole ou date</li>
                    <li>Consultez les résultats détaillés de chaque analyse</li>
                    <li>Exportez à nouveau les rapports si nécessaire</li>
                    <li>Supprimez les entrées obsolètes (avec confirmation)</li>
                  </ul>

                  <div className="bg-muted/50 p-4 rounded-lg border mt-4">
                    <p className="font-medium text-foreground mb-2">📊 Données stockées :</p>
                    <p>L'historique est sauvegardé localement dans votre navigateur (IndexedDB). Les données restent privées et ne sont pas envoyées vers un serveur.</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 6: Cas d'usage */}
            <AccordionItem value="examples">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <span className="font-semibold">Exemples et cas d'usage</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-muted-foreground">
                <div className="space-y-6">
                  {/* Exemple 1 */}
                  <div className="bg-card border rounded-lg p-4">
                    <p className="font-semibold text-foreground mb-3">📋 Cas 1 : Validation plan cancer du sein</p>
                    <ol className="list-decimal list-inside space-y-2 ml-2">
                      <li>Chargez les fichiers DVH du plan sein (REL + ABS)</li>
                      <li>Allez dans "Validation Protocole"</li>
                      <li>Sélectionnez le protocole "Sein droit boost 45-50-66"</li>
                      <li>Mappez : CTV48.3 → PTV_50Gy, Heart → Coeur, Lung_L → Poumon gauche</li>
                      <li>Vérifiez que toutes les contraintes sont respectées (V20Gy poumons, Dmean coeur...)</li>
                      <li>Exportez le rapport de validation pour le dossier patient</li>
                    </ol>
                  </div>

                  {/* Exemple 2 */}
                  <div className="bg-card border rounded-lg p-4">
                    <p className="font-semibold text-foreground mb-3">📋 Cas 2 : Évaluation qualité plan prostate</p>
                    <ol className="list-decimal list-inside space-y-2 ml-2">
                      <li>Importez le plan prostate (DVH REL et ABS)</li>
                      <li>Ouvrez "Évaluation de plan"</li>
                      <li>Choisissez "Prostate 54-59.4-76Gy 38fx"</li>
                      <li>Analysez les indices : CI (conformité), HI (homogénéité), GI (gradient)</li>
                      <li>Vérifiez le score global et les recommandations</li>
                      <li>Si score &lt; 70%, identifiez les métriques problématiques</li>
                    </ol>
                  </div>

                  {/* Exemple 3 */}
                  <div className="bg-card border rounded-lg p-4">
                    <p className="font-semibold text-foreground mb-3">📋 Cas 3 : Création protocole personnalisé</p>
                    <ol className="list-decimal list-inside space-y-2 ml-2">
                      <li>Allez dans "Gestion Protocoles" → "Créer un protocole"</li>
                      <li>Nommez le protocole (ex: "ORL Cavum 70Gy")</li>
                      <li>Ajoutez les prescriptions : PTV70 = 70Gy, PTV59.4 = 59.4Gy</li>
                      <li>Définissez les contraintes OAR (moelle, parotides, mandibule...)</li>
                      <li>Sauvegardez et marquez en favori pour accès rapide</li>
                      <li>Utilisez ce protocole pour valider vos futurs plans ORL</li>
                    </ol>
                  </div>

                  {/* Exemple 4 */}
                  <div className="bg-card border rounded-lg p-4">
                    <p className="font-semibold text-foreground mb-3">📋 Cas 4 : Comparaison de deux plans</p>
                    <ol className="list-decimal list-inside space-y-2 ml-2">
                      <li>Chargez le premier plan et réalisez une validation complète</li>
                      <li>Exportez le rapport (il sera sauvegardé dans l'historique)</li>
                      <li>Rechargez la page ou réinitialisez</li>
                      <li>Chargez le second plan et validez avec le même protocole</li>
                      <li>Allez dans "Historique" pour comparer les deux rapports côte à côte</li>
                      <li>Identifiez le plan avec les meilleurs indices de qualité</li>
                    </ol>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Support et contact */}
      <Card>
        <CardHeader>
          <CardTitle>Besoin d'aide supplémentaire ?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-muted-foreground">
          <p>
            Si vous rencontrez des difficultés ou avez des questions spécifiques, contactez : n.sissaoui@csac-dz.com .
          </p>
          <p className="text-sm">
            Version de l'application : 1.0.0 | Dernière mise à jour : Décembre 2025
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default HelpGuide;