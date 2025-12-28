import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileUp, 
  BarChart3, 
  CheckCircle, 
  FileText, 
  History, 
  BookOpen, 
  Lightbulb, 
  Keyboard, 
  AlertTriangle,
  Target,
  Calculator,
  Filter,
  Download,
  Settings,
  Layers,
  Zap,
  HelpCircle,
  Play,
  Mail,
  ExternalLink,
  Sparkles,
  MousePointer,
  Eye,
  FileImage,
  Wand2
} from "lucide-react";
import { restartTour } from "./InteractiveTour";

const HelpGuide = () => {
  const [activeTab, setActiveTab] = useState("guide");

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header hero section */}
      <Card className="card-elevated overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <BookOpen className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Centre d'aide DVH Analyzer</CardTitle>
                  <CardDescription className="text-base mt-1">
                    Guide complet pour maîtriser l'analyse dosimétrique
                  </CardDescription>
                </div>
              </div>
              <Button 
                variant="outline" 
                onClick={restartTour}
                className="gap-2"
              >
                <Play className="w-4 h-4" />
                Relancer le tour guidé
              </Button>
            </div>
          </CardHeader>
        </div>
      </Card>

      {/* Quick access cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickAccessCard
          icon={FileUp}
          title="Import fichiers"
          description="DVH REL & ABS, DICOM-RT"
          color="info"
        />
        <QuickAccessCard
          icon={BarChart3}
          title="Analyse DVH"
          description="Courbes, métriques, calculs"
          color="ptv"
        />
        <QuickAccessCard
          icon={CheckCircle}
          title="Validation"
          description="Conformité protocole"
          color="success"
        />
        <QuickAccessCard
          icon={AlertTriangle}
          title="Alertes"
          description="Surveillance doses critiques"
          color="warning"
        />
      </div>

      {/* Main content tabs */}
      <Card className="card-elevated">
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="guide" className="gap-2">
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Guide</span>
              </TabsTrigger>
              <TabsTrigger value="features" className="gap-2">
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">Fonctionnalités</span>
              </TabsTrigger>
              <TabsTrigger value="tips" className="gap-2">
                <Lightbulb className="w-4 h-4" />
                <span className="hidden sm:inline">Astuces</span>
              </TabsTrigger>
              <TabsTrigger value="faq" className="gap-2">
                <HelpCircle className="w-4 h-4" />
                <span className="hidden sm:inline">FAQ</span>
              </TabsTrigger>
            </TabsList>

            {/* Tab: Guide d'utilisation */}
            <TabsContent value="guide" className="mt-0">
              <Accordion type="single" collapsible className="w-full space-y-2">
                {/* Section 1: Upload de fichiers */}
                <AccordionItem value="upload" className="border rounded-lg px-4 bg-card/50">
                  <AccordionTrigger className="text-left hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-info/10">
                        <FileUp className="w-5 h-5 text-info" />
                      </div>
                      <div>
                        <span className="font-semibold block">1. Chargement des fichiers</span>
                        <span className="text-sm text-muted-foreground">DVH TomoTherapy, DICOM-RT</span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-4 text-muted-foreground ml-12">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <p className="font-medium text-foreground flex items-center gap-2">
                            <FileText className="w-4 h-4 text-info" />
                            Fichiers DVH TomoTherapy
                          </p>
                          <ol className="list-decimal list-inside space-y-2 text-sm">
                            <li>Onglet <strong>"Charger un plan"</strong></li>
                            <li>Sélectionnez le fichier <Badge variant="outline" className="mx-1">DVH REL</Badge> (obligatoire)</li>
                            <li>Ajoutez le fichier <Badge variant="outline" className="mx-1">DVH ABS</Badge> (recommandé)</li>
                            <li>Cliquez sur <strong>"Analyser"</strong></li>
                          </ol>
                        </div>
                        <div className="space-y-3">
                          <p className="font-medium text-foreground flex items-center gap-2">
                            <Layers className="w-4 h-4 text-ptv" />
                            Fichiers DICOM-RT
                          </p>
                          <ol className="list-decimal list-inside space-y-2 text-sm">
                            <li>Onglet <strong>"Import DICOM-RT"</strong></li>
                            <li>Glissez vos fichiers DICOM (RT-DOSE, RT-STRUCT, RT-PLAN)</li>
                            <li>L'extraction DVH est automatique</li>
                          </ol>
                        </div>
                      </div>
                      
                      <div className="bg-warning/10 border border-warning/20 p-4 rounded-lg mt-4">
                        <p className="font-medium text-foreground mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-warning" />
                          Points importants
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          <li>Le fichier DVH REL est indispensable pour l'analyse</li>
                          <li>Le fichier DVH ABS permet les métriques en cm³</li>
                          <li>L'ID patient est extrait automatiquement du fichier</li>
                        </ul>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Section 2: Analyse DVH */}
                <AccordionItem value="analysis" className="border rounded-lg px-4 bg-card/50">
                  <AccordionTrigger className="text-left hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-ptv/10">
                        <BarChart3 className="w-5 h-5 text-ptv" />
                      </div>
                      <div>
                        <span className="font-semibold block">2. Analyse des courbes DVH</span>
                        <span className="text-sm text-muted-foreground">Visualisation, sélection, calculs</span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-4 text-muted-foreground ml-12">
                      <div className="grid md:grid-cols-3 gap-4">
                        <FeatureBlock
                          icon={Filter}
                          title="Sélection structures"
                          items={[
                            "Sélecteur intégré au graphique",
                            "Filtrage par catégorie (PTV/OAR)",
                            "Recherche par nom",
                            "Sélection/désélection groupée"
                          ]}
                        />
                        <FeatureBlock
                          icon={Eye}
                          title="Lecture graphique"
                          items={[
                            "Axe X : Dose (Gy)",
                            "Axe Y : Volume (%)",
                            "Survol : valeurs exactes",
                            "Couleurs uniques par structure"
                          ]}
                        />
                        <FeatureBlock
                          icon={Calculator}
                          title="Calculateur"
                          items={[
                            "D(volume) : D95%, D2%...",
                            "V(dose) : V20Gy, V45Gy...",
                            "Résultats multi-structures",
                            "Valeurs relatives et absolues"
                          ]}
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Section 3: Évaluation et validation */}
                <AccordionItem value="evaluation" className="border rounded-lg px-4 bg-card/50">
                  <AccordionTrigger className="text-left hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-success/10">
                        <CheckCircle className="w-5 h-5 text-success" />
                      </div>
                      <div>
                        <span className="font-semibold block">3. Évaluation et validation</span>
                        <span className="text-sm text-muted-foreground">Indices qualité, conformité protocole</span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-4 text-muted-foreground ml-12">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-3 p-4 bg-card border rounded-lg">
                          <p className="font-medium text-foreground flex items-center gap-2">
                            <Target className="w-4 h-4 text-success" />
                            Évaluation de plan
                          </p>
                          <ol className="list-decimal list-inside space-y-2 text-sm">
                            <li>Sélectionnez un protocole</li>
                            <li>Calcul automatique des indices (CI, HI, GI)</li>
                            <li>Score global de qualité</li>
                            <li>Export rapport PDF</li>
                          </ol>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge className="badge-ptv">CI - Conformité</Badge>
                            <Badge className="badge-info">HI - Homogénéité</Badge>
                            <Badge className="badge-oar">GI - Gradient</Badge>
                          </div>
                        </div>
                        
                        <div className="space-y-3 p-4 bg-card border rounded-lg">
                          <p className="font-medium text-foreground flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-success" />
                            Validation protocole
                          </p>
                          <ol className="list-decimal list-inside space-y-2 text-sm">
                            <li>Mapping structures DVH ↔ protocole</li>
                            <li>Vérification contraintes dosimétriques</li>
                            <li>Résultats visuels (✓ / ✗)</li>
                            <li>Rapport de validation exportable</li>
                          </ol>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge className="badge-success">Conforme</Badge>
                            <Badge className="badge-error">Non conforme</Badge>
                            <Badge variant="outline">Non applicable</Badge>
                          </div>
                        </div>
                      </div>

                      <div className="bg-info/10 border border-info/20 p-4 rounded-lg">
                        <p className="font-medium text-foreground mb-2 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-info" />
                          Astuce
                        </p>
                        <p className="text-sm">Utilisez le bouton "Aperçu" pour visualiser le rapport avant export PDF.</p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Section 4: Gestion des protocoles */}
                <AccordionItem value="protocols" className="border rounded-lg px-4 bg-card/50">
                  <AccordionTrigger className="text-left hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-oar/10">
                        <FileText className="w-5 h-5 text-oar" />
                      </div>
                      <div>
                        <span className="font-semibold block">4. Gestion des protocoles</span>
                        <span className="text-sm text-muted-foreground">Création, import, conversion IA</span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-4 text-muted-foreground ml-12">
                      <div className="grid md:grid-cols-2 gap-4">
                        <FeatureBlock
                          icon={Settings}
                          title="Gestion manuelle"
                          items={[
                            "Créer un nouveau protocole",
                            "Importer un fichier JSON",
                            "Modifier/dupliquer existant",
                            "Marquer en favoris",
                            "Masquer protocoles inutilisés"
                          ]}
                        />
                        <FeatureBlock
                          icon={Wand2}
                          title="Conversion IA"
                          items={[
                            "Coller texte Word/PDF",
                            "Upload image de protocole",
                            "Extraction automatique contraintes",
                            "Vérification et ajustement",
                            "Sauvegarde instantanée"
                          ]}
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Section 5: Alertes doses critiques */}
                <AccordionItem value="alerts" className="border rounded-lg px-4 bg-card/50">
                  <AccordionTrigger className="text-left hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-warning/10">
                        <AlertTriangle className="w-5 h-5 text-warning" />
                      </div>
                      <div>
                        <span className="font-semibold block">5. Alertes doses critiques</span>
                        <span className="text-sm text-muted-foreground">Surveillance OAR, notifications</span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-4 text-muted-foreground ml-12">
                      <p>Le système surveille automatiquement les doses aux organes à risque :</p>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2 p-4 bg-error/5 border border-error/20 rounded-lg">
                          <p className="font-medium text-error flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Alertes critiques
                          </p>
                          <p className="text-sm">Dépassement des tolérances maximales (doses létales, TD5/5)</p>
                        </div>
                        <div className="space-y-2 p-4 bg-warning/5 border border-warning/20 rounded-lg">
                          <p className="font-medium text-warning flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Avertissements
                          </p>
                          <p className="text-sm">Approche des seuils recommandés (QUANTEC, RTOG)</p>
                        </div>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Fenêtre scrollable pour voir toutes les alertes</li>
                        <li>Fermeture individuelle de chaque alerte</li>
                        <li>Compteurs dynamiques (critiques/avertissements)</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Section 6: Historique */}
                <AccordionItem value="history" className="border rounded-lg px-4 bg-card/50">
                  <AccordionTrigger className="text-left hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <History className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <span className="font-semibold block">6. Historique des analyses</span>
                        <span className="text-sm text-muted-foreground">Suivi, recherche, export</span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-4 text-muted-foreground ml-12">
                      <ul className="list-disc list-inside space-y-2 text-sm">
                        <li>Sauvegarde automatique de chaque validation</li>
                        <li>Recherche par ID patient, protocole ou date</li>
                        <li>Consultation détaillée des résultats</li>
                        <li>Ré-export des rapports</li>
                        <li>Suppression avec confirmation</li>
                      </ul>
                      
                      <div className="bg-muted/50 p-4 rounded-lg border mt-4">
                        <p className="font-medium text-foreground mb-2 flex items-center gap-2">
                          <Zap className="w-4 h-4 text-primary" />
                          Stockage local
                        </p>
                        <p className="text-sm">Les données sont sauvegardées dans IndexedDB (navigateur). Elles restent privées et ne sont pas envoyées vers un serveur.</p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>

            {/* Tab: Fonctionnalités */}
            <TabsContent value="features" className="mt-0">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FeatureCard
                  icon={FileUp}
                  title="Import multi-format"
                  description="DVH TomoTherapy (REL/ABS), DICOM-RT (RT-DOSE, RT-STRUCT, RT-PLAN)"
                  badge="Core"
                />
                <FeatureCard
                  icon={BarChart3}
                  title="Visualisation DVH"
                  description="Courbes interactives, sélection intelligente, survol détaillé"
                  badge="Core"
                />
                <FeatureCard
                  icon={Calculator}
                  title="Calculateur métriques"
                  description="D(volume), V(dose), valeurs relatives et absolues"
                  badge="Core"
                />
                <FeatureCard
                  icon={Target}
                  title="Indices qualité"
                  description="CI (conformité), HI (homogénéité), GI (gradient), score global"
                  badge="Évaluation"
                />
                <FeatureCard
                  icon={CheckCircle}
                  title="Validation protocole"
                  description="Vérification automatique de toutes les contraintes dosimétriques"
                  badge="Évaluation"
                />
                <FeatureCard
                  icon={AlertTriangle}
                  title="Alertes critiques"
                  description="Surveillance OAR avec notifications temps réel"
                  badge="Sécurité"
                />
                <FeatureCard
                  icon={Wand2}
                  title="Conversion IA"
                  description="Extraction automatique de protocoles depuis texte ou image"
                  badge="IA"
                />
                <FeatureCard
                  icon={Download}
                  title="Export PDF"
                  description="Rapports professionnels avec aperçu intégré"
                  badge="Export"
                />
                <FeatureCard
                  icon={History}
                  title="Historique"
                  description="Suivi complet avec recherche et filtres avancés"
                  badge="Données"
                />
                <FeatureCard
                  icon={Layers}
                  title="Sommation plans"
                  description="Combinaison de multiples plans de traitement"
                  badge="Avancé"
                />
                <FeatureCard
                  icon={Settings}
                  title="Protocoles personnalisés"
                  description="Création, import, favoris, masquage"
                  badge="Config"
                />
                <FeatureCard
                  icon={MousePointer}
                  title="Tour interactif"
                  description="Guide de découverte pour nouveaux utilisateurs"
                  badge="Aide"
                />
              </div>
            </TabsContent>

            {/* Tab: Astuces */}
            <TabsContent value="tips" className="mt-0">
              <div className="space-y-4">
                <TipCard
                  icon={Keyboard}
                  title="Raccourcis pratiques"
                  tips={[
                    "Glisser-déposer plusieurs fichiers à la fois",
                    "Cliquer sur une structure dans le tableau pour la sélectionner/désélectionner",
                    "Double-cliquer sur une catégorie pour tout sélectionner"
                  ]}
                />
                <TipCard
                  icon={Filter}
                  title="Sélection efficace"
                  tips={[
                    "Utilisez le sélecteur intégré au graphique DVH pour un accès rapide",
                    "Filtrez par catégorie (PTV/OAR/Autre) pour simplifier la vue",
                    "La recherche par nom fonctionne en temps réel"
                  ]}
                />
                <TipCard
                  icon={FileImage}
                  title="Conversion protocole"
                  tips={[
                    "Photographiez un tableau de contraintes pour l'importer",
                    "Copiez-collez le texte d'un document Word ou PDF",
                    "Vérifiez toujours les valeurs extraites avant validation"
                  ]}
                />
                <TipCard
                  icon={Download}
                  title="Export optimisé"
                  tips={[
                    "Prévisualisez le rapport avant de générer le PDF",
                    "Le rapport compact est idéal pour l'impression",
                    "Ajoutez le nom du médecin et des observations personnalisées"
                  ]}
                />
                <TipCard
                  icon={Lightbulb}
                  title="Bonnes pratiques"
                  tips={[
                    "Chargez toujours le fichier ABS pour les métriques volumiques",
                    "Marquez vos protocoles fréquents en favoris",
                    "Utilisez l'historique pour comparer des plans similaires"
                  ]}
                />
              </div>
            </TabsContent>

            {/* Tab: FAQ */}
            <TabsContent value="faq" className="mt-0">
              <Accordion type="single" collapsible className="w-full space-y-2">
                <FAQItem
                  question="Quels formats de fichiers sont supportés ?"
                  answer="DVH Analyzer supporte les fichiers DVH TomoTherapy (formats REL et ABS) ainsi que les fichiers DICOM-RT (RT-DOSE, RT-STRUCT, RT-PLAN). L'extraction DVH depuis DICOM-RT est automatique."
                />
                <FAQItem
                  question="Le fichier DVH ABS est-il obligatoire ?"
                  answer="Non, seul le fichier DVH REL est obligatoire. Cependant, le fichier ABS est fortement recommandé car il permet le calcul des métriques en valeurs absolues (cm³) essentielles pour certaines contraintes."
                />
                <FAQItem
                  question="Mes données sont-elles sécurisées ?"
                  answer="Oui, toutes les données sont stockées localement dans votre navigateur (IndexedDB). Aucune donnée patient n'est envoyée vers un serveur externe. Les fichiers sont traités entièrement côté client."
                />
                <FAQItem
                  question="Comment créer un protocole personnalisé ?"
                  answer="Allez dans l'onglet 'Gestion Protocoles', cliquez sur 'Créer un protocole', définissez les prescriptions et contraintes, puis sauvegardez. Vous pouvez aussi utiliser le convertisseur IA pour extraire automatiquement les contraintes d'un document."
                />
                <FAQItem
                  question="Comment interpréter les indices de qualité ?"
                  answer="CI (Conformité Index) proche de 1 = bonne couverture. HI (Homogeneity Index) proche de 0 = dose homogène. GI (Gradient Index) bas = bon gradient de dose. Le score global pondère ces indices."
                />
                <FAQItem
                  question="Que signifient les alertes de dose ?"
                  answer="Les alertes rouges (critiques) indiquent un dépassement des tolérances maximales. Les alertes oranges (avertissements) signalent une approche des seuils recommandés (QUANTEC, RTOG). Chaque alerte peut être fermée individuellement."
                />
                <FAQItem
                  question="Comment comparer deux plans ?"
                  answer="Validez le premier plan et exportez le rapport (sauvegardé automatiquement dans l'historique). Chargez ensuite le second plan et validez avec le même protocole. Utilisez l'historique pour comparer les résultats."
                />
                <FAQItem
                  question="Puis-je exporter les rapports ?"
                  answer="Oui, les rapports de validation et d'évaluation peuvent être exportés en PDF. Utilisez le bouton 'Aperçu' pour visualiser avant export. Vous pouvez ajouter le nom du médecin et des observations."
                />
              </Accordion>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Support et contact */}
      <Card className="card-elevated">
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">Besoin d'aide supplémentaire ?</p>
                <p className="text-sm text-muted-foreground">
                  Contact : <a href="mailto:n.sissaoui@csac-dz.com" className="text-primary hover:underline">n.sissaoui@csac-dz.com</a>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Badge variant="outline" className="gap-1">
                <Zap className="w-3 h-3" />
                v2.0.0
              </Badge>
              <span>Mise à jour : Décembre 2025</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Composants auxiliaires
