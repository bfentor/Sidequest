import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFormat } from '@/lib/format';

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

/** Date and time input: the inline picker on iOS, the system dialogs on Android. */
export function DateTimeField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  mode = 'datetime',
}: DateTimeFieldProps) {
  const theme = useTheme();
  const format = useFormat();

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.row}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <DateTimePicker
          value={value}
          mode={mode}
          display="compact"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onValueChange={(_event, date) => onChange(date)}
          accessibilityLabel={label}
        />
      </View>
    );
  }

  // Android asks for the date first, then (unless date-only) the time.
  const open = () =>
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      minimumDate,
      maximumDate,
      onValueChange: (_event, date) =>
        mode === 'date'
          ? onChange(date)
          : DateTimePickerAndroid.open({
              value: date,
              mode: 'time',
              is24Hour: true,
              onValueChange: (_timeEvent, time) => onChange(time),
            }),
    });

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <Pressable
        role="button"
        accessibilityLabel={label}
        onPress={open}
        style={[styles.input, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText>{mode === 'date' ? format.date(value) : format.dateTime(value)}</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
});
