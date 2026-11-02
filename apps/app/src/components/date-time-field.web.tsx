import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

type DateTimeFieldProps = {
  label: string;
  value: Date;
  onChange: (value: Date) => void;
  minimumDate?: Date;
};

/** "2030-01-10T18:00" in local time, as <input type="datetime-local"> wants it. */
function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** Date and time input: the browser's own picker. */
export function DateTimeField({ label, value, onChange, minimumDate }: DateTimeFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <input
        type="datetime-local"
        aria-label={label}
        value={toLocalInput(value)}
        min={minimumDate ? toLocalInput(minimumDate) : undefined}
        onChange={(event) => {
          // An empty value means the input was cleared halfway; keep the last valid date.
          if (event.target.value) {
            onChange(new Date(event.target.value));
          }
        }}
        style={{
          minHeight: 44,
          padding: `0 ${Spacing.three}px`,
          border: 'none',
          borderRadius: Spacing.two,
          backgroundColor: theme.backgroundElement,
          color: theme.text,
          font: 'inherit',
          fontSize: 16,
          colorScheme: 'light dark',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one,
  },
});
