import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextProps, View, ViewStyle } from 'react-native';
import { ArrowUpRight, LucideIcon } from 'lucide-react-native';

export const C = {
  ink: '#173C37', muted: '#72807A', bg: '#F7F7F0', paper: '#FFFFFF', line: '#E2E7DD',
  mint: '#DDEFCB', green: '#37734E', coral: '#F37858', yellow: '#F4D879', pale: '#EDF1E8',
};

export function T({ style, weight = 'regular', ...props }: TextProps & { weight?: 'regular' | 'medium' | 'bold' | 'display' }) {
  return <Text {...props} style={[{ color: C.ink, fontFamily: weight === 'display' ? 'SpaceGrotesk_700Bold' : weight === 'bold' ? 'DMSans_700Bold' : weight === 'medium' ? 'DMSans_500Medium' : 'DMSans_400Regular' }, style]} />;
}

export function Button({ title, onPress, variant = 'primary', icon: Icon, disabled, testID, style }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost'; icon?: LucideIcon; disabled?: boolean; testID?: string; style?: ViewStyle;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} testID={testID} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.button, variant === 'primary' ? s.primary : variant === 'secondary' ? s.secondary : s.ghost, style, { opacity: disabled ? .45 : pressed ? .75 : 1 }]}>
    <T weight="bold" style={{ fontSize: 14, color: variant === 'primary' ? 'white' : C.ink }}>{title}</T>
    {Icon && <Icon size={17} color={variant === 'primary' ? 'white' : C.ink} strokeWidth={2} />}
  </Pressable>;
}

export function Label({ children, color = C.muted }: { children: React.ReactNode; color?: string }) {
  return <T weight="bold" style={{ fontSize: 10, letterSpacing: 1.8, color }}>{children}</T>;
}

export function Pill({ children, color = C.pale, ink = C.ink }: { children: React.ReactNode; color?: string; ink?: string }) {
  return <View style={{ alignSelf: 'flex-start', backgroundColor: color, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}><T weight="bold" style={{ fontSize: 10, color: ink, letterSpacing: .4 }}>{children}</T></View>;
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
    <View style={{ width: compact ? 33 : 42, height: compact ? 33 : 42, backgroundColor: C.ink, borderRadius: 12, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] }}><T weight="display" style={{ fontSize: compact ? 19 : 23, color: C.mint }}>60</T></View>
    <T weight="display" style={{ fontSize: compact ? 23 : 28, letterSpacing: -1.6 }}>in<T style={{ color: C.coral }}>60</T><T style={{ fontSize: 11, color: C.coral }}> ✦</T></T>
  </View>;
}

export function Empty({ title, subtitle, icon: Icon = ArrowUpRight }: { title: string; subtitle: string; icon?: LucideIcon }) {
  return <View style={{ padding: 35, alignItems: 'center', gap: 12, backgroundColor: C.pale, borderRadius: 24 }}>
    <Icon size={28} color={C.green} /><T weight="display" style={{ fontSize: 20, textAlign: 'center' }}>{title}</T><T style={{ color: C.muted, textAlign: 'center', maxWidth: 350, lineHeight: 22 }}>{subtitle}</T>
  </View>;
}

export function Loading() { return <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 24 }}><Brand /><ActivityIndicator color={C.green} /><T style={{ color: C.muted }}>A little number magic…</T></View>; }

const s = StyleSheet.create({
  button: { minHeight: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 13, paddingHorizontal: 20, paddingVertical: 12 },
  primary: { backgroundColor: C.ink }, secondary: { backgroundColor: C.mint }, ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line },
});
