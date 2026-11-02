import type { AuthError } from '@sidequest/api';
import type { TFunction } from 'i18next';

/**
 * Messages for allauth errors. The server translates its own messages (it gets
 * the Accept-Language header); only the client-side ones need translating here.
 */
export function authErrorMessage(errors: AuthError[], t: TFunction) {
  return errors
    .map((error) => {
      switch (error.code) {
        case 'network':
          return t('errors.network');
        case 'unexpected':
          return t('errors.unexpected');
        default:
          return error.message;
      }
    })
    .join('\n');
}
