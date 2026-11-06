export type GameState = 'START' | 'PLAYING' | 'CRASHED';

export type SegmentType = 'GAP' | 'SAFE' | 'HAZARD';

export interface RingSegment {
  startAngle: number; // In radians [0, 2*PI)
  endAngle: number;   // In radians [0, 2*PI)
  type: SegmentType;
  color?: string;
}

export interface Ring {
  id: number;
  depth: number;
  y: number;
  radius: number;
  thickness: number;
  rotation: number;     // Current rotation angle in radians
  rotSpeed: number;     // Auto-rotation speed for challenging rings
  color: string;
  glow: string;
  segments: RingSegment[];
  passed: boolean;
  isBroken: boolean;
  colorIndex: number;
}

export interface Gem {
  id: number;
  ringId: number;
  angle: number;        // Angle on the ring (radians)
  y: number;
  radius: number;
  collected: boolean;
  value: number;
  color: string;
  pulseOffset: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
  shape: 'circle' | 'square' | 'ring' | 'spark' | 'fragment';
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

export interface Player {
  x: number;
  y: number;
  vy: number;
  radius: number;

  // Meteor Fireball Dive Mode (Finite duration & smashes)
  consecutiveGaps: number;
  isMeteor: boolean;
  meteorTimer: number;
  meteorMaxTimer: number;
  meteorSmashesRemaining: number;

  // Snappy Plunge / Fast Drop mechanic (Piano Tiles skill flow)
  isPlunging: boolean;
  plungeBoost: number;

  // Ring/Cylinder rotation steering
  cylinderRotation: number;
  rotationVelocity: number;
  tiltAngle: number;

  // Squash & Stretch juice
  scaleX: number;
  scaleY: number;

  // Color shifting per hole
  colorThemeIndex: number;

  // Progression & Stats
  currentDepth: number;
  maxDepthAchieved: number;
  score: number;
  totalGems: number;
  comboMultiplier: number;
  perfectDropStreak: number;

  // Fast fall state for juice/camera
  isFallingFast: boolean;

  // Visual trail
  trailHistory: Array<{ x: number; y: number; alpha: number; scale: number; isMeteor: boolean }>;
}
