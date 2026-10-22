import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Trophy } from 'lucide-react-native';
import { makeFact, NumberRange, Operation, RANGES, SYMBOLS } from './game';
import { FactStat, RecallData, RecallState, rangeEarned, stateOf } from './recall';
import { C, T } from './ui';
import { factLabel } from './coaching';

export const STATE_LABELS: Record<RecallState, string> = { 'not-yet': 'Not yet', learning: 'Learning', almost: 'Almost', 'by-heart': 'By heart' };
export const STATE_COLORS: Record<RecallState, string> = { 'not-yet': '#FFFFFF', learning: '#DDEFCB', almost: '#8FC49C', 'by-heart': '#37734E' };
export function GridLegend() {
  return <View style={s.legend}>{(Object.keys(STATE_LABELS) as RecallState[]).map(state => <View key={state} style={s.legendItem}><View style={[s.swatch, { backgroundColor: STATE_COLORS[state], borderWidth: state === 'not-yet' ? 1 : 0 }]} /><T style={{ fontSize: 11, color: C.muted }}>{STATE_LABELS[state]}</T></View>)}</View>;
}
export function RangePill({ range, earned }: { range: NumberRange; earned: boolean }) {
  return <View accessibilityLabel={`Numbers 1 to ${range}, trophy ${earned ? 'earned' : 'not yet earned'}`} style={[s.rangePill, { backgroundColor: earned ? C.yellow : C.pale }]}>{earned && <Trophy size={10} color={C.ink} />}<T weight="bold" style={{ fontSize: 10, color: earned ? C.ink : C.muted }}>1–{range}</T></View>;
}
export function RangePills({ data, operation }: { data: Pick<RecallData, 'earnedTrophies'>; operation: Operation }) {
  return <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>{RANGES.map(range => <RangePill key={range} range={range} earned={rangeEarned(data, [operation], range)} />)}</View>;
}
export function FactGrid({ operation, facts, mini = false }: { operation: Operation; facts: Record<string, FactStat>; mini?: boolean }) {
  return <View testID={`${mini ? 'mini' : 'full'}-grid-${operation}`} style={[s.grid, { gap: mini ? 1 : 2 }, !mini && { maxWidth: 540 }]}>
    {!mini && <View style={s.row}><T style={s.axis}>{SYMBOLS[operation]}</T>{Array.from({ length: 12 }, (_, col) => <View key={col} style={[s.axisCell, (col === 4 || col === 9) && s.colGap]}><T weight="bold" style={s.axisText}>{col + 1}</T></View>)}</View>}
    {Array.from({ length: 12 }, (_, row) => <View key={row} style={[s.row, { gap: mini ? 1 : 2 }, !mini && (row === 4 || row === 9) && { marginBottom: 4 }]}>
      {!mini && <T weight="bold" style={s.axis}>{row + 1}</T>}
      {Array.from({ length: 12 }, (_, col) => {
        const fact = makeFact(operation, row + 1, col + 1); const state = stateOf(facts[fact.factKey]);
        return <View key={col} accessible={!mini} accessibilityLabel={mini ? undefined : `${factLabel(fact)} = ${fact.answer}, ${STATE_LABELS[state]}`} testID={mini ? undefined : `grid-cell-${operation}-${row + 1}-${col + 1}`} style={[s.cell, { borderRadius: mini ? 2 : 4, backgroundColor: STATE_COLORS[state], borderWidth: state === 'not-yet' ? 1 : 0 }, !mini && (col === 4 || col === 9) && s.colGap]} />;
      })}
    </View>)}
  </View>;
}
const s = StyleSheet.create({
  grid: { width: '100%', gap: 2 }, row: { flexDirection: 'row', gap: 2, alignItems: 'center' }, cell: { flex: 1, aspectRatio: 1, borderColor: '#C9D1C2' },
  axis: { width: 17, textAlign: 'center', fontSize: 10, color: C.muted }, axisCell: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 20 }, axisText: { fontSize: 10, color: C.muted }, colGap: { marginRight: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 }, swatch: { width: 12, height: 12, borderRadius: 3, borderColor: '#C9D1C2' },
  rangePill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 4, borderRadius: 10 },
});
