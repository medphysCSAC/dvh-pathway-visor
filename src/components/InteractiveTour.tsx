import { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';

const TOUR_KEY = 'dvh-analyzer-tour-completed';

const steps: Step[] = [
  {
    target: 'body',
    content: 'Bienvenue dans DVH Analyzer pour Tomotherapy ! Ce tour rapide vous guidera à travers les fonctionnalités principales.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="file-upload"]',
    content: 'Commencez par charger vos fichiers DVH (REL et ABS) ici. Vous pouvez glisser-déposer ou cliquer pour sélectionner.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="tabs"]',
    content: 'Explorez les différents onglets pour accéder aux fonctionnalités : analyse DVH, évaluation de plan, validation de protocole, etc.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="protocols"]',
    content: 'Gérez vos protocoles personnalisés dans cet onglet. Vous pouvez créer, modifier et organiser vos protocoles.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="converter"]',
    content: 'Le convertisseur vous permet de transformer des documents PDF en protocoles structurés automatiquement.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="history"]',
    content: 'Retrouvez l\'historique de toutes vos analyses précédentes dans cet onglet.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="help"]',
    content: 'Besoin d\'aide ? Consultez le guide complet avec des exemples et des tutoriels détaillés.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="theme-toggle"]',
    content: 'Changez entre le mode clair et sombre selon vos préférences.',
    placement: 'left',
  },
];

export const InteractiveTour = () => {
  const [runTour, setRunTour] = useState(false);

  useEffect(() => {
    const tourCompleted = localStorage.getItem(TOUR_KEY);
    if (!tourCompleted) {
      // Démarrer le tour après un court délai pour laisser le temps à la page de se charger
      setTimeout(() => setRunTour(true), 500);
    }
  }, []);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRunTour(false);
      localStorage.setItem(TOUR_KEY, 'true');
    }
  };

  return (
    <Joyride
      steps={steps}
      run={runTour}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: 'hsl(var(--primary))',
          textColor: 'hsl(var(--foreground))',
          backgroundColor: 'hsl(var(--card))',
          overlayColor: 'rgba(0, 0, 0, 0.5)',
          arrowColor: 'hsl(var(--card))',
          zIndex: 1000,
        },
        buttonNext: {
          backgroundColor: 'hsl(var(--primary))',
          color: 'hsl(var(--primary-foreground))',
          borderRadius: '0.5rem',
          padding: '0.5rem 1rem',
        },
        buttonBack: {
          color: 'hsl(var(--muted-foreground))',
          marginRight: '0.5rem',
        },
        buttonSkip: {
          color: 'hsl(var(--muted-foreground))',
        },
        tooltip: {
          borderRadius: '0.75rem',
          padding: '1rem',
        },
        tooltipContent: {
          padding: '0.5rem 0',
        },
      }}
      locale={{
        back: 'Précédent',
        close: 'Fermer',
        last: 'Terminer',
        next: 'Suivant',
        skip: 'Passer',
      }}
    />
  );
};

export const restartTour = () => {
  localStorage.removeItem(TOUR_KEY);
  window.location.reload();
};
