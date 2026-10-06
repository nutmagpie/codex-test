import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronRight, Clock3, Heart, Keyboard, Layers3, Leaf, Sparkles, Target, Trophy, Zap } from 'lucide-react-native';
import { C, Button, Empty, Label, Pill, T } from './ui';
import { HeroArt, TrophyArt, WorldArt } from './art';
import { getLevel, getLevels, Level, Mode, MODES, World, WORLDS, WorldId } from './game';
import { Profile } from './profiles';

const worldColors = ['#DDEFCB', '#F8DAD0', '#EEE5FA', '#F8E9B5', '#D9E8F8', '#D9EEE6', '#173C37'];
const worldCopy = [
  'Little sums. A strong beginning.', 'Find the difference. Feel the progress.', 'Switch it up. Keep your rhythm.',
  'Make your times tables second nature.', 'Break it down. Build it up.', 'Two operations. One smooth flow.', 'Bring it all together. Your final frontier.',
];
export function worldColor(id: WorldId) { return worldColors[WORLDS.findIndex(w => w.id === id)] || C.mint; }
export function metrics(p: Profile) {
  return {
    mastered: Object.values(p.progress).filter(l => l.mastery).length,
    correct: p.history.reduce((n, r) => n + r.correct, 0),
    runs: p.history.length,
    practiced: Object.keys(p.progress).length,
  };
}
export function recommendedLevel(p: Profile): Level {
  return WORLDS.flatMap(w => getLevels(w.id)).find(l => !p.progress[l.id]?.mastery) || getLevels('addition')[0];
}

