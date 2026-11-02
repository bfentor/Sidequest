import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { chooseLanguage, LANGUAGES, storedLanguage, type Language } from '@/i18n';

export default function SettingsScreen() {
  return (
    <Screen hasHeader>
      <LanguagePicker />
    </Screen>
  );
}

function LanguagePicker() {
  const { t } = useTranslation();
  const theme = useTheme();
  // undefined while loading, null when following the device
  const [choice, setChoice] = useState<Language | null | undefined>(undefined);

  useEffect(() => {
    storedLanguage().then(setChoice);
  }, []);

  const options: { code: Language | null; name: string }[] = [
    { code: null, name: t('settings.languageAutomatic') },
    ...LANGUAGES,
  ];

  return (
    <View style={styles.section}>
      <ThemedText type="heading">{t('settings.language')}</ThemedText>
      <ThemedView type="backgroundElement" style={styles.group}>
        {options.map((option) => {
          const selected = choice !== undefined && option.code === choice;
          return (
            <Pressable
              key={option.code ?? 'automatic'}
              role="radio"
              aria-checked={selected}
              onPress={() => {
                setChoice(option.code);
                chooseLanguage(option.code);
              }}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
              <ThemedText style={selected && { color: theme.tint }}>{option.name}</ThemedText>
              {selected ? <ThemedText style={{ color: theme.tint }}>✓</ThemedText> : null}
            </Pressable>
          );
        })}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  group: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
});
