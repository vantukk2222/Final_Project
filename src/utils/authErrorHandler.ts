import {TranslationKey} from '../types/translation';

export const getAuthErrorMessage = (errorCode: string): TranslationKey => {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'errors.authEmailAlreadyInUse';
    case 'auth/invalid-email':
      return 'errors.authInvalidEmail';
    case 'auth/operation-not-allowed':
      return 'errors.authOperationNotAllowed';
    case 'auth/weak-password':
      return 'errors.authWeakPassword';
    case 'auth/user-disabled':
      return 'errors.authUserDisabled';
    case 'auth/user-not-found':
      return 'errors.authUserNotFound';
    case 'auth/wrong-password':
      return 'errors.authWrongPassword';
    case 'auth/too-many-requests':
      return 'errors.authTooManyRequests';
    case 'auth/network-request-failed':
      return 'errors.authNetworkRequestFailed';
    case 'auth/invalid-credential':
      return 'errors.authInvalidCredential';
    default:
      return 'errors.unknownError';
  }
};

export const getFirebaseAuthErrorMessage = (error: any): string => {
  if (error?.code) {
    return getAuthErrorMessage(error.code);
  }
  return 'errors.unknownError';
};
