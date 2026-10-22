import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, BackHandler, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight, Check, Delete, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Answer, CreditContext, expectedDigits, Question, Session, submitAnswer, WORLDS } from './game';
import { Profile, RunRecord, sessionRecord } from './profileModel';
import { coachingLine, factLabel, setWin, strategy } from './coaching';
import { Button, C, Label, Pill, T } from './ui';

export function GameScreen({ initialSession, playerName, haptics, onPresent, onAnswer, onFinish, onQuit }: {
  initialSession: Session; playerName: string; haptics: boolean;
  onPresent: (q: Question, at: Date) => CreditContext; onAnswer: (answer: Answer) => void;
  onFinish: (session: Session) => void; onQuit: () => void;
}) {
  const [session, setSession] = useState(initialSession); const current = useRef(session);
  const [ready, setReady] = useState(false); const readyRef = useRef(false); const [countdown, setCountdown] = useState(3);
  const [input, setInput] = useState(''); const inputRef = useRef('');
  const [waiting, setWaiting] = useState(false); const waitingRef = useRef(false);
  const [success, setSuccess] = useState(false); const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [quit, setQuit] = useState(false); const completed = useRef(false); const scroll = useRef<ScrollView>(null);
  const presenter = useRef(onPresent); presenter.current = onPresent;
  const presentation = useRef<{ questionId: string; startedAt: number; firstKeyMs: number | null; usedBackspace: boolean; credit: CreditContext } | null>(null);
  const breathe = useRef(new Animated.Value(.86)).current;
  const { height, width } = useWindowDimensions(); const insets = useSafeAreaInsets();
  const usableHeight = height - insets.top - insets.bottom; const compact = usableHeight < 760; const short = usableHeight < 650;
  const keyHeight = short ? 48 : compact ? usableHeight < 690 ? 52 : 56 : 62;
  const world = WORLDS.find(w => w.id === session.level.worldId)!;
  const begin = useCallback(() => { if (readyRef.current) return; readyRef.current = true; setReady(true); }, []);
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => countdown <= 1 ? begin() : setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, ready, begin]);
  useEffect(() => {
    if (ready) return;
    let disposed = false; let animation: Animated.CompositeAnimation | undefined;
    const update = (reduced: boolean) => {
      animation?.stop();
      if (disposed || reduced) { breathe.setValue(1); return; }
      animation = Animated.loop(Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: .86, duration: 1500, useNativeDriver: true }),
      ])); animation.start();
    };
    AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => update(false));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => { disposed = true; animation?.stop(); subscription.remove(); };
  }, [ready, breathe]);
  useLayoutEffect(() => {
    if (!ready || waiting || session.status !== 'playing') return;
    const question = session.questions[session.index]; if (presentation.current?.questionId === question.id) return;
    const now = Date.now();
    presentation.current = { questionId: question.id, startedAt: now, firstKeyMs: null, usedBackspace: false, credit: presenter.current(question, new Date(now)) };
  }, [ready, waiting, session.index, session.status, session.questions]);
  useEffect(() => {
    if (session.status === 'complete' && !waiting && !completed.current) { completed.current = true; onFinish(session); }
  }, [session, waiting, onFinish]);
  useEffect(() => () => { if (feedbackTimer.current) clearTimeout(feedbackTimer.current); }, []);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setQuit(true); return true; });
    return () => subscription.remove();
  }, []);
  const pressDigit = useCallback((digit: string) => {
    const s = current.current; const p = presentation.current;
    if (!readyRef.current || waitingRef.current || s.status !== 'playing' || !p || p.questionId !== s.questions[s.index].id) return;
    const now = Date.now(); p.firstKeyMs ??= Math.max(0, now - p.startedAt);
    const nextInput = inputRef.current + digit; inputRef.current = nextInput; setInput(nextInput);
    if (nextInput.length < expectedDigits(s.questions[s.index])) return;
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    const next = submitAnswer(s, Number(nextInput), { firstKeyMs: p.firstKeyMs, submitMs: Math.max(p.firstKeyMs, now - p.startedAt), usedBackspace: p.usedBackspace, typedValue: nextInput }, p.credit, new Date(now));
    const answer = next.answers.at(-1)!;
    current.current = next; waitingRef.current = !answer.correct;
    onAnswer(answer); setSession(next); setWaiting(!answer.correct); setSuccess(answer.correct);
    if (answer.correct) {
      inputRef.current = ''; setInput('');
      feedbackTimer.current = setTimeout(() => { setSuccess(false); feedbackTimer.current = null; }, 450);
    }
    if (haptics && Platform.OS !== 'web') Haptics.notificationAsync(answer.correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }, [onAnswer, haptics]);
  const erase = useCallback(() => {
    const p = presentation.current;
    if (!readyRef.current || waitingRef.current || current.current.status !== 'playing' || !p || p.questionId !== current.current.questions[current.current.index].id) return;
    p.firstKeyMs ??= Math.max(0, Date.now() - p.startedAt); p.usedBackspace = true;
    inputRef.current = inputRef.current.slice(0, -1); setInput(inputRef.current);
  }, []);
  const nextCard = useCallback(() => {
    if (!waitingRef.current) return;
    waitingRef.current = false; inputRef.current = ''; setInput(''); setWaiting(false); setSuccess(false);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (quit || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!readyRef.current && (/^[0-9]$/.test(e.key) || e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); begin(); return; }
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); pressDigit(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); erase(); }
    };
    document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler);
  }, [pressDigit, erase, begin, quit]);
  const mistake = waiting ? session.answers.at(-1) : undefined;
  const question = mistake?.question ?? session.questions[session.index] ?? session.questions.at(-1)!;
  return <View testID="game-screen" style={{ flex: 1, backgroundColor: C.bg }}>
    {!ready ? <Pressable testID="countdown" accessibilityRole="button" accessibilityLabel="Skip countdown" onPress={begin} style={s.countdown}>
      <View style={s.ringBox}><Animated.View style={[s.breathingRing, { transform: [{ scale: breathe }] }]} /><View style={s.innerRing} /><T testID="countdown-number" weight="display" style={{ fontSize: 96, lineHeight: 115 }}>{countdown}</T></View>
    </Pressable> : <ScrollView ref={scroll} showsVerticalScrollIndicator={false} contentContainerStyle={[s.gameScroll, { gap: short ? 10 : compact ? 12 : 18, paddingHorizontal: width < 360 ? 16 : 20 }]}>
      <View style={s.gameTop}><Pressable accessibilityRole="button" accessibilityLabel="Leave set" onPress={() => setQuit(true)} style={s.circleButton}><ArrowLeft size={20} color={C.ink} /></Pressable><View style={{ flex: 1, alignItems: 'center', gap: 5 }}><Label>{session.practiceMissed ? 'PRACTICE MISSED' : session.showWhatYouKnow ? 'SHOW WHAT YOU KNOW' : 'YOUR DAILY SET'}</Label><T weight="bold" style={{ fontSize: 12, textAlign: 'center' }}>{world.name} · 1–{session.level.range}</T></View><Pill color={C.mint}>{playerName}</Pill></View>
      <View style={{ gap: 8 }}><View style={s.sectionLine}><T style={{ fontSize: 11, color: C.muted }}>One card at a time.</T><T weight="bold" testID="card-count" style={{ fontSize: 11 }}>{session.answers.length} / {session.questions.length}</T></View><View style={s.track}><View style={[s.trackFill, { width: `${session.answers.length / session.questions.length * 100}%` }]} /></View></View>
      <View testID="flash-card" style={[s.flashCard, { padding: short ? 14 : compact ? 16 : 21 }, waiting && { backgroundColor: '#FFF2ED', borderColor: C.coral }]}>
        <View style={s.sectionLine}><Label>CARD {String(Math.min(session.index + (waiting ? 0 : 1), session.questions.length)).padStart(2, '0')}</Label><View style={s.feedbackMark}>{waiting ? <X testID="mistake-indicator" accessibilityLabel="Incorrect answer" size={28} color="#AD5139" strokeWidth={3} /> : success ? <Check testID="answer-feedback" accessibilityLabel="Correct answer" size={22} color={C.green} strokeWidth={3} /> : null}</View></View>
        <View testID="question" accessibilityLabel={factLabel(question)} style={[s.equation, { minHeight: short ? 58 : compact ? 64 : 86 }]}><T weight="display" style={[s.operand, compact && { fontSize: 44 }]}>{question.left}</T><T weight="display" style={[s.operand, { color: C.coral }, compact && { fontSize: 44 }]}>{question.symbol}</T><T weight="display" style={[s.operand, compact && { fontSize: 44 }]}>{question.right}</T></View>
        <View testID="answer-slots" style={s.answerRow}>{Array.from({ length: expectedDigits(question) }, (_, i) => <View key={i} testID={`answer-slot-${i}`} style={[s.answerSlot, short && { width: 52, height: 52 }, input[i] !== undefined && { borderColor: waiting ? C.coral : C.ink, backgroundColor: waiting ? '#FBE4DC' : C.mint }]}><T testID={`answer-digit-${i}`} weight="display" style={{ fontSize: 30 }}>{input[i] ?? ''}</T></View>)}</View>
        {mistake && <View style={{ gap: 12, paddingTop: 5 }}><T testID="correct-answer" weight="bold" style={{ fontSize: 19, textAlign: 'center' }}>{factLabel(question)} = {question.answer}</T><Button title="Next" icon={ArrowRight} onPress={nextCard} testID="next-card" /></View>}
      </View>
      <View testID="keypad" style={[s.numberPad, { marginTop: 'auto' }]}>{[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'delete']].map((row, i) => <View key={i} style={{ flexDirection: 'row', gap: 12 }}>{row.map(key => key === '' ? <View key="empty" style={{ flex: 1, height: keyHeight }} /> : <Pressable key={key} testID={`key-${key}`} accessibilityRole="button" accessibilityLabel={key === 'delete' ? 'Delete last digit' : key} disabled={waiting} onPress={() => key === 'delete' ? erase() : pressDigit(key)} style={({ pressed }) => [s.key, { height: keyHeight, opacity: waiting ? .45 : pressed ? .6 : 1 }, key === 'delete' && { backgroundColor: C.pale }]}>{key === 'delete' ? <Delete size={25} color={C.ink} /> : <T weight="display" style={{ fontSize: 29 }}>{key}</T>}</Pressable>)}</View>)}</View>
    </ScrollView>}
    <Modal visible={quit} transparent animationType="fade" onRequestClose={() => setQuit(false)}><View style={s.modalBackdrop}><View style={s.modalCard}><Label>A LITTLE PAUSE</Label><T weight="display" style={{ fontSize: 25 }}>Leave this set?</T><T style={{ color: C.muted, lineHeight: 22 }}>The facts you’ve practiced stay saved. This unfinished set won’t appear in your completed sets.</T><Button title="Keep going" onPress={() => setQuit(false)} /><Button title="Leave set" variant="ghost" onPress={onQuit} /></View></View></Modal>
  </View>;
}

