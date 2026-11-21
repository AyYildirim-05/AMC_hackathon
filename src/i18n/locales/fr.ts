import type { Translations } from './en';

const fr: Translations = {
  common: {
    learnMore: 'En savoir plus',
    docs: 'Docs',
  },
  tabs: {
    home: 'Accueil',
    explore: 'Explorer',
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
      account: 'Compte',
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
  auth: {
    signInTitle: 'Bon retour',
    signInSubtitle: 'Connectez-vous avec votre courriel ou nom d’utilisateur.',
    registerTitle: 'Créer un compte',
    registerSubtitle: 'Rejoignez votre quartier pour signaler et suivre les enjeux locaux.',
    usernameLabel: "Nom d'utilisateur",
    usernamePlaceholder: 'ex. camille_mtl',
    emailOrUsernameLabel: "Courriel ou nom d'utilisateur",
    emailOrUsernamePlaceholder: "vous@gmail.com ou nom d'utilisateur",
    emailLabel: 'Courriel',
    emailPlaceholder: 'vous@gmail.com',
    passwordLabel: 'Mot de passe',
    passwordPlaceholder: 'Au moins 8 caractères',
    postalCodeLabel: 'Code postal',
    postalCodePlaceholder: 'H2J 1S4',
    signInButton: 'Se connecter',
    registerButton: 'Créer le compte',
    switchToRegister: 'Pas encore de compte ? Créer un compte',
    switchToSignIn: 'Déjà un compte ? Se connecter',
    signOutButton: 'Se déconnecter',
    signedInAs: 'Connecté en tant que {{identity}}',
    errors: {
      requiredFields: 'Veuillez remplir tous les champs obligatoires.',
      invalidEmail: 'Veuillez saisir une adresse courriel valide.',
      passwordTooShort: 'Le mot de passe doit contenir au moins 8 caractères.',
      invalidPostalCode: 'Entrez un code postal canadien valide de 6 caractères (ex. H2J 1S4).',
      network: 'Impossible de joindre le serveur. Vérifiez que le backend est démarré.',
    },
  },
};

export default fr;
