import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { ArrowUpRight, BookOpen, ChevronDown, Gamepad2, Leaf, Sparkles, TrendingUp, Users, X } from 'lucide-react-native';
import { AVATARS, AppState, createDefaultState, getActiveProfile, loadState, recordSession, saveState } from './src/profiles';
import { Level, Mode, Session, WorldId, WORLDS } from './src/game';
import { Brand, C, Label, Loading, T } from './src/ui';
import { GuideScreen, Home, ModeScreen, ProgressScreen, WorldScreen } from './src/Lobby';
import { FamilyScreen, ProfilePicker } from './src/Family';
import { GameScreen, ResultScreen } from './src/Play';

type Tab = 'play' | 'progress' | 'family' | 'guide';
const navigation: { id: Tab; label: string; short: string; icon: typeof Gamepad2 }[] = [
  { id: 'play', label: 'Play & explore', short: 'Play', icon: Gamepad2 },
  { id: 'progress', label: 'My progress', short: 'Progress', icon: TrendingUp },
  { id: 'family', label: 'Family profiles', short: 'Family', icon: Users },
  { id: 'guide', label: 'How to play', short: 'How to play', icon: BookOpen },
];

export default function App() {
  return <SafeAreaProvider><StatusBar style="dark" /><Application /></SafeAreaProvider>;
}

function Application() {
  const [fontsLoaded, fontError] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_700Bold, SpaceGrotesk_700Bold });
  const [state, setState] = useState<AppState>(() => createDefaultState());
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [tab, setTab] = useState<Tab>('play');
  const [world, setWorld] = useState<WorldId | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [run, setRun] = useState<{ level: Level; mode: Mode; profileId: string; key: number } | null>(null);
  const [result, setResult] = useState<Session | null>(null);
  const [picker, setPicker] = useState(false);
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const wide = width >= 1000;
  const scroll = useRef<ScrollView>(null);
  const saveRevision = useRef(0);
  const profile = getActiveProfile(state)!;
  const avatar = AVATARS.find(a => a.id === profile.avatar)?.emoji ?? '☀️';

  useEffect(() => {
    let active = true;
    loadState().then(saved => { if (active) { setState(saved); setLoaded(true); } });
    if (Platform.OS === 'web') document.title = '60-in-60 · A little practice. A lot of possibility.';
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const revision = ++saveRevision.current;
    saveState(state).then(() => { if (revision === saveRevision.current) setStorageError(''); }).catch(() => { if (revision === saveRevision.current) setStorageError('Progress could not be saved on this device. Check available storage, then reload to try again.'); });
  }, [state, loaded]);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [tab, world, level, profile.id]);
  useEffect(() => {
    if (run) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (picker) { setPicker(false); return true; }
      if (result) { setResult(null); return true; }
      if (level) { setLevel(null); return true; }
      if (world) { setWorld(null); return true; }
      if (tab !== 'play') { setTab('play'); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [run, picker, result, level, world, tab]);

  const goTab = (next: Tab) => { setTab(next); setWorld(null); setLevel(null); setResult(null); };
  const selectWorld = (id: WorldId) => { setTab('play'); setWorld(id); setLevel(null); };
  const selectLevel = (next: Level) => { setTab('play'); setWorld(next.worldId); setLevel(next); };
  const start = (mode: Mode, nextLevel = level!) => { setResult(null); setRun({ level: nextLevel, mode, profileId: profile.id, key: Date.now() }); };
  const finish = useCallback((session: Session) => {
    if (!run) return;
    setState(previous => ({ ...previous, profiles: previous.profiles.map(p => p.id === run.profileId ? recordSession(p, session) : p) }));
    setResult(session); setRun(null);
  }, [run]);

  if (!loaded || (!fontsLoaded && !fontError)) return <Loading />;

  if (run) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><GameScreen key={run.key} level={run.level} mode={run.mode} playerName={profile.name} haptics={state.haptics} onFinish={finish} onQuit={() => setRun(null)} /></SafeAreaView>;
  if (result) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><ResultScreen session={result} playerName={profile.name} onReplay={() => start(result.mode, result.level)} onLevels={() => { selectLevel(result.level); setResult(null); }} onHome={() => goTab('play')} />{storageError ? <T accessibilityRole="alert" style={s.storageError}>{storageError}</T> : null}</SafeAreaView>;

  return <SafeAreaView style={s.app} edges={['top', 'left', 'right', 'bottom']}>
    {desktop && <View style={s.sidebar}>
      <Brand />
      <T style={s.brandSubtitle}>Small steps. Big confidence.</T>
      <View style={{ gap: 7, marginTop: 43 }}><Label>YOUR PRACTICE SPACE</Label><View style={{ gap: 6, marginTop: 13 }}>{navigation.map(n => <NavItem key={n.id} item={n} active={tab === n.id} onPress={() => goTab(n.id)} />)}</View></View>
      <View style={{ flex: 1 }} />
      <View style={s.sidebarNote}><Leaf size={21} color={C.green} /><T weight="display" style={{ fontSize: 18, lineHeight: 24 }}>A little better,{"\n"}a little every day.</T><T style={{ color: C.muted, fontSize: 11, lineHeight: 19 }}>Your pace is the right pace. Keep showing up for yourself.</T><View style={s.noteLine} /><Label color={C.green}>KEEP GROWING ✦</Label></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 25 }}><View style={s.dot} /><T style={{ fontSize: 10, color: C.muted }}>Made for every curious mind.</T></View>
    </View>}
    <View style={{ flex: 1 }}>
      <View style={[s.topbar, !desktop && { paddingHorizontal: 20, minHeight: 73 }]}>
        {desktop ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Sparkles size={14} color={C.green} /><Label>THE PRACTICE CLUB</Label></View> : <Brand compact />}
        <Pressable testID="profile-picker" accessibilityRole="button" accessibilityLabel={`Switch player, current player ${profile.name}`} onPress={() => setPicker(true)} style={s.profileButton}>
          <View style={[s.avatar, { backgroundColor: profile.color }]}><T style={{ fontSize: 20 }}>{avatar}</T></View><T weight="bold" style={{ fontSize: 12, maxWidth: 110 }} numberOfLines={1}>{profile.name}</T><ChevronDown size={14} color={C.muted} />
        </Pressable>
      </View>
      {storageError ? <T accessibilityRole="alert" style={s.storageError}>{storageError}</T> : null}
      <ScrollView ref={scroll} showsVerticalScrollIndicator={false} contentContainerStyle={[s.contentContainer, !desktop && { padding: 20, paddingBottom: 30 }]}>
        <View style={{ width: '100%', maxWidth: 1040, alignSelf: 'center' }}>
          {tab === 'play' ? level ? <ModeScreen level={level} profile={profile} wide={wide} onStart={start} onBack={() => setLevel(null)} /> : world ? <WorldScreen world={WORLDS.find(w => w.id === world)!} profile={profile} wide={wide} onBack={() => setWorld(null)} onLevel={selectLevel} /> : <Home profile={profile} wide={wide} onWorld={selectWorld} onLevel={selectLevel} />
            : tab === 'progress' ? <ProgressScreen profile={profile} wide={wide} onLevel={selectLevel} />
              : tab === 'family' ? <FamilyScreen state={state} onChange={setState} wide={wide} /> : <GuideScreen />}
          <View style={s.footer}><Brand compact /><T style={{ color: C.muted, fontSize: 10 }}>Less pressure. More possibility.</T><T style={{ color: C.muted, fontSize: 10 }}>MADE TO GROW WITH YOU ↗</T></View>
        </View>
      </ScrollView>
      {!desktop && <View style={s.bottomNav}>{navigation.map(n => <NavItem key={n.id} item={n} compact active={tab === n.id} onPress={() => goTab(n.id)} />)}</View>}
    </View>
    <Modal visible={picker} transparent animationType="fade" onRequestClose={() => setPicker(false)}><View style={s.modalBackdrop}><View style={s.modalCard}><Pressable accessibilityRole="button" accessibilityLabel="Close player picker" onPress={() => setPicker(false)} style={s.modalClose}><X size={20} color={C.ink} /></Pressable><ProfilePicker state={state} onChange={setState} onClose={() => setPicker(false)} onFamily={() => { setPicker(false); goTab('family'); }} /></View></View></Modal>
  </SafeAreaView>;
}

