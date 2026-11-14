import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { TextField } from '@/components/TextField';
import { minTouch } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

// Small pieces the Reception 2b screens share (14 Nov 2026).

export function BackLink({ label = '‹ Back', fallback }: { label?: string; fallback: Href }) {
  const router = useRouter();
  return (
    <Pressable accessibilityRole="link" hitSlop={12} style={styles.back} onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}>
      <AppText variant="bodyStrong" color="link">
        {label}
      </AppText>
    </Pressable>
  );
}

export function Label({ children }: { children: string }) {
  return (
    <AppText variant="label" color="textMuted">
      {children}
    </AppText>
  );
}

/** One choice from a few, as pills (the payment-proof screen's look). */
export function Chips<T extends string>({ options, value, onChange, disabled }: { options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void; disabled?: boolean }) {
  const t = useAppTheme();
  return (
    <View style={[styles.chips, { gap: t.space.sm }]}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled }}
            disabled={disabled}
            onPress={() => onChange(o.value)}
            style={[styles.chip, { borderRadius: t.radius.pill, borderColor: on ? t.colors.primary : t.colors.borderStrong, backgroundColor: on ? t.colors.primary : t.colors.surface }]}
          >
            <AppText variant="bodyStrong" style={{ color: on ? t.colors.onPrimary : t.colors.text }}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Several choices (class days), as pills that toggle. */
export function MultiChips({ options, value, onChange }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void }) {
  const t = useAppTheme();
  return (
    <View style={[styles.chips, { gap: t.space.sm }]}>
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <Pressable
            key={o}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            style={[styles.chip, { borderRadius: t.radius.pill, borderColor: on ? t.colors.primary : t.colors.borderStrong, backgroundColor: on ? t.colors.primary : t.colors.surface }]}
          >
            <AppText variant="bodyStrong" style={{ color: on ? t.colors.onPrimary : t.colors.text }}>
              {o}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A long list (nationality, country): type to narrow it, tap one. */
export function OptionSearch({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const t = useAppTheme();
  const [open, setOpen] = useState(!value);
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? [...options.filter((o) => o.toLowerCase().startsWith(needle)), ...options.filter((o) => !o.toLowerCase().startsWith(needle) && o.toLowerCase().includes(needle))].slice(0, 8)
    : options.slice(0, 7);
  if (!open) {
    return (
      <View style={{ gap: t.space.xs }}>
        <Label>{label.toUpperCase()}</Label>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}. Change`} onPress={() => setOpen(true)} style={[styles.row, { borderColor: t.colors.borderStrong, borderRadius: t.radius.md }]}>
          <AppText variant="bodyStrong">{value}</AppText>
          <AppText color="link">Change</AppText>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={{ gap: t.space.xs }}>
      <TextField label={label} value={q} onChangeText={setQ} placeholder="Type to search" autoCorrect={false} />
      {shown.map((o) => (
        <Pressable
          key={o}
          accessibilityRole="button"
          onPress={() => {
            onChange(o);
            setQ('');
            setOpen(false);
          }}
          style={[styles.row, { borderColor: o === value ? t.colors.primary : t.colors.border, borderRadius: t.radius.md }]}
        >
          <AppText>{o}</AppText>
        </Pressable>
      ))}
      {shown.length === 0 ? <AppText color="textMuted">Nothing matches. Choose “Other” if it is not listed.</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1.5, paddingHorizontal: 14, minHeight: minTouch - 4, justifyContent: 'center' },
  row: { borderWidth: 1, paddingHorizontal: 14, minHeight: minTouch, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
