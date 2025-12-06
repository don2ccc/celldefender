
import { ItemType } from "./types";

export const GRID_W = 24;
export const GRID_H = 16;

export const PLAYER_STATS = {
  // Red: Needs 2 shots for Bacteria (30 HP) -> 15 Dmg
  RED: { hp: 150, maxHp: 150, attack: 15, speed: 0.15, lives: 4 },
  // White: Needs 1 shot for Bacteria (30 HP) -> 30 Dmg
  WHITE: { hp: 80, maxHp: 80, attack: 30, speed: 0.2, lives: 4 },
};

export const ENEMY_STATS = {
  BACTERIA: { hp: 30, attack: 5, speed: 0.08, score: 10 },
  VIRUS: { hp: 15, attack: 10, speed: 0.12, score: 20 },
  BOSS: { hp: 500, attack: 30, speed: 0.1, score: 500 },
};

export const ITEM_CONFIG = {
  [ItemType.SHIELD]: { name: '铁甲', desc: '+50 护盾' },
  [ItemType.KNIFE]: { name: '强化飞刀', desc: '高额伤害' },
  [ItemType.BLOOD_ORB]: { name: '红苹果', desc: '恢复生命' },
  [ItemType.BOMB]: { name: 'TNT', desc: '范围爆炸' },
  [ItemType.TELESCOPE]: { name: '末影珍珠', desc: '驱散迷雾' },
  [ItemType.SHOVEL]: { name: '钻石镐', desc: '破坏墙壁' },
  [ItemType.BAND_AID]: { name: '泥土块', desc: '修复墙壁' },
  [ItemType.BLIND_BOX]: { name: '幸运方块', desc: '随机效果' },
};

// Minecraft Palette
export const COLORS = {
  FOG: '#000000', // Deep dark
  FLOOR: '#5c943c', // Grass Top Green
  WALL: '#757575', // Stone Grey
  WALL_BREAKABLE: '#8f563b', // Dirt/Wood Brown
  RED_CELL: '#9e2b27', // Red Wool
  WHITE_CELL: '#e3e3e3', // Quartz/Iron
  OXYGEN: '#65aeb5', // Diamond Block
  ENEMY: '#507a34', // Zombie Green
  BOSS: '#28232c', // Wither/Enderman Black
};