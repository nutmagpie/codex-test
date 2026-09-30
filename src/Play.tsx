import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ArrowLeft, ArrowRight, Check, Clock3, Delete, Heart, Home, RotateCcw, Sparkles, Trophy } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { C, Button, Label, Pill, T } from './ui';
import { createSession, expectedDigits, Level, Mode, MODES, Question, Session, submitAnswer, tickSession, WORLDS } from './game';
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
  const seconds = MODES[mode].seconds;
  const remaining = seconds === null ? null : Math.max(0, seconds - session.elapsedMs / 1000);
  const visibleQuestion = feedback?.question || session.questions[Math.min(session.index, session.questions.length - 1)];

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
    if (session.status !== 'playing' && !completed.current) { completed.current = true; onFinish(session); }
  }, [session, onFinish]);
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
    sessionRef.current = next;
    setSession(next);
    setFeedback(next.lastAnswer);
    if (haptics && Platform.OS !== 'web') Haptics.notificationAsync(next.lastAnswer?.correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
    timeout.current = setTimeout(() => {
      busy.current = false; inputRef.current = ''; setInput(''); setFeedback(null);
    }, next.lastAnswer?.correct ? 100 : mode === 'learn' ? 1250 : 350);
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

  return <View style={s.gameShell}>
    <ScrollView contentContainerStyle={s.gameScroll} showsVerticalScrollIndicator={false}>
      <View style={s.gameTop}><Pressable accessibilityRole="button" accessibilityLabel="Leave session" onPress={() => setQuit(true)} style={s.circleButton}><ArrowLeft size={20} color={C.ink} /></Pressable><View style={{ alignItems: 'center', gap: 4 }}><Label>{MODES[mode].name.toUpperCase()}</Label><T weight="bold" style={{ fontSize: 12 }}>{world.name} · 1–{level.range}</T></View><Pill color={C.mint}>{playerName}</Pill></View>
      {!ready ? <View style={s.countdown}><Label>FIND YOUR RHYTHM</Label><T weight="display" style={{ fontSize: 106, lineHeight: 120 }}>{countdown}</T><T style={{ fontSize: 17 }}>Take a breath. You've got this.</T><T style={{ color: C.muted, fontSize: 13 }}>{MODES[mode].cards} cards · {seconds} seconds · 3 hearts</T></View> : <>
        <View style={s.gameStatus}><View style={{ gap: 6 }}><Label>YOUR HEARTS</Label><View style={{ flexDirection: 'row', gap: 6 }} testID="hearts">{[0, 1, 2].map(i => <Heart key={i} size={24} fill={i < session.hearts ? C.coral : 'transparent'} color={i < session.hearts ? C.coral : '#D9DFD5'} strokeWidth={1.5} />)}</View></View><View style={{ alignItems: 'flex-end', gap: 4 }}><Label>{seconds ? 'SECONDS LEFT' : 'TAKE YOUR TIME'}</Label><View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Clock3 size={16} color={remaining !== null && remaining < 10 ? C.coral : C.green} /><T weight="display" testID="timer" style={{ fontSize: 27, color: remaining !== null && remaining < 10 ? C.coral : C.ink }}>{remaining === null ? '∞' : Math.ceil(remaining).toString().padStart(2, '0')}</T></View></View></View>
        <View style={{ gap: 8 }}><View style={s.sectionLine}><T style={{ fontSize: 11, color: C.muted }}>One card at a time.</T><T weight="bold" style={{ fontSize: 11 }} testID="card-count">{session.answered} / {MODES[mode].cards}</T></View><View style={s.track}><View style={[s.trackFill, { width: `${session.answered / MODES[mode].cards * 100}%` }]} /></View></View>
        <View style={[s.flashCard, feedback && { borderColor: feedback.correct ? C.green : C.coral, backgroundColor: feedback.correct ? '#F0F7E9' : '#FFF2ED' }]}>
          <View style={s.sectionLine}><Label>CARD {String(Math.min(session.answered + (feedback ? 0 : 1), MODES[mode].cards)).padStart(2, '0')}</Label><Sparkles size={15} color={C.green} /></View>
          <View accessibilityLabel={`${visibleQuestion.left} ${visibleQuestion.symbol} ${visibleQuestion.right}`} testID="question" style={s.equation}><T weight="display" style={s.operand}>{visibleQuestion.left}</T><T weight="display" style={[s.operand, { color: C.coral }]}>{visibleQuestion.symbol}</T><T weight="display" style={s.operand}>{visibleQuestion.right}</T></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }}><T style={{ fontSize: 24, color: C.muted, marginRight: 7 }}>=</T>{Array.from({ length: expectedDigits(visibleQuestion) }, (_, i) => <View key={i} style={[s.answerSlot, input[i] !== undefined && { borderColor: C.ink, backgroundColor: C.mint }]}><T weight="display" testID={`answer-digit-${i}`} style={{ fontSize: 30 }}>{input[i] ?? ''}</T>{input[i] === undefined && <View style={{ width: 10, height: 2, backgroundColor: '#C4CEC0', position: 'absolute', bottom: 19 }} />}</View>)}</View>
          <View style={{ height: 24, justifyContent: 'center', marginTop: 8 }}>{feedback ? <T weight="bold" style={{ textAlign: 'center', fontSize: 12, color: feedback.correct ? C.green : '#AD5139' }}>{feedback.correct ? 'Nice one. Keep your flow.' : `${feedback.question.left} ${feedback.question.symbol} ${feedback.question.right} = ${feedback.question.answer}. You've got the next one.`}</T> : <T style={{ color: C.muted, fontSize: 10, textAlign: 'center' }}>{expectedDigits(visibleQuestion)} {expectedDigits(visibleQuestion) === 1 ? 'digit' : 'digits'} · answer submits automatically</T>}</View>
        </View>
        <View style={s.numberPad}>{[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'delete']].map((row, i) => <View key={i} style={{ flexDirection: 'row', gap: 12 }}>{row.map(key => key === '' ? <View key="empty" style={[s.key, { backgroundColor: 'transparent', borderWidth: 0, justifyContent: 'center' }]}><T style={{ color: C.muted, fontSize: 8, letterSpacing: 1, textAlign: 'center', lineHeight: 15 }}>JUST TAP.{"\n"}NO ENTER.</T></View> : <Pressable key={key} testID={`key-${key}`} accessibilityRole="button" accessibilityLabel={key === 'delete' ? 'Delete last digit' : key} onPress={() => key === 'delete' ? erase() : pressDigit(key)} style={({ pressed }) => [s.key, key === 'delete' && { backgroundColor: C.pale }, { opacity: pressed ? .6 : 1, transform: [{ scale: pressed ? .96 : 1 }] }]}>{key === 'delete' ? <Delete size={25} color={C.ink} /> : <T weight="display" style={{ fontSize: 29 }}>{key}</T>}</Pressable>)}</View>)}</View>
        <T style={{ fontSize: 10, color: C.muted, textAlign: 'center', marginTop: 2 }}>{mode === 'learn' ? 'No rush. You’re building something good.' : 'Breathe. Focus. One little win at a time.'}</T>
      </>}
    </ScrollView>
    <Modal visible={quit} transparent animationType="fade" onRequestClose={() => setQuit(false)}><View style={s.modalBackdrop}><View style={s.modalCard}><Label>A LITTLE PAUSE</Label><T weight="display" style={{ fontSize: 25 }}>Leave this session?</T><T style={{ color: C.muted, lineHeight: 23 }}>This run won't be saved. Your completed sessions and progress are safe.{seconds ? ' The clock keeps running while you decide.' : ''}</T><Button title="Keep going" onPress={() => setQuit(false)} /><Button title="Leave session" variant="ghost" onPress={onQuit} /></View></View></Modal>
  </View>;
}

