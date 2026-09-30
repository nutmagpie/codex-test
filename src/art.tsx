import React from 'react';
import Svg, {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

const INK = '#203D40';
const CREAM = '#FFFDF5';
const MINT = '#BDE5CB';
const CORAL = '#F47A60';
const GOLD = '#F5CD64';

/** A tiny four-point arcade sparkle. */
function Spark({ x, y, size = 12, fill = INK }: {
  x: number;
  y: number;
  size?: number;
  fill?: string;
}) {
  return (
    <Path
      d={`M ${x} ${y - size} Q ${x + size * 0.2} ${y - size * 0.2} ${x + size} ${y} Q ${x + size * 0.2} ${y + size * 0.2} ${x} ${y + size} Q ${x - size * 0.2} ${y + size * 0.2} ${x - size} ${y} Q ${x - size * 0.2} ${y - size * 0.2} ${x} ${y - size} Z`}
      fill={fill}
    />
  );
}

/** Original, resolution-independent artwork shared by all three platforms. */
export function HeroArt({ size = 360 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={(size * 350) / 420}
      viewBox="0 0 420 350"
      accessibilityLabel="Math flashcards, a correct answer of twelve, and a sixty-second clock"
      accessible={false}
    >
      {/* The orbit gives the static cards a little arcade momentum. */}
      <Path
        d="M 69 76 C 17 118 18 242 87 286 C 153 332 301 325 359 270"
        fill="none"
        stroke={INK}
        strokeWidth="1.8"
        strokeDasharray="2 7"
        strokeLinecap="round"
        opacity={0.4}
      />
      <Path
        d="M 301 31 C 339 30 369 49 382 77"
        fill="none"
        stroke={INK}
        strokeWidth="1.8"
        strokeDasharray="2 7"
        strokeLinecap="round"
        opacity={0.4}
      />

      <Spark x={42} y={180} size={12} />
      <Spark x={85} y={30} size={11} fill={CORAL} />
      <Spark x={373} y={238} size={15} />
      <Spark x={312} y={303} size={8} fill={CORAL} />
      <Circle cx="44" cy="238" r="4" fill={CORAL} />
      <Circle cx="350" cy="192" r="4" fill={GOLD} />
      <Circle cx="130" cy="307" r="3" fill={INK} />

      {/* Three tactile cards, each with a crisp offset print shadow. */}
      <G transform="rotate(-15 165 169)">
        <Rect x="65" y="60" width="209" height="220" rx="17" fill={INK} />
        <Rect x="61" y="54" width="209" height="220" rx="17" fill={GOLD} stroke={INK} strokeWidth="2.3" />
        <SvgText x="80" y="84" fill={INK} fontSize="11" fontWeight="800" fontFamily="sans-serif">LEVEL UP</SvgText>
        <Line x1="80" y1="96" x2="250" y2="96" stroke={INK} strokeWidth="1.3" opacity={0.4} />
        <SvgText x="87" y="232" fill={INK} fontSize="62" fontWeight="700" fontFamily="sans-serif">+</SvgText>
      </G>

      <G transform="rotate(12 242 165)">
        <Rect x="129" y="49" width="213" height="231" rx="17" fill={INK} />
        <Rect x="125" y="43" width="213" height="231" rx="17" fill={CORAL} stroke={INK} strokeWidth="2.3" />
        <Circle cx="307" cy="71" r="9" fill={CREAM} opacity={0.55} />
        <SvgText x="297" y="245" fill={INK} fontSize="32" fontWeight="600" fontFamily="sans-serif">×</SvgText>
      </G>

      <G transform="rotate(-5 200 170)">
        <Rect x="91" y="65" width="230" height="227" rx="16" fill={INK} />
        <Rect x="85" y="57" width="230" height="227" rx="16" fill={CREAM} stroke={INK} strokeWidth="2.5" />
        <Rect x="104" y="76" width="23" height="23" rx="6" fill={MINT} />
        <SvgText x="115.5" y="92" fill={INK} fontSize="14" fontWeight="700" fontFamily="sans-serif" textAnchor="middle">+</SvgText>
        <SvgText x="138" y="92" fill={INK} fontSize="10" fontWeight="700" letterSpacing="1.5" fontFamily="sans-serif">LITTLE WINS. BIG SKILLS.</SvgText>
        <SvgText x="200" y="160" fill={INK} fontSize="61" fontWeight="700" letterSpacing="-3" fontFamily="sans-serif" textAnchor="middle">8 + 4</SvgText>
        <Line x1="109" y1="179" x2="290" y2="179" stroke={INK} strokeWidth="1.2" strokeDasharray="3 5" opacity={0.3} />
        <SvgText x="156" y="241" fill={INK} fontSize="57" fontWeight="600" fontFamily="sans-serif" textAnchor="middle">?</SvgText>
        <Circle cx="110" cy="262" r="3" fill={CORAL} />
        <Circle cx="121" cy="262" r="3" fill={GOLD} />
        <Circle cx="132" cy="262" r="3" fill={MINT} />
      </G>

      {/* The answer is its own small reward token, not a floating UI button. */}
      <G transform="rotate(8 285 242)">
        <Rect x="234" y="203" width="107" height="88" rx="16" fill={INK} />
        <Rect x="230" y="197" width="107" height="88" rx="16" fill={MINT} stroke={INK} strokeWidth="2.5" />
        <SvgText x="283.5" y="219" fill={INK} fontSize="10" fontWeight="800" letterSpacing="2" fontFamily="sans-serif" textAnchor="middle">NAILED IT</SvgText>
        <SvgText x="283.5" y="266" fill={INK} fontSize="50" fontWeight="800" letterSpacing="-2" fontFamily="sans-serif" textAnchor="middle">12</SvgText>
      </G>

      {/* A small stopwatch, with a single warm accent instead of a gradient. */}
      <G transform="rotate(9 344 78)">
        <Rect x="336" y="28" width="17" height="11" rx="3" fill={INK} />
        <Line x1="369" y1="44" x2="376" y2="37" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        <Circle cx="345" cy="79" r="40" fill={INK} />
        <Circle cx="343" cy="75" r="38" fill={GOLD} stroke={INK} strokeWidth="2.5" />
        <Circle cx="343" cy="75" r="29" fill={CREAM} stroke={INK} strokeWidth="1.5" />
        <Path d="M 343 46 A 29 29 0 0 1 371 68" fill="none" stroke={CORAL} strokeWidth="5" strokeLinecap="round" />
        <Line x1="343" y1="48" x2="343" y2="52" stroke={INK} strokeWidth="1.5" />
        <Line x1="316" y1="75" x2="320" y2="75" stroke={INK} strokeWidth="1.5" />
        <Line x1="343" y1="98" x2="343" y2="102" stroke={INK} strokeWidth="1.5" />
        <SvgText x="343" y="84" fill={INK} fontSize="25" fontWeight="800" letterSpacing="-1" fontFamily="sans-serif" textAnchor="middle">60</SvgText>
      </G>
    </Svg>
  );
}

export function WorldArt({ symbol, color, size = 76 }: {
  symbol: string;
  color: string;
  size?: number;
}) {
  const mixed = symbol.length > 1;
  return (
    <Svg width={size} height={size} viewBox="0 0 88 88" accessible={false}>
      <G transform="rotate(-7 44 43)">
        <Rect x="16" y="15" width="60" height="60" rx="19" fill={INK} />
        <Rect x="12" y="10" width="60" height="60" rx="19" fill={color} stroke={INK} strokeWidth="2.2" />
        <SvgText x="42" y={mixed ? 52 : 55} fill={INK} fontSize={mixed ? 28 : 43} fontWeight="600" fontFamily="sans-serif" textAnchor="middle">{symbol}</SvgText>
      </G>
      <Circle cx="74" cy="18" r="6" fill={CREAM} stroke={INK} strokeWidth="1.8" />
      <Spark x={15} y={75} size={6} fill={INK} />
      <Circle cx="72" cy="77" r="2.5" fill={INK} opacity={0.6} />
    </Svg>
  );
}

export function TrophyArt({ size = 150 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 180 180" accessible={false}>
      <Ellipse cx="92" cy="163" rx="49" ry="6" fill={INK} opacity={0.09} />
      <Path d="M 49 40 H 25 V 60 C 25 82 37 91 62 92" fill="none" stroke={INK} strokeWidth="12" strokeLinejoin="round" />
      <Path d="M 49 40 H 25 V 60 C 25 82 37 91 62 92" fill="none" stroke={GOLD} strokeWidth="7" strokeLinejoin="round" />
      <Path d="M 130 40 H 154 V 60 C 154 82 142 91 117 92" fill="none" stroke={INK} strokeWidth="12" strokeLinejoin="round" />
      <Path d="M 130 40 H 154 V 60 C 154 82 142 91 117 92" fill="none" stroke={GOLD} strokeWidth="7" strokeLinejoin="round" />
      <Path d="M 80 107 H 103 V 143 H 80 Z" fill={MINT} stroke={INK} strokeWidth="3" />
      <Path d="M 46 29 H 135 L 129 77 C 126 102 111 116 91 116 C 70 116 54 102 51 77 Z" fill={INK} />
      <Path d="M 43 24 H 132 L 126 72 C 123 97 108 111 88 111 C 67 111 51 97 48 72 Z" fill={MINT} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <Path d="M 54 36 L 58 69 C 60 82 65 90 72 96" fill="none" stroke={CREAM} strokeWidth="5" strokeLinecap="round" opacity={0.8} />
      <Circle cx="88" cy="65" r="21" fill={GOLD} stroke={INK} strokeWidth="2" />
      <Path d="M 88 50 L 92 60 L 103 61 L 95 69 L 97 80 L 88 74 L 78 80 L 81 69 L 73 61 L 84 60 Z" fill={INK} />
      <Rect x="60" y="143" width="64" height="17" rx="4" fill={INK} />
      <Rect x="56" y="138" width="64" height="17" rx="4" fill={GOLD} stroke={INK} strokeWidth="3" />
      <Spark x={25} y={112} size={9} fill={CORAL} />
      <Spark x={151} y={109} size={12} />
      <Spark x={148} y={15} size={7} fill={CORAL} />
      <Circle cx="25" cy="15" r="3.5" fill={GOLD} />
      <Circle cx="166" cy="76" r="3" fill={CORAL} />
      <Line x1="16" y1="94" x2="11" y2="98" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      <Line x1="163" y1="31" x2="168" y2="27" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  );
}