export function Home({ profile, wide, onWorld, onLevel }: { profile: Profile; wide: boolean; onWorld: (id: WorldId) => void; onLevel: (l: Level) => void }) {
  const m = metrics(profile);
  const next = recommendedLevel(profile);
  const w = WORLDS.find(w => w.id === next.worldId)!;
  return <View style={{ gap: 30 }}>
    <View style={s.pageHeading}>
      <View style={{ gap: 7 }}><Label>YOUR LITTLE DAILY LEVEL-UP</Label><T weight="display" style={[s.pageTitle, !wide && { fontSize: 30 }]}>Let's make it count.</T><T style={s.sub}>Good to see you, {profile.name}. Ready for a little number magic?</T></View>
      {wide && <Pill color={C.paper}>✦ BIG CONFIDENCE STARTS SMALL</Pill>}
    </View>
    <View style={[s.hero, !wide && { padding: 25 }]}>
      <View style={{ flex: 1, gap: 17, zIndex: 1 }}>
        <View style={s.heroTag}><View style={s.greenDot} /><Label color={C.green}>A LITTLE PRACTICE. A LOT OF POSSIBILITY.</Label></View>
        <T weight="display" style={[s.heroTitle, !wide && { fontSize: 37, lineHeight: 42 }]}>Small steps.{"\n"}Big number energy.</T>
        <T style={[s.heroCopy, { maxWidth: wide ? 320 : 290 }]}>Build your confidence, find your rhythm, and work your way to 60 cards in 60 seconds.</T>
        <Button title={m.runs ? 'Keep the momentum' : "Let's play"} icon={ArrowUpRight} onPress={() => onLevel(next)} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><Heart size={13} color={C.green} /><T style={{ color: C.green, fontSize: 11 }}>Three hearts. Plenty of room to grow.</T></View>
      </View>
      <View pointerEvents="none" style={[wide ? { width: 345, alignSelf: 'center', marginRight: -8 } : { position: 'absolute', right: -55, bottom: -16, opacity: .14 }]}><HeroArt size={wide ? 345 : 285} /></View>
    </View>
    <View style={[s.statsStrip, !wide && { gap: 8 }]}>
      <Stat compact={!wide} icon={Trophy} value={String(m.mastered).padStart(2, '0')} label="levels mastered" />
      <View style={s.statDivider} /><Stat compact={!wide} icon={CheckCircle2} value={String(m.correct).padStart(2, '0')} label="correct answers" />
      <View style={s.statDivider} /><Stat compact={!wide} icon={Leaf} value={String(m.runs).padStart(2, '0')} label="practice sessions" />
    </View>
    <View style={{ gap: 16 }}>
      <View style={s.sectionHeading}><View style={{ gap: 5 }}><T weight="display" style={{ fontSize: 25 }}>A world of progress.</T><T style={s.sub}>Seven worlds. Your pace. Endless possibilities.</T></View><Pill color={C.paper}>7 WORLDS</Pill></View>
      <View style={[s.worldGrid, !wide && { gap: 12 }]}>
        {WORLDS.map((world, i) => {
          const mastered = getLevels(world.id).filter(l => profile.progress[l.id]?.mastery);
          const completed = mastered.length;
          const final = i === 6;
          return <Pressable key={world.id} testID={`world-${world.id}`} accessibilityRole="button" accessibilityLabel={`Explore ${world.name}`} onPress={() => onWorld(world.id)} style={({ pressed }) => [s.worldCard, { width: wide ? (final ? '100%' : '31.8%') : '100%', backgroundColor: final ? C.ink : C.paper, opacity: pressed ? .8 : 1 }, final && s.finalWorld, final && !wide && { flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={[s.worldTop, final && { marginBottom: 0 }]}><WorldArt symbol={world.symbol} color={final ? C.mint : worldColors[i]} size={final ? 74 : 67} /><Pill color={final ? '#31514A' : C.bg} ink={final ? C.mint : C.muted}>WORLD {String(i + 1).padStart(2, '0')}</Pill></View>
            <View style={{ flex: final && wide ? 1 : undefined, minWidth: 0, gap: 7 }}>
              <T weight="display" style={{ fontSize: 20, color: final ? C.paper : C.ink }}>{world.name}</T>
              {mastered.length > 0 && <View testID={`world-mastery-badges-${world.id}`} style={s.masteryBadges}>{mastered.map(level => <View key={level.id} testID={`world-mastery-${level.id}`} accessible accessibilityLabel={`${world.name} 1 to ${level.range} mastered`} style={[s.progressBadge, s.masteredBadge]}><Trophy size={12} color={C.green} /><T weight="bold" style={{ fontSize: 11, color: C.ink }}>1–{level.range}</T></View>)}</View>}
              <T style={{ color: final ? '#B8C9BE' : C.muted, fontSize: 12, lineHeight: 19 }}>{worldCopy[i]}</T>
              {!final && <View style={s.cardFooter}><T style={{ fontSize: 11, color: C.muted }}>3 levels · {completed}/3 mastered</T><ArrowUpRight size={17} color={C.ink} /></View>}
            </View>
            {final && <View style={{ backgroundColor: C.mint, padding: 11, borderRadius: 30, alignSelf: wide ? 'center' : 'flex-end' }}><ArrowUpRight size={21} color={C.ink} /></View>}
          </Pressable>;
        })}
      </View>
    </View>
    <View style={s.note}><Sparkles size={19} color={C.green} /><T style={{ flex: 1, color: C.muted, fontSize: 12, lineHeight: 19 }}>No leaderboards. No pressure. Just you, {w.name.toLowerCase()}, and your next small win.</T></View>
  </View>;
}

function Stat({ icon: Icon, value, label, compact = false }: { icon: typeof Trophy; value: string; label: string; compact?: boolean }) {
  return <View style={[s.stat, compact && { flexDirection: 'column', alignItems: 'flex-start', gap: 8 }]}><View style={[s.statIcon, compact && { width: 30, height: 30, borderRadius: 10 }]}><Icon color={C.green} size={compact ? 16 : 19} /></View><View style={{ gap: 3 }}><T weight="display" style={{ fontSize: 25 }}>{value}</T><T style={{ fontSize: 10, color: C.muted }}>{label}</T></View></View>;
}

export function WorldScreen({ world, profile, onBack, onLevel, wide }: { world: World; profile: Profile; onBack: () => void; onLevel: (l: Level) => void; wide: boolean }) {
  const index = WORLDS.indexOf(world);
  return <View style={{ gap: 26 }}>
    <Back onPress={onBack} label="All worlds" />
    <View style={[s.worldHero, { backgroundColor: index === 6 ? C.mint : worldColors[index] }]}><View style={{ flex: 1, gap: 12 }}><Label color={C.green}>WORLD {String(index + 1).padStart(2, '0')} / 07</Label><T weight="display" style={{ fontSize: wide ? 42 : 32 }}>{world.name}</T><T style={{ fontSize: 14, lineHeight: 22, maxWidth: 360 }}>{worldCopy[index]} Start small and build up, one flash card at a time.</T></View><WorldArt symbol={world.symbol} color={C.paper} size={wide ? 150 : 80} /></View>
    <View style={{ gap: 7 }}><T weight="display" style={{ fontSize: 25 }}>Find your starting point.</T><T style={s.sub}>Each level has Learn, Speed, and Mastery. Jump in anywhere.</T></View>
    {getLevels(world.id).map((level, i) => {
      const p = profile.progress[level.id];
      return <Pressable key={level.id} accessibilityRole="button" accessibilityLabel={`Numbers 1 to ${level.range}`} testID={`level-${level.range}`} onPress={() => onLevel(level)} style={({ pressed }) => [s.levelRow, { opacity: pressed ? .7 : 1 }]}>
        <View style={[s.levelNumber, { backgroundColor: worldColors[index === 6 ? 0 : index] }]}><T weight="display" style={{ fontSize: 25 }}>{String(i + 1).padStart(2, '0')}</T></View>
        <View style={{ flex: 1, gap: 7 }}><T weight="display" style={{ fontSize: 21 }}>Numbers 1–{level.range}</T><T style={{ color: C.muted, fontSize: 12 }}>{i === 0 ? 'Build a happy little foundation.' : i === 1 ? 'Stretch your skills a little further.' : 'Your full set. Your next big step.'}</T><View style={{ flexDirection: 'row', gap: 12 }}>{(['learn', 'speed', 'mastery'] as Mode[]).map(mode => <View key={mode} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} color={p?.[mode] ? C.green : '#CED5CB'} /><T style={{ fontSize: 10, color: p?.[mode] ? C.green : C.muted }}>{MODES[mode].name}</T></View>)}</View></View>
        <ChevronRight size={21} color={C.ink} />
      </Pressable>;
    })}
    <View style={s.note}><Heart size={18} color={C.coral} /><T style={{ flex: 1, fontSize: 12, color: C.muted, lineHeight: 20 }}>Mistakes are part of the magic. Every session starts with three hearts, so you can miss two cards and still finish strong.</T></View>
  </View>;
}

export function ModeScreen({ level, profile, wide, onBack, onStart }: { level: Level; profile: Profile; wide: boolean; onBack: () => void; onStart: (mode: Mode) => void }) {
  const world = WORLDS.find(w => w.id === level.worldId)!;
  const p = profile.progress[level.id];
  const icons = { learn: Leaf, speed: Zap, mastery: Trophy };
  const colors = { learn: C.mint, speed: '#F8E9B5', mastery: '#F8DAD0' };
  return <View style={{ gap: 27 }}>
    <Back onPress={onBack} label={world.name} />
    <View style={{ alignItems: 'center', gap: 12, paddingVertical: 12 }}><WorldArt symbol={world.symbol} color={worldColor(world.id) === C.ink ? C.mint : worldColor(world.id)} size={93} /><Label>{world.name.toUpperCase()}</Label><T weight="display" style={{ fontSize: wide ? 40 : 32 }}>Numbers 1–{level.range}</T><T style={[s.sub, { textAlign: 'center' }]}>Accuracy first. Speed next. Confidence always.</T></View>
    {p?.bestTimeMs !== null && p?.bestTimeMs !== undefined && <View style={{ alignItems: 'center' }}><Pill color={C.mint}>✦ PERSONAL BEST · {(p.bestTimeMs / 1000).toFixed(1)}s IN MASTERY</Pill></View>}
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16 }}>
      {(['learn', 'speed', 'mastery'] as Mode[]).map((mode, i) => {
        const Icon = icons[mode];
        return <View key={mode} style={[s.modeCard, { flex: wide ? 1 : undefined }, mode === 'mastery' && { borderColor: C.coral }]}>
          <View style={s.sectionHeading}><View style={{ backgroundColor: colors[mode], padding: 13, borderRadius: 16 }}><Icon size={24} color={C.ink} /></View><Label>0{i + 1}</Label></View>
          <T weight="display" style={{ fontSize: 27 }}>{MODES[mode].name}</T><T weight="bold" style={{ fontSize: 12 }}>{mode === 'learn' ? 'Make friends with the facts.' : mode === 'speed' ? 'Find your flow.' : 'Your one-minute moment.'}</T>
          <T style={{ fontSize: 13, color: C.muted, lineHeight: 21, minHeight: wide ? 67 : undefined }}>{mode === 'learn' ? 'Take your time. Get comfortable with each question, without a ticking clock.' : mode === 'speed' ? 'A shorter set with a little time pressure. Build a rhythm, one answer at a time.' : 'The original challenge. Answer 60 cards in 60 seconds, with two misses to spare.'}</T>
          <View style={s.modeDetails}><Layers3 size={15} color={C.green} /><T style={{ fontSize: 11 }}>{MODES[mode].cards} cards</T><Clock3 size={15} color={C.green} /><T style={{ fontSize: 11 }}>{MODES[mode].seconds ? `${MODES[mode].seconds} seconds` : 'No timer'}</T></View>
          {p?.[mode] && <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}><Check size={13} color={C.green} /><T weight="bold" style={{ fontSize: 11, color: C.green }}>Completed · ready for another round</T></View>}
          <Button title={`Start ${MODES[mode].name}`} testID={`start-${mode}`} onPress={() => onStart(mode)} variant={mode === 'mastery' ? 'primary' : 'secondary'} icon={ArrowRight} style={{ marginTop: 'auto' }} />
        </View>;
      })}
    </View>
    <View style={[s.note, { justifyContent: 'center' }]}><Keyboard size={19} color={C.green} /><T style={{ fontSize: 12, color: C.muted, flexShrink: 1, lineHeight: 19 }}>No Enter button. Answers submit when all digits are in. Use backspace before the last digit to make a change.</T></View>
  </View>;
}