export function ResultScreen({ session, playerName, onReplay, onLevels, onHome }: { session: Session; playerName: string; onReplay: () => void; onLevels: () => void; onHome: () => void }) {
  const passed = session.status === 'passed';
  const accuracy = session.answered ? Math.round(session.correct / session.answered * 100) : 0;
  const world = WORLDS.find(w => w.id === session.level.worldId)!;
  return <ScrollView contentContainerStyle={s.resultScroll}><View style={s.result}>
    <Pill color={passed ? C.mint : '#F8E9B5'}>{passed ? session.mode === 'mastery' ? 'MASTERY UNLOCKED' : 'A LITTLE WIN, WELL EARNED' : 'PRACTICE MAKES POSSIBILITY'}</Pill>
    <TrophyArt size={155} />
    <T weight="display" style={{ fontSize: 34, textAlign: 'center', letterSpacing: -1 }}>{passed ? session.mode === 'mastery' ? 'A minute. A milestone.' : 'Look at you grow.' : 'Keep your chin up.'}</T>
    <T style={{ textAlign: 'center', color: C.muted, fontSize: 14, lineHeight: 23 }}>{passed ? `Nice work, ${playerName}. ${session.mode === 'mastery' ? 'You’ve made these facts your own.' : 'Every session is a step toward confidence.'}` : session.failureReason === 'time' ? `Time's up, ${playerName}. Your rhythm is getting stronger. Give it another go.` : `Three little slips. A whole lot of learning. Take a breath, ${playerName}, and try again.`}</T>
    <T weight="bold" style={{ fontSize: 12, color: C.green }}>{world.name} · 1–{session.level.range} · {MODES[session.mode].name}</T>
    <View style={s.resultStats}><ResultStat label="CORRECT" value={`${session.correct}/${MODES[session.mode].cards}`} /><ResultStat label="ACCURACY" value={`${accuracy}%`} /><ResultStat label="TIME" value={`${(session.elapsedMs / 1000).toFixed(1)}s`} /></View>
    {!passed && session.lastAnswer && !session.lastAnswer.correct && <View style={s.correction}><T style={{ color: C.muted, fontSize: 12 }}>A fact to take with you</T><T weight="display" style={{ fontSize: 24 }}>{session.lastAnswer.question.left} {session.lastAnswer.question.symbol} {session.lastAnswer.question.right} = {session.lastAnswer.question.answer}</T></View>}
    <View style={{ width: '100%', gap: 10 }}><Button title={passed ? 'Another little win?' : 'Try again'} icon={RotateCcw} onPress={onReplay} /><Button title="Choose a mode" variant="secondary" icon={ArrowRight} onPress={onLevels} /><Button title="Back to worlds" variant="ghost" icon={Home} onPress={onHome} /></View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Check size={13} color={C.green} /><T style={{ fontSize: 11, color: C.green }}>Your effort has been added to your progress.</T></View>
  </View></ScrollView>;
}
function ResultStat({ label, value }: { label: string; value: string }) { return <View style={{ alignItems: 'center', gap: 8, flex: 1 }}><Label>{label}</Label><T weight="display" style={{ fontSize: 25 }}>{value}</T></View>; }

