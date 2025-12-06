
export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE'
}

export enum GameMode {
  SINGLE = 'SINGLE',
  COOP = 'COOP'
}

export enum Difficulty {
  EASY = 'EASY',
  NORMAL = 'NORMAL',
  HARD = 'HELL'
}

export enum Direction {
  UP, DOWN, LEFT, RIGHT
}

export enum EntityType {
  PLAYER_RED = 'RED', // Healer/Tank
  PLAYER_WHITE = 'WHITE', // Attacker
  ENEMY_BACTERIA = 'BACTERIA',
  ENEMY_VIRUS = 'VIRUS',
  ENEMY_BOSS = 'BOSS',
  OXYGEN_TANK = 'OXYGEN',
  ITEM = 'ITEM',
  PROJECTILE = 'PROJECTILE',
  WALL = 'WALL',
  BREAKABLE_WALL = 'BREAKABLE_WALL',
  EFFECT = 'EFFECT'
}

export enum ItemType {
  SHIELD = 'SHIELD',
  KNIFE = 'KNIFE',
  BLOOD_ORB = 'BLOOD_ORB', // Health
  BOMB = 'BOMB',
  TELESCOPE = 'TELESCOPE',
  SHOVEL = 'SHOVEL',
  BAND_AID = 'BAND_AID',
  BLIND_BOX = 'BLIND_BOX'
}

export interface Position {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  type: EntityType;
  pos: Position; // Grid coordinates
  hp: number;
  maxHp: number;
  isDead: boolean;
}

export interface Player extends Entity {
  lives: number;
  direction: Direction;
  inventory: ItemType[];
  skillPoints: number;
  shield: number;
  attackCooldown: number;
}

export interface Enemy extends Entity {
  targetId: string | null; // ID of entity chasing
  attackTimer: number;
}

export interface GameItem extends Entity {
  itemType: ItemType;
}

export interface Projectile {
  id: string;
  pos: Position; // Pixel coordinates for smooth movement
  vel: Position;
  ownerId: string;
  damage: number;
  color: string;
}

export interface VisualEffect {
  id: string;
  type: 'EXPLOSION' | 'FLASH' | 'REVIVE';
  pos: Position;
  duration: number; // frames
}

export interface LevelData {
  grid: number[][]; // 0: floor, 1: wall, 2: breakable
  width: number;
  height: number;
  startPos: Position;
  endPos: Position;
}

export const TILE_SIZE = 48; // pixels