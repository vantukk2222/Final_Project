import {
  getAllTranslationKeys,
  validateTranslationKeys,
} from './translationValidator';

// Call this in development to check for missing keys
export const runTranslationCheck = () => {
  if (!__DEV__) {
    return;
  }

  // Keys currently used in your LoginScreen
  const usedKeys = [
    'app.name',
    'app.subtitle',
    'auth.welcomeBack',
    'auth.signInToContinue',
    'auth.emailAddress',
    'auth.password',
    'auth.forgotYourPassword',
    'auth.signIn',
    'auth.signingIn',
    'auth.dontHaveAccount',
    'auth.createAccount',
    'auth.loginFailed',
    'auth.emailRequired',
    'auth.passwordRequired',
    'auth.invalidEmailAddress',
    'auth.passwordMinLength',
    'placeholders.enterEmail',
    'placeholders.enterPassword',
    'common.or',
    'social.google',
    'social.facebook',
  ];

  validateTranslationKeys(usedKeys);

  console.log('📝 All available translation keys:');
  console.log(getAllTranslationKeys());
};

// Add to App.tsx in development
if (__DEV__) {
  import('./utils/developmentHelpers').then(helpers => {
    helpers.runTranslationCheck();
  });
}