const s = StyleSheet.create({
  gameShell: { flex: 1, backgroundColor: C.bg }, gameScroll: { padding: 20, width: '100%', maxWidth: 510, alignSelf: 'center', gap: 18, paddingBottom: 30 }, gameTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 2 }, circleButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper, borderRadius: 14, borderWidth: 1, borderColor: C.line },
  countdown: { minHeight: 560, alignItems: 'center', justifyContent: 'center', gap: 20 }, gameStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, track: { height: 5, borderRadius: 10, backgroundColor: C.line, overflow: 'hidden' }, trackFill: { height: 5, backgroundColor: C.green, borderRadius: 10 },
  flashCard: { borderRadius: 24, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, padding: 21, minHeight: 240, gap: 8 }, equation: { flexDirection: 'row', gap: 21, alignItems: 'center', justifyContent: 'center', minHeight: 86 }, operand: { fontSize: 51, letterSpacing: -2 }, answerSlot: { width: 56, height: 58, borderWidth: 1.5, borderColor: C.line, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  numberPad: { gap: 11 }, key: { flex: 1, height: 62, borderRadius: 17, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' }, modalBackdrop: { flex: 1, backgroundColor: '#173C3777', alignItems: 'center', justifyContent: 'center', padding: 24 }, modalCard: { backgroundColor: C.bg, borderRadius: 24, padding: 28, gap: 20, width: '100%', maxWidth: 410 },
  resultScroll: { padding: 25, alignItems: 'center', flexGrow: 1, justifyContent: 'center' }, result: { width: '100%', maxWidth: 440, gap: 22, alignItems: 'center', paddingVertical: 25 }, resultStats: { width: '100%', paddingVertical: 25, borderRadius: 20, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, flexDirection: 'row' }, correction: { backgroundColor: '#F8E9B5', borderRadius: 17, width: '100%', alignItems: 'center', padding: 18, gap: 7 },
});
