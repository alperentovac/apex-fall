export type GameState = 'START' | 'PLAYING' | 'GAME_OVER';

export type Direction = 'X' | 'Y';

export type TurnResult = 'PERFECT' | 'GOOD' | 'MISS';

export type AudioTier = 1 | 2 | 3 | 4 | 5;

export type PatternType = 'STANDARD' | 'RAPID_BURST' | 'HIGHWAY';

export interface PathSegment {
  index: number;
  dir: Direction;
  start: { x: number; y: number };
  end: { x: number; y: number };
  length: number;
  tileWidth: number;
  patternType?: PatternType;
  hasGem?: boolean;
  gemCollected?: boolean;
  gemPos?: { x: number; y: number };
}

export interface Ball {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  dir: Direction;
  radius: number;
  currentSegmentIndex: number;
  isFalling: boolean;
  fallTimer: number;
}

export interface Particle {
  x: number;
  y: number;
  z?: number;
  vx: number;
  vy: number;
  vz?: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  shape?: 'circle' | 'square' | 'ring' | 'spark' | 'fragment';
  rotation?: number;
  vRot?: number;
}

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
  lineWidth: number;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  vy: number;
  scale: number;
}

export interface GameStats {
  score: number;
  combo: number;
  bestScore: number;
  bestCombo: number;
  audioTier: AudioTier;
  perfectCount: number;
  goodCount: number;
}
