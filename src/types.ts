export type GameState = 'START' | 'PLAYING' | 'FALLING' | 'CRASHED';

export type PlatformType = 'SOLID' | 'BOUNCY' | 'CRUMBLING' | 'MOVING';

export interface Platform {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: PlatformType;
  floor: number;
  crumbleTimer?: number;
  isCrumbling?: boolean;
  isBroken?: boolean;
  vx?: number;
  minX?: number;
  maxX?: number;
  color: string;
  glow: string;
  visited?: boolean;
}

export interface Gem {
  id: number;
  x: number;
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
  shape: 'circle' | 'square' | 'ring' | 'spark';
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
  vx: number;
  vy: number;
  width: number;
  height: number;
  onGround: boolean;
  groundPlatformId: number | null;
  rotation: number;
  
  // Aim and Jump Charge
  isCharging: boolean;
  charge: number; // 0 to 1
  aimAngle: number; // radians
  aimLength: number;
  
  // Squash and stretch juice
  scaleX: number;
  scaleY: number;
  
  // Progression & Risk Stats
  currentFloor: number;
  maxFloorAchieved: number;
  totalSparks: number;
  currentRunSparks: number;
  comboMultiplier: number;
  comboStreak: number;
  
  // Falling tracking (Only Up dread)
  isFallingFast: boolean;
  fallStartY: number;
  fallDistance: number;
  maxFallRecorded: number;
  
  trailHistory: Array<{ x: number; y: number; alpha: number; scale: number }>;
}
