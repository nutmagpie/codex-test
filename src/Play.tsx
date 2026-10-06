import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight, Check, Clock3, Delete, Heart, Home, RotateCcw, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { C, Button, Label, Pill, T } from './ui';
import { createSession, expectedDigits, Level, Mode, MODES, Session, submitAnswer, tickSession, WORLDS } from './game';
import { TrophyArt } from './art';

export function GameScreen({ level, mode, playerName, haptics, onFinish, onQuit }: { level: Level; mode: Mode; playerName: string; haptics: boolean; onFinish: (s: Session) => void; onQuit: () => void }) {
  const [ready, setReady] = useState(mode === 'learn');
  const [countdown, setCountdown] = useState(3);
  const [session, setSession] = useState(() => createSession(level, mode));
  const sessionRef = useRef(session);
  const [input, setInput] = useState('');
  const inputRef = useRef('');
  const [feedback, setFeedback] = useState<Session['lastAnswer']>(null);
  const busy = useRef(false);
  const startAt = useRef(Date.now());
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completed = useRef(false);
  const [quit, setQuit] = useState(false);
  const world = WORLDS.find(w => w.id === level.worldId)!;
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const usableHeight = height - insets.top - insets.bottom;
  const compact = usableHeight < 760;
  const short = usableHeight < 650;
  const keyHeight = short ? 48 : compact ? usableHeight < 690 ? 52 : 56 : 62;
  const seconds = MODES[mode].seconds;
  const remaining = seconds === null ? null : Math.max(0, seconds - session.elapsedMs / 1000);
  // Timed successes are a message only; the next card is ready immediately.
  const heldFeedback = feedback && (mode === 'learn' || !feedback.correct) ? feedback : null;
  const visibleQuestion = heldFeedback?.question || session.questions[Math.min(session.index, session.questions.length - 1)];

  useEffect(() => {
    if (ready) return;
    const id = setTimeout(() => {
      if (countdown <= 1) { startAt.current = Date.now(); setReady(true); }
      else setCountdown(n => n - 1);
    }, 800);
    return () => clearTimeout(id);
  }, [countdown, ready]);
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      const next = tickSession(sessionRef.current, Date.now() - startAt.current);
      sessionRef.current = next;
      setSession(next);
    }, 80);
    return () => clearInterval(id);
  }, [ready]);
  useEffect(() => {
    if (session.status !== 'playing' && !completed.current && !(feedback && !feedback.correct)) { completed.current = true; onFinish(session); }
  }, [session, feedback, onFinish]);
  useEffect(() => () => { if (timeout.current) clearTimeout(timeout.current); }, []);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setQuit(true); return true; });
    return () => subscription.remove();
  }, []);

  const pressDigit = useCallback((digit: string) => {
    if (!ready || busy.current || quit || completed.current || sessionRef.current.status !== 'playing') return;
    const current = tickSession(sessionRef.current, Date.now() - startAt.current);
    sessionRef.current = current;
    if (current.status !== 'playing') { setSession(current); return; }
    const q = current.questions[current.index];
    const value = inputRef.current + digit;
    inputRef.current = value;
    setInput(value);
    if (value.length < expectedDigits(q)) return;
    busy.current = true;
    const next = submitAnswer(current, Number(value));
    if (timeout.current) { clearTimeout(timeout.current); timeout.current = null; }
    sessionRef.current = next;
    setSession(next);
    setFeedback(next.lastAnswer);
    if (haptics && Platform.OS !== 'web') Haptics.notificationAsync(next.lastAnswer?.correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
    if (next.status !== 'playing' && next.lastAnswer?.correct) return;
    const holdCard = mode === 'learn' || !next.lastAnswer?.correct;
    if (!holdCard) {
      inputRef.current = ''; setInput(''); busy.current = false;
    }
    const feedbackMs = holdCard ? next.lastAnswer?.correct ? 100 : mode === 'learn' ? 1250 : 350 : 450;
    timeout.current = setTimeout(() => {
      // A success message must never erase digits entered on the next card.
      if (holdCard) { inputRef.current = ''; setInput(''); busy.current = false; }
      setFeedback(null); timeout.current = null;
    }, feedbackMs);
  }, [ready, quit, haptics, mode]);
  const erase = useCallback(() => {
    if (busy.current || !ready || quit) return;
    inputRef.current = inputRef.current.slice(0, -1); setInput(inputRef.current);
  }, [ready, quit]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (/^[0-9]$/.test(event.key)) { event.preventDefault(); pressDigit(event.key); }
      else if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); erase(); }
      else if (event.key === 'Escape') setQuit(true);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [pressDigit, erase]);

  return <View testID="game-screen" style={s.gameShell}>
    <ScrollView contentContainerStyle={[s.gameScroll, { gap: short ? 10 : compact ? 12 : 18, paddingHorizontal: width < 360 ? 16 : 20 }]} showsVerticalScrollIndicator={false}>
      <View style={s.gameTop}><Pressable accessibilityRole="button" accessibilityLabel="Leave session" onPress={() => setQuit(true)} style={s.circleButton}><ArrowLeft size={20} color={C.ink} /></Pressable><View style={{ alignItems: 'center', gap: 4 }}><Label>{MODES[mode].name.toUpperCase()}</Label><T weight="bold" style={{ fontSize: 12 }}>{world.name} · 1–{level.range}</T></View><Pill color={C.mint}>{playerName}</Pill></View>
      {!ready ? <View style={s.countdown}><Label>FIND YOUR RHYTHM</Label><T weight="display" style={{ fontSize: 106, lineHeight: 120 }}>{countdown}</T><T style={{ fontSize: 17 }}>Take a breath. You've got this.</T><T style={{ color: C.muted, fontSize: 13 }}>{MODES[mode].cards} cards · {seconds} seconds · 3 hearts</T></View> : <>
        <View style={s.gameStatus}><View style={{ gap: 6 }}><Label>YOUR HEARTS</Label><View style={{ flexDirection: 'row', gap: 6 }} testID="hearts">{[0, 1, 2].map(i => <Heart key={i} size={24} fill={i < session.hearts ? C.coral : 'transparent'} color={i < session.hearts ? C.coral : '#D9DFD5'} strokeWidth={1.5} />)}</View></View><View style={{ alignItems: 'flex-end', gap: 4 }}><Label>{seconds ? 'SECONDS LEFT' : 'TAKE YOUR TIME'}</Label><View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Clock3 size={16} color={remaining !== null && remaining < 10 ? C.coral : C.green} /><T weight="display" testID="timer" style={{ fontSize: 27, color: remaining !== null && remaining < 10 ? C.coral : C.ink }}>{remaining === null ? '∞' : Math.ceil(remaining).toString().padStart(2, '0')}</T></View></View></View>
        <View style={{ gap: 8 }}><View style={s.sectionLine}><T style={{ fontSize: 11, color: C.muted }}>One card at a time.</T><T weight="bold" style={{ fontSize: 11 }} testID="card-count">{session.answered} / {MODES[mode].cards}</T></View><View style={s.track}><View style={[s.trackFill, { width: `${session.answered / MODES[mode].cards * 100}%` }]} /></View></View>
        <View testID="flash-card" style={[s.flashCard, { minHeight: short ? 170 : compact ? 190 : 216, padding: short ? 14 : compact ? 16 : 21 }, heldFeedback && { borderColor: heldFeedback.correct ? C.green : C.coral, backgroundColor: heldFeedback.correct ? '#F0F7E9' : '#FFF2ED' }]}>
          <View style={s.sectionLine}><Label>CARD {String(Math.min(session.answered + (heldFeedback ? 0 : 1), MODES[mode].cards)).padStart(2, '0')}</Label><View style={s.feedbackMark} accessibilityLabel={feedback ? feedback.correct ? 'Correct answer' : 'Incorrect answer' : undefined}>{feedback ? feedback.correct ? <Check testID="answer-feedback" size={22} color={C.green} strokeWidth={3} /> : <X testID="mistake-indicator" size={28} color="#AD5139" strokeWidth={3} /> : null}</View></View>
          <View accessibilityLabel={`${visibleQuestion.left} ${visibleQuestion.symbol} ${visibleQuestion.right}`} testID="question" style={[s.equation, { minHeight: short ? 58 : compact ? 64 : 86 }]}><T weight="display" style={[s.operand, compact && { fontSize: 44 }]}>{visibleQuestion.left}</T><T weight="display" style={[s.operand, compact && { fontSize: 44 }, { color: C.coral }]}>{visibleQuestion.symbol}</T><T weight="display" style={[s.operand, compact && { fontSize: 44 }]}>{visibleQuestion.right}</T></View>
          <View testID="answer-slots" style={s.answerRow}>{Array.from({ length: expectedDigits(visibleQuestion) }, (_, i) => <View testID={`answer-slot-${i}`} key={i} style={[s.answerSlot, short && { height: 52, width: 52 }, input[i] !== undefined && { borderColor: C.ink, backgroundColor: C.mint }]}><T weight="display" testID={`answer-digit-${i}`} style={{ fontSize: 30 }}>{input[i] ?? ''}</T></View>)}</View>
          {mode === 'learn' && feedback && !feedback.correct && <T testID="learn-correction" weight="bold" style={{ textAlign: 'center', fontSize: 13, color: '#AD5139' }}>{feedback.question.left} {feedback.question.symbol} {feedback.question.right} = {feedback.question.answer}</T>}
        </View>
        <View testID="keypad" style={[s.numberPad, { marginTop: 'auto' }]}>{[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'delete']].map((row, i) => <View key={i} style={{ flexDirection: 'row', gap: 12 }}>{row.map(key => key === '' ? <View key="empty" style={{ flex: 1, height: keyHeight }} /> : <Pressable key={key} testID={`key-${key}`} accessibilityRole="button" accessibilityLabel={key === 'delete' ? 'Delete last digit' : key} onPress={() => key === 'delete' ? erase() : pressDigit(key)} style={({ pressed }) => [s.key, { height: keyHeight }, key === 'delete' && { backgroundColor: C.pale }, { opacity: pressed ? .6 : 1, transform: [{ scale: pressed ? .96 : 1 }] }]}>{key === 'delete' ? <Delete size={25} color={C.ink} /> : <T weight="display" style={{ fontSize: 29 }}>{key}</T>}</Pressable>)}</View>)}</View>
      </>}
    </ScrollView>
    <Modal visible={quit} transparent animationType="fade" onRequestClose={() => setQuit(false)}><View style={s.modalBackdrop}><View style={s.modalCard}><Label>A LITTLE PAUSE</Label><T weight="display" style={{ fontSize: 25 }}>Leave this session?</T><T style={{ color: C.muted, lineHeight: 23 }}>This run won't be saved. Your completed sessions and progress are safe.{seconds ? ' The clock keeps running while you decide.' : ''}</T><Button title="Keep going" onPress={() => setQuit(false)} /><Button title="Leave session" variant="ghost" onPress={onQuit} /></View></View></Modal>
  </View>;
}

