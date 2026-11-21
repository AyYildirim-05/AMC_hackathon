/**
 * English strings: the source of truth. Every other locale must have the same keys
 * (enforced by the `Translations` type in fr.ts and by the i18n tests).
 */
const en = {
  common: {
    learnMore: 'Learn more',
    docs: 'Docs',
  },
  tabs: {
    home: 'Home',
    explore: 'Explore',
    brand: 'Expo Starter',
  },
  home: {
    title: 'Welcome to Expo',
    getStarted: 'get started',
    tryEditing: 'Try editing',
    devTools: 'Dev tools',
    freshStart: 'Fresh start',
    devMenu: {
      web: 'use browser devtools',
      devicePrefix: 'shake device or press',
      deviceSuffix: 'in terminal',
      press: 'press',
    },
  },
  explore: {
    title: 'Explore',
    subtitle: 'This starter app includes example\ncode to help you get started.',
    expoDocs: 'Expo documentation',
    sections: {
      account: 'Account',
      language: 'Language',
      colors: 'Colors',
      cards: 'Card variants',
      text: 'Text variants',
      buttons: 'Button variants',
      routing: 'File-based routing',
      platforms: 'Android, iOS, and web support',
      images: 'Images',
      themes: 'Light and dark mode components',
      animations: 'Animations',
    },
  },
  language: {
    current: 'Current language: {{language}}',
    names: {
      en: 'English',
      fr: 'French',
    },
  },
  auth: {
    signInTitle: 'Welcome back',
    signInSubtitle: 'Sign in with your email or username to continue.',
    registerTitle: 'Create your account',
    registerSubtitle: 'Join your neighborhood to report and track local issues.',
    usernameLabel: 'Username',
    usernamePlaceholder: 'e.g. camille_mtl',
    emailOrUsernameLabel: 'Email or username',
    emailOrUsernamePlaceholder: 'you@gmail.com or username',
    emailLabel: 'Email',
    emailPlaceholder: 'you@gmail.com',
    passwordLabel: 'Password',
    passwordPlaceholder: 'At least 8 characters',
    postalCodeLabel: 'Postal code',
    postalCodePlaceholder: 'H2J 1S4',
    signInButton: 'Sign in',
    registerButton: 'Create account',
    switchToRegister: "Don't have an account? Create one",
    switchToSignIn: 'Already have an account? Sign in',
    signOutButton: 'Sign out',
    signedInAs: 'Signed in as {{identity}}',
    errors: {
      requiredFields: 'Please fill in all required fields.',
      invalidEmail: 'Please enter a valid email address.',
      passwordTooShort: 'Password must be at least 8 characters.',
      invalidPostalCode: 'Enter a valid 6-character Canadian postal code (e.g. H2J 1S4).',
      network: 'Unable to reach the server. Check that the backend is running.',
    },
  },
};

export default en;

/** Same shape as English, with string values. */
type DeepStringify<T> = { [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]> };
export type Translations = DeepStringify<typeof en>;