const QuickAccessCard = ({ icon: Icon, title, description, color }: {
  icon: React.ElementType;
  title: string;
  description: string;
  color: 'info' | 'ptv' | 'success' | 'warning';
}) => {
  const colorClasses = {
    info: 'bg-info/10 border-info/20 text-info',
    ptv: 'bg-ptv/10 border-ptv/20 text-ptv',
    success: 'bg-success/10 border-success/20 text-success',
    warning: 'bg-warning/10 border-warning/20 text-warning'
  };

  return (
    <Card className={`p-4 border ${colorClasses[color].split(' ')[1]} hover:shadow-md transition-shadow`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color].split(' ')[0]}`}>
          <Icon className={`w-5 h-5 ${colorClasses[color].split(' ')[2]}`} />
        </div>
        <div>
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </Card>
  );
};

const FeatureBlock = ({ icon: Icon, title, items }: {
  icon: React.ElementType;
  title: string;
  items: string[];
}) => (
  <div className="space-y-2">
    <p className="font-medium text-foreground flex items-center gap-2">
      <Icon className="w-4 h-4 text-primary" />
      {title}
    </p>
    <ul className="list-disc list-inside space-y-1 text-sm">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  </div>
);

const FeatureCard = ({ icon: Icon, title, description, badge }: {
  icon: React.ElementType;
  title: string;
  description: string;
  badge: string;
}) => (
  <Card className="p-4 hover:shadow-md transition-shadow">
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-lg bg-primary/10 shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm">{title}</p>
          <Badge variant="secondary" className="text-xs">{badge}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  </Card>
);

const TipCard = ({ icon: Icon, title, tips }: {
  icon: React.ElementType;
  title: string;
  tips: string[];
}) => (
  <Card className="p-4 bg-gradient-to-r from-primary/5 to-transparent border-l-4 border-l-primary">
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-lg bg-primary/10 shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="space-y-2">
        <p className="font-medium">{title}</p>
        <ul className="space-y-1">
          {tips.map((tip, i) => (
            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
              <Lightbulb className="w-3 h-3 text-primary mt-1 shrink-0" />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  </Card>
);

const FAQItem = ({ question, answer }: { question: string; answer: string }) => (
  <AccordionItem value={question} className="border rounded-lg px-4 bg-card/50">
    <AccordionTrigger className="text-left hover:no-underline py-4">
      <div className="flex items-center gap-3">
        <HelpCircle className="w-5 h-5 text-primary shrink-0" />
        <span className="font-medium">{question}</span>
      </div>
    </AccordionTrigger>
    <AccordionContent className="pb-4 ml-8 text-muted-foreground">
      {answer}
    </AccordionContent>
  </AccordionItem>
);

export default HelpGuide;