export function ResultScreen({ session, playerName, onReplay, onLevels, onHome }: { session: Session; playerName: string; onReplay: () => void; onLevels: () => void; onHome: () => void }) {
  const [actionsReady, setActionsReady] = useState(false);
  const unlockAt = useRef(Date.now() + 900);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigated = useRef(false);
  const blockedGesture = useRef(false);
  const armActions = useCallback(() => {
    if (unlockTimer.current) clearTimeout(unlockTimer.current);
    unlockTimer.current = setTimeout(() => {
      unlockTimer.current = null; setActionsReady(true);
    }, Math.max(0, unlockAt.current - Date.now()));
  }, []);
  useEffect(() => {
    armActions();
    return () => { if (unlockTimer.current) clearTimeout(unlockTimer.current); };
  }, [armActions]);
  // Catch touches even on disabled buttons. Rapid keypad taps must settle before
  // the results screen can interpret a fresh tap as a navigation decision.
  const noteTouch = useCallback(() => {
    if (Date.now() < unlockAt.current) {
      blockedGesture.current = true;
      unlockAt.current = Math.max(unlockAt.current, Date.now() + 450);
      setActionsReady(false); armActions();
    } else blockedGesture.current = false;
    return false;
  }, [armActions]);
  const finishTouch = useCallback(() => {
    if (!blockedGesture.current) return;
    blockedGesture.current = false;
    unlockAt.current = Math.max(unlockAt.current, Date.now() + 450);
    setActionsReady(false); armActions();
  }, [armActions]);
  const takeAction = (action: () => void) => {
    if (!actionsReady || blockedGesture.current || Date.now() < unlockAt.current || navigated.current) return;
    navigated.current = true; action();
  };
  const passed = session.status === 'passed';
  const accuracy = session.answered ? Math.round(session.correct / session.answered * 100) : 0;
  const world = WORLDS.find(w => w.id === session.level.worldId)!;
  return <View testID="results-screen" style={{ flex: 1 }} onStartShouldSetResponderCapture={noteTouch} onPointerDownCapture={noteTouch} onPointerDown={noteTouch} onTouchStart={noteTouch} onTouchEnd={finishTouch} onPointerUp={finishTouch}><ScrollView contentContainerStyle={s.resultScroll}><View style={s.result}>
    <Pill color={passed ? C.mint : '#F8E9B5'}>{passed ? session.mode === 'mastery' ? 'MASTERY UNLOCKED' : 'A LITTLE WIN, WELL EARNED' : 'PRACTICE MAKES POSSIBILITY'}</Pill>
    <TrophyArt size={155} />
    <T weight="display" style={{ fontSize: 34, textAlign: 'center', letterSpacing: -1 }}>{passed ? session.mode === 'mastery' ? 'A minute. A milestone.' : 'Look at you grow.' : 'Keep your chin up.'}</T>
    <T style={{ textAlign: 'center', color: C.muted, fontSize: 14, lineHeight: 23 }}>{passed ? `Nice work, ${playerName}. ${session.mode === 'mastery' ? 'You’ve made these facts your own.' : 'Every session is a step toward confidence.'}` : session.failureReason === 'time' ? `Time's up, ${playerName}. Your rhythm is getting stronger. Give it another go.` : `Three little slips. A whole lot of learning. Take a breath, ${playerName}, and try again.`}</T>
    <T weight="bold" style={{ fontSize: 12, color: C.green }}>{world.name} · 1–{session.level.range} · {MODES[session.mode].name}</T>
    <View style={s.resultStats}><ResultStat label="CORRECT" value={`${session.correct}/${MODES[session.mode].cards}`} /><ResultStat label="ACCURACY" value={`${accuracy}%`} /><ResultStat label="TIME" value={`${(session.elapsedMs / 1000).toFixed(1)}s`} /></View>
    {session.missedAnswers.length > 0 && <View testID="missed-facts-review" style={s.correction}><T weight="bold" style={{ fontSize: 14 }}>Missed facts to review</T>{session.missedAnswers.map((answer, index) => <View key={answer.question.id} testID={`missed-fact-${index}`} style={s.reviewFact}><T weight="display" style={{ fontSize: 23, textAlign: 'center' }}>{answer.question.left} {answer.question.symbol} {answer.question.right} = {answer.question.answer}</T><T style={{ color: C.muted, fontSize: 12 }}>You answered {answer.value}</T></View>)}</View>}
    <View testID="result-actions" accessibilityState={{ disabled: !actionsReady }} style={{ width: '100%', gap: 10 }}><Button title={passed ? 'Another little win?' : 'Try again'} icon={RotateCcw} disabled={!actionsReady} onPress={() => takeAction(onReplay)} /><Button title="Choose a mode" variant="secondary" icon={ArrowRight} disabled={!actionsReady} onPress={() => takeAction(onLevels)} /><Button title="Back to worlds" variant="ghost" icon={Home} disabled={!actionsReady} onPress={() => takeAction(onHome)} /></View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Check size={13} color={C.green} /><T style={{ fontSize: 11, color: C.green }}>Your effort has been added to your progress.</T></View>
  </View></ScrollView></View>;
}
function ResultStat({ label, value }: { label: string; value: string }) { return <View style={{ alignItems: 'center', gap: 8, flex: 1 }}><Label>{label}</Label><T weight="display" style={{ fontSize: 25 }}>{value}</T></View>; }

