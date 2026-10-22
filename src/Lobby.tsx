import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ArrowLeft, ArrowRight, ChevronRight, Trophy } from 'lucide-react-native';
import { C, Button, Empty, Label, T } from './ui';
import { WorldArt } from './art';
import { getLevel, getLevels, Level, OPERATIONS, Operation, World, WORLDS, WorldId } from './game';
import { Profile, practiceStreak } from './profiles';
import { knownCount, rangeEarned } from './recall';
import { FactGrid, GridLegend, RangePills } from './FactGrid';

export function recommendedLevel(profile: Profile, world: World): Level {
  return getLevels(world.id).find(l => knownCount(profile.facts, world.operations, l.range) < l.range * l.range * world.operations.length) ?? getLevels(world.id)[2];
}
function FactOverview({ profile, wide, onWorld }: { profile: Profile; wide: boolean; onWorld: (id: WorldId) => void }) {
  const total = knownCount(profile.facts); const streak = practiceStreak(profile.history);
  return <View style={{ gap: 18 }}>
    <View style={{ gap: 5 }}><Label>YOUR FACTS</Label><T testID="total-by-heart" weight="display" style={{ fontSize: wide ? 38 : 30, letterSpacing: -.7 }}>{total} of 576 by heart</T><T style={s.sub}>Trophies: {profile.earnedTrophies.length} of 12{streak >= 2 ? ` · ${streak} days in a row` : ''}</T></View>
    <View style={s.miniGrids}>{OPERATIONS.map(op => {
      const world = WORLDS.find(w => w.id === op)!; const count = knownCount(profile.facts, [op]);
      return <Pressable key={op} testID={`overview-${op}`} accessibilityRole="button" accessibilityLabel={`${world.name}, ${count} of 144 by heart`} onPress={() => onWorld(op)} style={({ pressed }) => [s.miniCard, { width: wide ? '23.8%' : '48%', opacity: pressed ? .75 : 1 }]}>
        <View style={s.rowBetween}><T weight="display" style={{ fontSize: 22 }}>{world.symbol}</T><T weight="bold" style={{ fontSize: 12 }}>{count}/144</T></View>
        <FactGrid operation={op} facts={profile.facts} mini />
        <RangePills data={profile} operation={op} />
      </Pressable>;
    })}</View>
    <GridLegend />
  </View>;
}
export function Home({ profile, wide, onWorld }: { profile: Profile; wide: boolean; onWorld: (id: WorldId) => void }) {
  return <View style={{ gap: 30 }}>
    <FactOverview profile={profile} wide={wide} onWorld={onWorld} />
    <View style={{ gap: 15 }}><T weight="display" style={{ fontSize: 25 }}>A world of progress.</T>
      <View style={{ gap: 10 }}>{WORLDS.map((world, index) => {
        const earned = getLevels(world.id).filter(l => rangeEarned(profile, world.operations, l.range));
        return <Pressable key={world.id} testID={`world-${world.id}`} accessibilityRole="button" accessibilityLabel={`Explore ${world.name}`} onPress={() => onWorld(world.id)} style={({ pressed }) => [s.worldRow, { opacity: pressed ? .75 : 1 }]}>
          <View style={[s.worldTile, { backgroundColor: world.color }]}><T weight="display" style={{ fontSize: 21 }}>{world.symbol}</T></View>
          <View style={{ flex: 1, gap: 6 }}><T weight="bold" style={{ fontSize: 15 }}>{world.name}</T>{earned.length > 0 && <View testID={`world-trophies-${world.id}`} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>{earned.map(l => <View key={l.id} style={s.earnedBadge}><Trophy size={10} color={C.ink} /><T weight="bold" style={{ fontSize: 10 }}>1–{l.range}</T></View>)}</View>}</View><ChevronRight size={19} color={C.muted} />
        </Pressable>;
      })}</View>
    </View>
  </View>;
}
export function WorldScreen({ world, profile, onBack, onStart, wide }: { world: World; profile: Profile; onBack: () => void; onStart: (l: Level) => void; wide: boolean }) {
  const single = world.operations.length === 1; const next = recommendedLevel(profile, world);
  const count = knownCount(profile.facts, world.operations);
  return <View style={{ gap: 20 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="All worlds" onPress={onBack} style={s.back}><ArrowLeft size={16} color={C.muted} /><T style={s.sub}>All worlds</T></Pressable>
    <View style={[s.worldHero, { backgroundColor: world.color }]}><View style={{ flex: 1, gap: 9 }}><Label color={C.green}>WORLD {String(WORLDS.indexOf(world) + 1).padStart(2, '0')} / 07</Label><T weight="display" style={{ fontSize: wide ? 40 : 30 }}>{world.name}</T><T style={{ fontSize: 13, lineHeight: 20 }}>{world.subtitle}</T></View><WorldArt symbol={world.symbol} color={C.paper} size={wide ? 100 : 65} /></View>
    <View style={{ gap: 16 }}>
      <T testID="world-by-heart" weight="display" style={{ fontSize: 27 }}>{count} <T style={{ fontSize: 16, color: C.muted }}>of {144 * world.operations.length} by heart</T></T>
      {single && <FactGrid operation={world.operations[0]} facts={profile.facts} />}
      {single ? <GridLegend /> : <T style={s.sub}>Each fact adds to its operation’s grid on Home.</T>}
    </View>
    <View style={s.recommended}><View style={{ flex: 1, gap: 7 }}><Label color={C.green}>RECOMMENDED</Label><T weight="bold" style={{ fontSize: 17 }}>{next.name}</T></View><Button title="Start set" icon={ArrowRight} onPress={() => onStart(next)} testID="start-recommended" style={{ paddingHorizontal: 16 }} /></View>
    <View style={{ gap: 10 }}>{getLevels(world.id).map(level => {
      const earned = rangeEarned(profile, world.operations, level.range); const n = knownCount(profile.facts, world.operations, level.range);
      return <View key={level.id} testID={`range-${level.range}`} style={s.levelRow}>
        <View accessible accessibilityLabel={earned ? 'Trophy earned' : 'Trophy not yet earned'} style={[s.trophyBadge, { backgroundColor: earned ? C.yellow : C.pale }]}><Trophy size={23} color={earned ? C.ink : '#9AA59F'} /></View>
        <View style={{ flex: 1, gap: 5 }}><T weight="bold" style={{ fontSize: 15 }}>{level.name}</T><T style={{ fontSize: 11, color: C.muted }}>{n} of {level.range * level.range * world.operations.length} by heart</T></View>
        <Button title="Play" onPress={() => onStart(level)} testID={`play-range-${level.range}`} style={{ paddingHorizontal: 16, borderRadius: 24 }} />
      </View>;
    })}</View>
  </View>;
}
export function ProgressScreen({ profile, wide, onWorld }: { profile: Profile; wide: boolean; onWorld: (id: WorldId) => void }) {
  return <View style={{ gap: 26 }}><FactOverview profile={profile} wide={wide} onWorld={onWorld} /><T weight="display" style={{ fontSize: 24 }}>Your latest little wins.</T>
    {!profile.history.length ? <Empty title="Your story starts with one card." subtitle="Play a set to see your practice here." /> : <View style={{ gap: 10 }}>{profile.history.slice(0, 8).map(run => {
      const level = getLevel(run.levelId); const world = WORLDS.find(w => w.id === level.worldId)!;
      return <View key={run.id} testID={`history-${run.id}`} style={s.historyRow}><View style={{ flex: 1, gap: 5 }}><T weight="bold" style={{ fontSize: 13 }}>{world.name} · 1–{level.range}</T><T style={{ color: C.muted, fontSize: 11 }}>{run.practiceMissed ? 'Practice missed' : 'Set complete'} · {new Date(run.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</T></View><T weight="display" style={{ fontSize: 22 }}>{run.correct}/{run.answered}</T></View>;
    })}</View>}
  </View>;
}
export function GuideScreen() {
  const items = [
    ['A little set. Your own pace.', 'Choose a world and a number range. Each set has 20 cards, with all the time you need. Tap anywhere to skip the breathing countdown.'],
    ['Just tap the answer.', 'Use the number pad. Your answer submits as soon as all its digits are entered. Backspace lets you correct an unfinished answer.'],
    ['A miss is a moment to learn.', 'The card shows your answer and the correct one. Take a look, then tap Next when you’re ready. Every set continues to the end.'],
    ['Show what you know.', 'New facts come first, starting with the simpler ones. After that, sets bring back facts you’re learning and facts ready for a check-in.'],
    ['Know it by heart.', 'A correct answer recalled promptly, without backspace, earns a clean day. Only a fact’s first appearance each day can earn credit. Three clean days make it By heart. A clean first-ever answer can get there straight away, with a check-in soon after.'],
    ['Keep it with a check-in.', 'Facts you know by heart return for spaced reviews. A miss or a slower recall moves a fact back to Almost. Earned range trophies stay yours.'],
    ['Accuracy first. Speed comes next.', 'Add a birth year in Family to set an age-appropriate starting pace. Your recall pace then adjusts from your correct answers to familiar facts. Long interruptions are left out of timing comparisons.'],
    ['A place for every player.', 'Each player has their own grids and progress, saved on this device. Practice missed revisits just those facts, without earning daily credit.'],
  ];
  return <View style={{ gap: 26 }}><Label color={C.green}>HOW TO PLAY</Label><T weight="display" style={{ fontSize: 34 }}>Small steps. Facts by heart.</T>{items.map(([title, copy], i) => <View key={title} style={s.guideRow}><T weight="display" style={{ color: C.green, fontSize: 22 }}>{String(i + 1).padStart(2, '0')}</T><View style={{ flex: 1, gap: 7 }}><T weight="bold" style={{ fontSize: 18 }}>{title}</T><T style={{ color: C.muted, fontSize: 14, lineHeight: 22 }}>{copy}</T></View></View>)}</View>;
}
const s = StyleSheet.create({
  sub: { color: C.muted, fontSize: 13, lineHeight: 20 }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  miniGrids: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 }, miniCard: { borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, padding: 12, gap: 10 },
  worldRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 12, minHeight: 66 }, worldTile: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, earnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 3, paddingHorizontal: 7, borderRadius: 10, backgroundColor: C.yellow },
  back: { flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 44, alignSelf: 'flex-start' }, worldHero: { borderRadius: 22, padding: 23, gap: 10, flexDirection: 'row', alignItems: 'center' },
  recommended: { backgroundColor: C.pale, borderRadius: 18, padding: 16, gap: 12, flexDirection: 'row', alignItems: 'center' }, levelRow: { borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, borderRadius: 18, padding: 12, gap: 10, flexDirection: 'row', alignItems: 'center' }, trophyBadge: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  historyRow: { padding: 16, borderRadius: 16, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, flexDirection: 'row', gap: 12, alignItems: 'center' }, guideRow: { flexDirection: 'row', gap: 18, paddingBottom: 24, borderBottomWidth: 1, borderColor: C.line },
});
