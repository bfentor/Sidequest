import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import type { Language } from '@/i18n';
import { LEGAL_DOCUMENTS, type LegalDocument } from '@/legal/documents';

export default function LegalScreen() {
  const { document } = useLocalSearchParams<{ document: LegalDocument }>();
  const { t, i18n } = useTranslation();
  const texts = LEGAL_DOCUMENTS[document] ?? LEGAL_DOCUMENTS.terms;

  return (
    <Screen hasHeader>
      <Stack.Screen
        options={{ title: t(`legal.${document === 'privacy' ? 'privacy' : 'terms'}`) }}
      />
      <ThemedText>{texts[i18n.language as Language] ?? texts.en}</ThemedText>
    </Screen>
  );
}