function NavItem({ item, active, onPress, compact = false }: { item: typeof navigation[number]; active: boolean; onPress: () => void; compact?: boolean }) {
  const Icon = item.icon;
  return <Pressable testID={`nav-${item.id}`} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [compact ? s.bottomItem : s.navItem, { backgroundColor: active ? compact ? 'transparent' : C.mint : 'transparent', opacity: pressed ? .65 : 1 }]}><Icon size={compact ? 21 : 19} color={active ? C.ink : C.muted} strokeWidth={active ? 2.3 : 1.7} /><T weight={active ? 'bold' : 'medium'} style={{ color: active ? C.ink : C.muted, fontSize: compact ? 9 : 12 }}>{compact ? item.short : item.label}</T>{!compact && active && <View style={[s.dot, { marginLeft: 'auto' }]} />}{compact && active && <View style={{ backgroundColor: C.coral, width: 13, height: 3, borderRadius: 3, marginTop: 1 }} />}</Pressable>;
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg, flexDirection: 'row' }, sidebar: { width: 225, backgroundColor: '#FCFCF7', borderRightWidth: 1, borderColor: C.line, paddingHorizontal: 25, paddingVertical: 32 }, brandSubtitle: { color: C.muted, fontSize: 10, marginTop: 13 },
  navItem: { minHeight: 47, borderRadius: 13, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 11 }, dot: { width: 5, height: 5, borderRadius: 5, backgroundColor: C.green }, sidebarNote: { backgroundColor: C.pale, borderRadius: 17, padding: 18, gap: 13 }, noteLine: { height: 1, backgroundColor: '#D6DFD0', marginVertical: 2 },
  topbar: { paddingHorizontal: 38, minHeight: 79, borderBottomWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }, profileButton: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 5 }, avatar: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  contentContainer: { padding: 38, paddingTop: 31, paddingBottom: 25 }, footer: { marginTop: 35, paddingTop: 22, borderTopWidth: 1, borderColor: C.line, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 17, opacity: .75 },
  bottomNav: { flexDirection: 'row', backgroundColor: '#FCFCF7', borderTopWidth: 1, borderColor: C.line, minHeight: 69, paddingHorizontal: 15, paddingTop: 12, paddingBottom: 6 }, bottomItem: { flex: 1, gap: 5, alignItems: 'center', justifyContent: 'flex-start', paddingVertical: 3 },
  modalBackdrop: { flex: 1, backgroundColor: '#173C3777', justifyContent: 'center', alignItems: 'center', padding: 24 }, modalCard: { width: '100%', maxWidth: 440, maxHeight: '85%', backgroundColor: C.bg, padding: 26, borderRadius: 24 }, modalClose: { alignSelf: 'flex-end', padding: 4, marginBottom: 9 }, storageError: { backgroundColor: '#F8DAD0', padding: 14, color: '#8B3E2E', fontSize: 12, lineHeight: 19 },
});
