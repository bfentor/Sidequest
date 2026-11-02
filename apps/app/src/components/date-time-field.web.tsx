import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toIsoDate } from '@/lib/dates';

import { ThemedText } from './themed-text';

type DateTimeFieldProps = {
  label: string;
  value: Date;
  onChange: (value: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Only the date (e.g. a birth date), or date and time. */
  mode?: 'date' | 'datetime';
};

const pad = (n: number) => String(n).padStart(2, '0');

/** "2030-01-10T18:00" in local time, as <input type="datetime-local"> wants it. */
function toDateTimeInput(date: Date) {
  return `${toIsoDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Date and time input: the browser's own picker. */
export function DateTimeField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  mode = 'datetime',
}: DateTimeFieldProps) {
  const theme = useTheme();
  const toInput = mode === 'date' ? toIsoDate : toDateTimeInput;

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <input
        type={mode === 'date' ? 'date' : 'datetime-local'}
        aria-label={label}
        value={toInput(value)}
        min={minimumDate ? toInput(minimumDate) : undefined}
        max={maximumDate ? toInput(maximumDate) : undefined}
        onChange={(event) => {
          // An empty value means the input was cleared halfway; keep the last valid date.
          if (event.target.value) {
            // Date-only values are midnight local time, not UTC.
            const raw = mode === 'date' ? `${event.target.value}T00:00` : event.target.value;
            onChange(new Date(raw));
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
