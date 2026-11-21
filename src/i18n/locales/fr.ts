import type { Translations } from './en';

const fr: Translations = {
  common: {
    learnMore: 'En savoir plus',
    docs: 'Docs',
    comingSoon: 'Bientôt disponible',
  },
  tabs: {
    issues: 'Signalements',
    card: 'Carte',
    report: 'Signaler',
    district: 'Arrondissement',
    brand: 'Expo Starter',
  },
  home: {
    title: 'Bienvenue sur Expo',
    getStarted: 'pour commencer',
    tryEditing: 'Modifiez',
    devTools: 'Outils de dév.',
    freshStart: 'Repartir de zéro',
    devMenu: {
      web: 'utilisez les outils de développement du navigateur',
      devicePrefix: "secouez l'appareil ou appuyez sur",
      deviceSuffix: 'dans le terminal',
      press: 'appuyez sur',
    },
  },
  explore: {
    title: 'Explorer',
    subtitle: 'Cette application de démarrage contient\ndes exemples de code pour vous aider.',
    expoDocs: 'Documentation Expo',
    sections: {
      language: 'Langue',
      colors: 'Couleurs',
      cards: 'Variantes de cartes',
      text: 'Variantes de texte',
      buttons: 'Variantes de boutons',
      routing: 'Routage basé sur les fichiers',
      platforms: 'Prise en charge Android, iOS et web',
      images: 'Images',
      themes: 'Composants mode clair et sombre',
      animations: 'Animations',
    },
  },
  language: {
    current: 'Langue actuelle : {{language}}',
    names: {
      en: 'Anglais',
      fr: 'Français',
    },
  },
  issue: {
    status: {
      not_started: 'À faire',
      in_progress: 'En cours',
      resolved: 'Résolu',
    },
    category: {
      roads_potholes: 'Nids-de-poule',
      streetlights_utilities: 'Éclairage public',
      traffic_safety: 'Sécurité cycliste',
    },
    photo: '{{count}} photo',
    photos: '{{count}} photos',
    confirmed: '{{count}} confirmé',
    confirmedPlural: '{{count}} confirmés',
    districtManager: 'Gestionnaire Arrondissement',
    upvoteLabel: 'Voter pour, {{count}} votes',
    commentsLabel: '{{count}} commentaires',
  },
};

export default fr;