function duration(ms: number): string { const sec = Math.round(ms / 1000); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }
function recallTime(ms: number | null): string { return ms === null ? '—' : `${(ms / 1000).toFixed(1)} s`; }
export function ResultScreen({ session, before, after, onPractice, onAnother, onDone }: { session: Session; before: Profile; after: Profile; onPractice: () => void; onAnother: () => void; onDone: () => void }) {
  const [actionsReady, setActionsReady] = useState(false); const unlockAt = useRef(Date.now() + 900);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null); const navigated = useRef(false); const blockedGesture = useRef(false);
  const arm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; setActionsReady(true); }, Math.max(0, unlockAt.current - Date.now()));
  }, []);
  useEffect(() => { arm(); return () => { if (timer.current) clearTimeout(timer.current); }; }, [arm]);
  const noteTouch = useCallback(() => {
    if (Date.now() < unlockAt.current) { blockedGesture.current = true; unlockAt.current = Math.max(unlockAt.current, Date.now() + 450); setActionsReady(false); arm(); }
    else blockedGesture.current = false;
    return false;
  }, [arm]);
  const finishTouch = useCallback(() => {
    if (!blockedGesture.current) return;
    blockedGesture.current = false; unlockAt.current = Math.max(unlockAt.current, Date.now() + 450); setActionsReady(false); arm();
  }, [arm]);
  const act = (action: () => void) => { if (!actionsReady || blockedGesture.current || Date.now() < unlockAt.current || navigated.current) return; navigated.current = true; action(); };
  const run = sessionRecord(session); const last: RunRecord | undefined = before.history.find(r => r.levelId === session.level.id && r.practiceMissed === session.practiceMissed && r.answered === run.answered);
  const misses = session.answers.filter(a => !a.correct); const coach = coachingLine(session); const win = setWin(session, before, after, new Date(after.history[0]?.createdAt ?? Date.now()));
  const hasTiming = run.medianMs !== null;
  return <View testID="results-screen" style={{ flex: 1 }} onStartShouldSetResponderCapture={noteTouch} onPointerDownCapture={noteTouch} onPointerDown={noteTouch} onTouchStart={noteTouch} onTouchEnd={finishTouch} onPointerUp={finishTouch}><ScrollView contentContainerStyle={s.resultScroll}>
    <View style={s.result}>
      <Pill color={C.mint}>{session.practiceMissed ? 'PRACTICE COMPLETE' : 'SET COMPLETE'} · {WORLDS.find(w => w.id === session.level.worldId)!.symbol} 1–{session.level.range}</Pill>
      <View style={s.stats}>
        <Stat label="ACCURACY" value={`${run.correct}/${run.answered}`} previous={last ? `${last.correct}/${last.answered}` : null} improved={!!last && run.correct / run.answered > last.correct / last.answered} />
        <Stat label="TIME" value={hasTiming ? duration(run.elapsedMs) : '—'} previous={last && last.medianMs !== null ? duration(last.elapsedMs) : null} improved={!!last && hasTiming && run.elapsedMs < last.elapsedMs} />
        <Stat label="PER FACT" value={recallTime(run.medianMs)} previous={last && last.medianMs !== null ? recallTime(last.medianMs) : null} improved={!!last && run.medianMs !== null && last.medianMs !== null && run.medianMs < last.medianMs} />
      </View>
      {win && <View testID="set-win" style={s.resultCard}><Label color={C.green}>WINS</Label><T weight="display" style={{ fontSize: 23, lineHeight: 28 }}>{win.title}</T>{win.facts.length > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{win.facts.map(f => <View key={f.factKey} style={s.factChip}><T weight="display" style={{ fontSize: 18, color: 'white' }}>{factLabel(f)}</T></View>)}</View>}</View>}
      {(misses.length > 0 || coach) && <View testID="missed-facts-review" style={s.resultCard}>
        <Label>{misses.length ? 'MISSED' : 'NEXT STEP'}</Label>
        {coach && <T testID="coaching-line" style={{ fontSize: 14, lineHeight: 21 }}>{coach}</T>}
        {misses.map((answer, i) => <View testID={`missed-fact-${i}`} key={answer.question.id} style={[s.reviewFact, (i > 0 || !!coach) && { borderTopWidth: 1, borderColor: C.line }]}><View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}><T weight="bold" style={{ fontSize: 15 }}>{factLabel(answer.question)} = {answer.question.answer}</T><T style={{ fontSize: 13, color: C.muted }}>you typed {answer.typedValue ?? answer.value}</T></View><T style={{ fontSize: 13, lineHeight: 20, color: '#4E5B55' }}>{strategy(answer.question)}</T></View>)}
      </View>}
      <View testID="result-actions" accessibilityState={{ disabled: !actionsReady }} style={{ gap: 8, marginTop: 'auto', paddingTop: 8 }}>
        {misses.length > 0 && <Button title={`Practice missed (${misses.length})`} disabled={!actionsReady} onPress={() => act(onPractice)} testID="practice-missed" style={{ borderRadius: 28, minHeight: 52 }} />}
        <View style={{ flexDirection: 'row', gap: 8 }}><Button title={session.showWhatYouKnow ? 'Keep going' : 'Another set'} variant="ghost" disabled={!actionsReady} onPress={() => act(onAnother)} testID="another-set" style={{ flex: 1, paddingHorizontal: 12, borderRadius: 24, backgroundColor: C.paper }} /><Button title="Done" variant="ghost" disabled={!actionsReady} onPress={() => act(onDone)} testID="done-set" style={{ flex: 1, borderWidth: 0 }} /></View>
      </View>
    </View>
  </ScrollView></View>;
}
function Stat({ label, value, previous, improved }: { label: string; value: string; previous: string | null; improved: boolean }) {
  return <View style={s.stat}><T weight="bold" style={{ fontSize: 10, color: C.muted, letterSpacing: 1 }}>{label}</T><T testID={`stat-${label.toLowerCase().replace(' ', '-')}`} weight="display" style={{ fontSize: 24 }}>{value}</T><T style={{ fontSize: 11, color: improved ? C.green : C.muted }}>{previous === null ? '—' : `was ${previous}`}</T></View>;
}
const s = StyleSheet.create({
  countdown: { flex: 1, alignItems: 'center', justifyContent: 'center' }, ringBox: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center' }, breathingRing: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: C.mint }, innerRing: { position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line },
  gameScroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, width: '100%', maxWidth: 510, alignSelf: 'center', flexGrow: 1 }, gameTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }, circleButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line },
  sectionLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, track: { height: 5, backgroundColor: C.line, borderRadius: 8, overflow: 'hidden' }, trackFill: { height: 5, backgroundColor: C.green, borderRadius: 8 },
  flashCard: { borderRadius: 24, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, gap: 8 }, feedbackMark: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }, equation: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 21 }, operand: { fontSize: 51, letterSpacing: -2 }, answerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9, paddingBottom: 2 }, answerSlot: { width: 56, height: 58, borderWidth: 1.5, borderRadius: 13, borderColor: C.line, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  numberPad: { gap: 11 }, key: { flex: 1, borderRadius: 17, backgroundColor: C.paper, borderColor: C.line, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: '#173C3777', alignItems: 'center', justifyContent: 'center', padding: 24 }, modalCard: { padding: 26, borderRadius: 24, backgroundColor: C.bg, width: '100%', maxWidth: 410, gap: 20 },
  resultScroll: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32, alignItems: 'center' }, result: { width: '100%', maxWidth: 510, flexGrow: 1, gap: 16 }, stats: { flexDirection: 'row', gap: 8 }, stat: { flex: 1, minWidth: 0, backgroundColor: C.paper, borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingVertical: 12, paddingHorizontal: 10, gap: 4 }, resultCard: { backgroundColor: C.paper, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 16, gap: 12 }, factChip: { backgroundColor: C.green, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 }, reviewFact: { gap: 5, paddingTop: 12 },
});