const s = StyleSheet.create({
  gameShell: { flex: 1, backgroundColor: C.bg }, gameScroll: { padding: 20, paddingTop: 12, width: '100%', maxWidth: 510, alignSelf: 'center', flexGrow: 1, gap: 18, paddingBottom: 32 }, gameTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 2 }, circleButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper, borderRadius: 14, borderWidth: 1, borderColor: C.line },
  countdown: { minHeight: 560, alignItems: 'center', justifyContent: 'center', gap: 20 }, gameStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, track: { height: 5, borderRadius: 10, backgroundColor: C.line, overflow: 'hidden' }, trackFill: { height: 5, backgroundColor: C.green, borderRadius: 10 },
  flashCard: { borderRadius: 24, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, padding: 21, minHeight: 240, gap: 8 }, equation: { flexDirection: 'row', gap: 21, alignItems: 'center', justifyContent: 'center', minHeight: 86 }, operand: { fontSize: 51, letterSpacing: -2 }, answerSlot: { width: 56, height: 58, borderWidth: 1.5, borderColor: C.line, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  answerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, feedbackMark: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  numberPad: { gap: 11 }, key: { flex: 1, height: 62, borderRadius: 17, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' }, modalBackdrop: { flex: 1, backgroundColor: '#173C3777', alignItems: 'center', justifyContent: 'center', padding: 24 }, modalCard: { backgroundColor: C.bg, borderRadius: 24, padding: 28, gap: 20, width: '100%', maxWidth: 410 },
  resultScroll: { padding: 25, alignItems: 'center', flexGrow: 1, justifyContent: 'center' }, result: { width: '100%', maxWidth: 440, gap: 22, alignItems: 'center', paddingVertical: 25 }, resultStats: { width: '100%', paddingVertical: 25, borderRadius: 20, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, flexDirection: 'row' }, correction: { backgroundColor: '#F8E9B5', borderRadius: 17, width: '100%', alignItems: 'center', padding: 18, gap: 7 },
  reviewFact: { alignItems: 'center', gap: 5, paddingVertical: 9, width: '100%' },
});