export function ProgressScreen({ profile, wide, onLevel }: { profile: Profile; wide: boolean; onLevel: (l: Level) => void }) {
  const m = metrics(profile);
  return <View style={{ gap: 25 }}>
    <View style={{ gap: 8 }}><Label>YOUR EFFORT, MAKING WAVES</Label><T weight="display" style={s.pageTitle}>Look how you're growing.</T><T style={s.sub}>Every small step counts, {profile.name}.</T></View>
    <View style={[s.worldHero, { backgroundColor: C.mint }]}><View style={{ flex: 1, gap: 9 }}><Label color={C.green}>YOUR MASTERY COLLECTION</Label><T weight="display" style={{ fontSize: 40 }}>{m.mastered}<T style={{ fontSize: 22, color: C.green }}> / 21</T></T><T style={{ fontSize: 13, lineHeight: 22, maxWidth: 330 }}>One minute of focus. A skill for life. Master all three levels in each world to fill your collection.</T></View><TrophyArt size={wide ? 155 : 90} /></View>
    <View style={s.statsStrip}><Stat compact={!wide} icon={CheckCircle2} value={String(m.correct)} label="correct answers*" /><View style={s.statDivider} /><Stat compact={!wide} icon={Target} value={String(m.practiced)} label="levels explored" /><View style={s.statDivider} /><Stat compact={!wide} icon={Leaf} value={String(m.runs)} label="sessions*" /></View>
    <View style={{ gap: 13 }}><T weight="display" style={{ fontSize: 24 }}>Your worlds, at a glance.</T>{WORLDS.map(w => <View key={w.id} style={s.progressWorld}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><WorldArt symbol={w.symbol} color={w.id === 'all' ? C.mint : worldColor(w.id)} size={43} /><T weight="bold" style={{ fontSize: 14 }}>{w.name}</T></View><View style={{ flexDirection: 'row', gap: 8 }}>{getLevels(w.id).map(l => <Pressable key={l.id} accessibilityRole="button" accessibilityLabel={`${w.name} 1 to ${l.range}`} onPress={() => onLevel(l)} style={[s.progressBadge, profile.progress[l.id]?.mastery && { backgroundColor: C.mint, borderColor: C.green }]}>{profile.progress[l.id]?.mastery && <Trophy size={12} color={C.green} />}<T weight="bold" style={{ fontSize: 11 }}>1–{l.range}</T></Pressable>)}</View></View>)}</View>
    <T weight="display" style={{ fontSize: 24 }}>Your latest little wins.</T>
    {!profile.history.length ? <Empty title="Your story starts with one card." subtitle="Play a session to see your accuracy, pace, and progress here." icon={Leaf} /> : <View style={{ gap: 10 }}>{profile.history.slice(0, 8).map(run => {
      const l = getLevel(run.levelId); const w = WORLDS.find(w => w.id === l.worldId)!;
      const mastered = run.passed && run.mode === 'mastery';
      return <View key={run.id} testID={`history-run-${run.id}`} style={s.history}><View testID={`history-${mastered ? 'trophy' : run.passed ? 'check' : 'practice'}-${run.id}`} accessible accessibilityLabel={mastered ? 'Mastery completed' : run.passed ? 'Practice completed' : 'Building confidence'} style={[s.historyIcon, { backgroundColor: run.passed ? C.mint : '#F8E9B5' }]}>{mastered ? <Trophy size={19} color={C.green} /> : run.passed ? <Check size={19} color={C.green} /> : <Leaf size={19} color={C.green} />}</View><View style={{ flex: 1, gap: 4 }}><T weight="bold" style={{ fontSize: 12 }}>{w.name} · 1–{l.range}</T><T style={{ color: C.muted, fontSize: 11 }}>{MODES[run.mode].name} · {run.passed ? 'Completed' : 'Building confidence'}</T></View><View style={{ alignItems: 'flex-end', gap: 4 }}><T weight="display" style={{ fontSize: 18 }}>{run.correct}/{MODES[run.mode].cards}</T><T style={{ fontSize: 10, color: C.muted }}>{Math.ceil(run.elapsedMs / 1000)}s · {new Date(run.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</T></View></View>;
    })}</View>}
    <T style={{ fontSize: 10, color: C.muted }}>* Answer and session totals reflect your most recent 100 sessions. Mastery stays saved.</T>
  </View>;
}

export function GuideScreen() {
  const items = [
    { icon: Leaf, title: 'Start with feeling sure.', text: 'Learn gives you 20 cards with no clock. Read the card, take a breath, and answer. If a fact feels tricky, you’ll see the right answer before moving on.' },
    { icon: Zap, title: 'Then find your rhythm.', text: 'Speed gives you 30 cards in 45 seconds. The goal is a little more fluency. Practice as often as you like before taking on Mastery.' },
    { icon: Trophy, title: 'Make your one-minute moment.', text: 'Mastery is 60 cards in 60 seconds. Finish the whole deck before time runs out with at least 58 correct answers, and the level is yours.' },
    { icon: Heart, title: 'Give mistakes a little space.', text: 'Every mode starts with three hearts. A wrong answer uses one heart. You can miss two and still pass. The third miss ends the session, ready for a fresh start.' },
    { icon: Keyboard, title: 'Tap. Tap. Next card.', text: 'Your answer submits automatically after the expected number of digits. There’s no Enter button. You can erase a digit with backspace before you enter the final digit. A one-digit answer submits immediately. On a computer, number keys work too.' },
    { icon: Layers3, title: 'Explore at your own pace.', text: 'All seven worlds are open from the start, with number ranges 1–5, 1–10, and 1–12. Subtraction answers stay at zero or above. Division always uses whole-number answers.' },
  ];
  return <View style={{ gap: 24 }}><View style={{ gap: 8 }}><Label>A CALMER KIND OF ARCADE</Label><T weight="display" style={s.pageTitle}>Confidence is the high score.</T><T style={s.sub}>A few small things to know before you get growing.</T></View>{items.map(({ icon: Icon, title, text }) => <View key={title} style={s.guideRow}><View style={s.statIcon}><Icon size={23} color={C.green} /></View><View style={{ flex: 1, gap: 8 }}><T weight="display" style={{ fontSize: 20 }}>{title}</T><T style={{ color: C.muted, fontSize: 13, lineHeight: 23 }}>{text}</T></View></View>)}<View style={s.note}><Sparkles size={23} color={C.green} /><T style={{ flex: 1, fontSize: 12, color: C.muted, lineHeight: 21 }}>Made for curious minds of every age. Profiles and progress live on this device, with no account, ads, or public scores.</T></View></View>;
}

export function Back({ onPress, label }: { onPress: () => void; label: string }) { return <Pressable accessibilityRole="button" accessibilityLabel={`Back to ${label}`} onPress={onPress} style={{ flexDirection: 'row', gap: 9, alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 8 }}><ArrowLeft size={16} color={C.ink} /><T weight="medium" style={{ fontSize: 12 }}>{label}</T></Pressable>; }

const s = StyleSheet.create({
  pageHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20 }, pageTitle: { fontSize: 34, letterSpacing: -1.2 }, sub: { color: C.muted, fontSize: 12, lineHeight: 20 },
  hero: { backgroundColor: C.mint, borderRadius: 25, padding: 34, flexDirection: 'row', overflow: 'hidden', minHeight: 320 },
  heroTag: { flexDirection: 'row', alignItems: 'center', gap: 7 }, greenDot: { height: 5, width: 5, borderRadius: 5, backgroundColor: C.green },
  heroTitle: { fontSize: 45, lineHeight: 49, letterSpacing: -2 }, heroCopy: { fontSize: 13, lineHeight: 23, color: '#526D52' },
  statsStrip: { padding: 19, borderWidth: 1, borderColor: C.line, borderRadius: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: C.paper, gap: 15 },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }, statIcon: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', backgroundColor: C.pale, borderRadius: 14 }, statDivider: { height: 34, width: 1, backgroundColor: C.line },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, worldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  worldCard: { borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 21, minHeight: 218, justifyContent: 'space-between' }, worldTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }, cardFooter: { borderTopWidth: 1, borderColor: C.line, marginTop: 9, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, finalWorld: { flexDirection: 'row', alignItems: 'center', gap: 21, minHeight: 126 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 16, backgroundColor: C.pale, borderRadius: 14 },
  worldHero: { borderRadius: 24, padding: 29, flexDirection: 'row', alignItems: 'center', gap: 14 }, levelRow: { padding: 22, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 20 }, levelNumber: { width: 57, height: 65, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modeCard: { backgroundColor: C.paper, borderColor: C.line, borderWidth: 1, borderRadius: 22, padding: 24, gap: 17 }, modeDetails: { flexDirection: 'row', gap: 7, alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderColor: C.line },
  progressWorld: { borderColor: C.line, borderWidth: 1, borderRadius: 16, backgroundColor: C.paper, padding: 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, progressBadge: { borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, flexDirection: 'row', gap: 4, alignItems: 'center' },
  masteryBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }, masteredBadge: { backgroundColor: C.mint, borderColor: C.green },
  history: { backgroundColor: C.paper, padding: 16, borderWidth: 1, borderColor: C.line, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, historyIcon: { width: 39, height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  guideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 18, borderBottomWidth: 1, borderColor: C.line, paddingBottom: 24 },
});
