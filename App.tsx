
import React, { useState, useEffect, useRef } from 'react';
import { 
  GameState, EntityType, Player, Entity, ItemType, 
  Direction, Position, LevelData, GameItem, Enemy, Projectile, VisualEffect, Difficulty, GameMode,
  TILE_SIZE
} from './types';
import { GRID_W, GRID_H, PLAYER_STATS, ENEMY_STATS, ITEM_CONFIG } from './constants';
import GridMap from './components/GridMap';
import { generateNarratorText, NarratorResponse } from './services/geminiService';
import { audio } from './services/audioService';
import { 
  Volume2, VolumeX, Heart, Skull, RotateCcw, 
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Crosshair, User, Users
} from 'lucide-react';

// --- Pathfinding & Level Gen ---
const ensurePath = (grid: number[][], start: Position, end: Position) => {
    // A simple BFS to find if path exists
    const q: Position[] = [start];
    const visited = new Set<string>();
    const parent = new Map<string, Position>();
    const key = (p: Position) => `${p.x},${p.y}`;
    
    visited.add(key(start));
    
    let found = false;
    
    // BFS to check connectivity
    let head = 0;
    while(head < q.length) {
        const curr = q[head++];
        if (curr.x === end.x && curr.y === end.y) {
            found = true;
            break;
        }
        
        const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
        for(const [dx, dy] of dirs) {
            const nx = curr.x + dx;
            const ny = curr.y + dy;
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
                // We treat 0 (floor) as walkable. 
                if (grid[ny][nx] === 0 && !visited.has(`${nx},${ny}`)) {
                    visited.add(`${nx},${ny}`);
                    parent.set(`${nx},${ny}`, curr);
                    q.push({x: nx, y: ny});
                }
            }
        }
    }

    // If not found, Carve a path (Drunkard walk / Direct interpolation)
    if (!found) {
        console.log("No path found, carving...");
        let cx = start.x;
        let cy = start.y;
        while(cx !== end.x || cy !== end.y) {
             if (cx < end.x) cx++;
             else if (cx > end.x) cx--;
             else if (cy < end.y) cy++;
             else if (cy > end.y) cy--;
             
             if (grid[cy][cx] !== 0) {
                 grid[cy][cx] = 0;
             }
        }
    }
};

const createLevel = (levelNum: number, difficulty: Difficulty): LevelData => {
  // Config based on Difficulty
  let wallChance = 0.15;
  let breakableChance = 0.05;

  if (difficulty === Difficulty.EASY) {
      wallChance = 0.1;
      breakableChance = 0.02;
  } else if (difficulty === Difficulty.HARD) {
      wallChance = 0.25;
      breakableChance = 0.1;
  }

  const grid = Array(GRID_H).fill(0).map(() => Array(GRID_W).fill(0));
  
  // Border Walls
  for(let y=0; y<GRID_H; y++) {
    for(let x=0; x<GRID_W; x++) {
      if(y===0 || y===GRID_H-1 || x===0 || x===GRID_W-1) grid[y][x] = 1;
      else if (Math.random() < wallChance) grid[y][x] = 1; // Random walls
      else if (Math.random() < breakableChance) grid[y][x] = 2; // Breakable
    }
  }

  const startPos = { x: 2, y: 2 };
  const endPos = { x: GRID_W - 3, y: GRID_H - 3 };

  // Clear Start and End areas
  for(let y=1; y<4; y++) for(let x=1; x<4; x++) grid[y][x] = 0;
  for(let y=GRID_H-5; y<GRID_H-1; y++) for(let x=GRID_W-5; x<GRID_W-1; x++) grid[y][x] = 0;

  // Ensure connectivity
  ensurePath(grid, startPos, endPos);

  return {
    grid,
    width: GRID_W,
    height: GRID_H,
    startPos,
    endPos
  };
};

const INITIAL_PLAYERS: Player[] = [
  {
    id: 'p1', type: EntityType.PLAYER_RED, pos: {x: 1, y: 1}, 
    hp: PLAYER_STATS.RED.hp, maxHp: PLAYER_STATS.RED.maxHp, isDead: false, lives: PLAYER_STATS.RED.lives,
    direction: Direction.DOWN, inventory: [], skillPoints: 0, shield: 0, attackCooldown: 0
  },
  {
    id: 'p2', type: EntityType.PLAYER_WHITE, pos: {x: 2, y: 1}, 
    hp: PLAYER_STATS.WHITE.hp, maxHp: PLAYER_STATS.WHITE.maxHp, isDead: false, lives: PLAYER_STATS.WHITE.lives,
    direction: Direction.DOWN, inventory: [], skillPoints: 0, shield: 0, attackCooldown: 0
  }
];

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.NORMAL);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.COOP);
  const [level, setLevel] = useState(1);
  const [narrator, setNarrator] = useState<NarratorResponse>({ message: "正在生成世界...", tone: 'neutral' });
  const [muted, setMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  // Game State Refs
  const gameStateRef = useRef<GameState>(GameState.MENU);
  const playersRef = useRef<Player[]>([]);
  const enemiesRef = useRef<Entity[]>([]);
  const itemsRef = useRef<GameItem[]>([]);
  const oxygenRef = useRef<Entity>({
    id: 'oxygen', type: EntityType.OXYGEN_TANK, pos: {x: 1, y: 2}, 
    hp: 100, maxHp: 100, isDead: false
  });
  const projectilesRef = useRef<Projectile[]>([]);
  const effectsRef = useRef<VisualEffect[]>([]);
  const gridRef = useRef<number[][]>([]);
  const fogRef = useRef<boolean[][]>([]);
  const keysRef = useRef<Set<string>>(new Set());
  const loopRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const levelEndRef = useRef<Position>({x: 0, y: 0});

  // Force Render Trigger
  const [, setTick] = useState(0);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Window Resize Listener for Camera
  useEffect(() => {
    const handleResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Input Handling ---
  useEffect(() => {
    const down = (e: KeyboardEvent) => keysRef.current.add(e.code);
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // --- Touch Logic ---
  const handleTouchStart = (key: string) => {
    keysRef.current.add(key);
  };
  const handleTouchEnd = (key: string) => {
    keysRef.current.delete(key);
  };

  // --- Game Loop ---
  const startGame = async () => {
    audio.resume();
    // Initialize Players based on Mode
    let startPlayers = JSON.parse(JSON.stringify(INITIAL_PLAYERS));
    if (gameMode === GameMode.SINGLE) {
        // Only White Cell
        startPlayers = startPlayers.filter((p: Player) => p.type === EntityType.PLAYER_WHITE);
    }
    playersRef.current = startPlayers;

    setLevel(1);
    startLevel(1);
  };

  const startLevel = (lvl: number) => {
    const levelData = createLevel(lvl, difficulty);
    gridRef.current = levelData.grid;
    levelEndRef.current = levelData.endPos;

    fogRef.current = Array(GRID_H).fill(false).map(() => Array(GRID_W).fill(false));

    // Reset positions
    const pRed = playersRef.current.find(p => p.type === EntityType.PLAYER_RED);
    const pWhite = playersRef.current.find(p => p.type === EntityType.PLAYER_WHITE);

    if (pRed) pRed.pos = { ...levelData.startPos };
    
    // If Co-op, White starts slightly offset. If Single, White starts at startPos.
    if (pWhite) {
        if (pRed) {
            pWhite.pos = { ...levelData.startPos, x: levelData.startPos.x + 1 };
        } else {
            pWhite.pos = { ...levelData.startPos };
        }
    }
    
    playersRef.current.forEach(p => {
        // Heal full on new level, but lives persist
        if (!p.isDead) {
             p.hp = p.maxHp; 
             p.inventory = [];
        } else {
             // If dead but level cleared by partner, revive with half HP
             if (p.lives > 0) {
                 p.isDead = false;
                 p.hp = p.maxHp / 2;
             }
        }
    });

    oxygenRef.current.pos = { ...levelData.startPos, y: levelData.startPos.y + 1 };
    oxygenRef.current.hp = 100;
    oxygenRef.current.isDead = false;

    enemiesRef.current = [];
    
    // Enemy Count based on Difficulty
    let baseEnemyCount = 3 + lvl * 2;
    if (difficulty === Difficulty.EASY) baseEnemyCount = Math.max(2, baseEnemyCount - 2);
    if (difficulty === Difficulty.HARD) baseEnemyCount += 3;

    for(let i=0; i<baseEnemyCount; i++) {
      let ex, ey;
      do {
        ex = Math.floor(Math.random() * GRID_W);
        ey = Math.floor(Math.random() * GRID_H);
      } while (gridRef.current[ey][ex] !== 0 || Math.abs(ex - levelData.startPos.x) < 5);
      
      enemiesRef.current.push({
        id: `e-${i}`,
        type: (i % 3 === 0 && lvl > 1) ? EntityType.ENEMY_VIRUS : EntityType.ENEMY_BACTERIA,
        pos: {x: ex, y: ey},
        hp: (i % 3 === 0 && lvl > 1) ? ENEMY_STATS.VIRUS.hp : ENEMY_STATS.BACTERIA.hp,
        maxHp: 30,
        isDead: false,
        targetId: null,
        attackTimer: 0
      } as unknown as Entity);
    }

    if (lvl % 3 === 0) {
       enemiesRef.current.push({
        id: `boss-${lvl}`,
        type: EntityType.ENEMY_BOSS,
        pos: {x: levelData.endPos.x - 2, y: levelData.endPos.y - 2},
        hp: ENEMY_STATS.BOSS.hp, maxHp: ENEMY_STATS.BOSS.hp,
        isDead: false, targetId: null, attackTimer: 0
       } as unknown as Entity);
       
       setNarrator({ message: "Boss出现！", tone: 'ominous' });
       setIsLoading(true);
       generateNarratorText(lvl, 'BOSS').then(res => {
         setNarrator(res);
         setIsLoading(false);
       });
    } else {
       setNarrator({ message: `第 ${lvl} 关`, tone: 'neutral' });
       setIsLoading(true);
       generateNarratorText(lvl, 'START').then(res => {
         setNarrator(res);
         setIsLoading(false);
       });
    }

    itemsRef.current = [];
    projectilesRef.current = []; 
    effectsRef.current = [];
    
    for(let i=0; i<6; i++) {
        let ix, iy;
        do { ix = Math.floor(Math.random() * GRID_W); iy = Math.floor(Math.random() * GRID_H); } while(gridRef.current[iy][ix] !== 0);
        const types = Object.values(ItemType);
        itemsRef.current.push({
            id: `item-${i}`,
            type: EntityType.ITEM,
            itemType: types[Math.floor(Math.random() * types.length)],
            pos: {x: ix, y: iy},
            hp: 1, maxHp: 1, isDead: false
        });
    }

    setGameState(GameState.PLAYING);
    lastTimeRef.current = performance.now();
    loopRef.current = requestAnimationFrame(update);
  };

  const spawnExplosion = (center: Position, radius: number) => {
    audio.playExplosion();
    const currentGrid = gridRef.current;
    const newGrid = currentGrid.map(row => [...row]); // Copy for mutation
    let gridChanged = false;

    // Render Effect
    for (let y = -radius; y <= radius; y++) {
        for (let x = -radius; x <= radius; x++) {
            const tx = center.x + x;
            const ty = center.y + y;
            if (tx >= 0 && tx < GRID_W && ty >= 0 && ty < GRID_H) {
                 effectsRef.current.push({
                     id: `exp-${Date.now()}-${x}-${y}`,
                     type: 'EXPLOSION',
                     pos: {x: tx, y: ty},
                     duration: 15
                 });
                 
                 // Damage Enemies
                 enemiesRef.current.forEach(e => {
                     if (Math.round(e.pos.x) === tx && Math.round(e.pos.y) === ty) {
                         e.hp -= 100;
                     }
                 });
                 
                 // Break Walls
                 if (newGrid[ty][tx] === 2) { // Breakable wall
                     newGrid[ty][tx] = 0;
                     gridChanged = true;
                 }
            }
        }
    }
    
    if (gridChanged) {
        gridRef.current = newGrid;
    }
  };

  const getTargetPos = (p: Player): Position => {
      let tx = p.pos.x;
      let ty = p.pos.y;
      if (p.direction === Direction.UP) ty -= 1;
      else if (p.direction === Direction.DOWN) ty += 1;
      else if (p.direction === Direction.LEFT) tx -= 1;
      else if (p.direction === Direction.RIGHT) tx += 1;
      return {x: tx, y: ty};
  };

  const fireProjectile = (p: Player, damage: number, color: string) => {
    let vel = {x: 0, y: 0};
    switch(p.direction) {
        case Direction.UP: vel.y = -0.5; break;
        case Direction.DOWN: vel.y = 0.5; break;
        case Direction.LEFT: vel.x = -0.5; break;
        case Direction.RIGHT: vel.x = 0.5; break;
    }
    
    projectilesRef.current.push({
        id: `proj-${Date.now()}-${Math.random()}`,
        pos: { x: p.pos.x + vel.x * 1.5, y: p.pos.y + vel.y * 1.5 },
        vel: vel,
        ownerId: p.id,
        damage: damage,
        color: color
    });
    audio.playAttack();
  };

  const useItem = (p: Player): boolean => {
      const bombIdx = p.inventory.indexOf(ItemType.BOMB);
      if (bombIdx !== -1) {
          spawnExplosion(p.pos, 2);
          p.inventory.splice(bombIdx, 1);
          return true;
      }
      
      const knifeIdx = p.inventory.indexOf(ItemType.KNIFE);
      if (knifeIdx !== -1) {
          fireProjectile(p, 100, '#ffff00'); 
          p.inventory.splice(knifeIdx, 1);
          return true;
      }

      const shovelIdx = p.inventory.indexOf(ItemType.SHOVEL);
      if (shovelIdx !== -1) {
          const t = getTargetPos(p);
          if (t.x >=0 && t.x < GRID_W && t.y >= 0 && t.y < GRID_H) {
             if (gridRef.current[t.y][t.x] === 1 || gridRef.current[t.y][t.x] === 2) {
                 const newGrid = gridRef.current.map(row => [...row]);
                 newGrid[t.y][t.x] = 0; 
                 gridRef.current = newGrid;
                 audio.playHit();
                 p.inventory.splice(shovelIdx, 1);
                 return true;
             }
          }
      }

      const bandAidIdx = p.inventory.indexOf(ItemType.BAND_AID);
      if (bandAidIdx !== -1) {
          const t = getTargetPos(p);
          if (t.x >=0 && t.x < GRID_W && t.y >= 0 && t.y < GRID_H) {
             if (gridRef.current[t.y][t.x] === 0) {
                 const newGrid = gridRef.current.map(row => [...row]);
                 newGrid[t.y][t.x] = 2; 
                 gridRef.current = newGrid;
                 audio.playPowerup();
                 p.inventory.splice(bandAidIdx, 1);
                 return true;
             }
          }
      }

      const scopeIdx = p.inventory.indexOf(ItemType.TELESCOPE);
      if (scopeIdx !== -1) {
          for(let y=0; y<GRID_H; y++) {
              for(let x=0; x<GRID_W; x++) {
                  if (Math.abs(x - p.pos.x) + Math.abs(y - p.pos.y) < 10) {
                      fogRef.current[y][x] = true;
                  }
              }
          }
          audio.playPowerup();
          p.inventory.splice(scopeIdx, 1);
          return true;
      }

      return false;
  };

  const update = (time: number) => {
    if (gameStateRef.current !== GameState.PLAYING) return;
    
    const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1);
    lastTimeRef.current = time;

    // Revival Check
    playersRef.current.forEach(p => {
        if (!p.isDead && p.hp <= 0) {
            if (p.lives > 0) {
                p.lives--;
                p.hp = p.maxHp;
                audio.playPowerup();
                effectsRef.current.push({
                     id: `revive-${Date.now()}-${p.id}`,
                     type: 'REVIVE',
                     pos: {x: p.pos.x, y: p.pos.y},
                     duration: 30
                });
                setNarrator({message: "玩家复活！", tone: "urgent"});
            } else {
                p.isDead = true;
                p.hp = 0;
                setNarrator({message: "一名玩家倒下了...", tone: "ominous"});
                audio.playLose();
            }
        }
    });

    if (Math.floor(time / 50) > Math.floor((time - dt*1000)/50)) {
        effectsRef.current.forEach(e => e.duration--);
        effectsRef.current = effectsRef.current.filter(e => e.duration > 0);
    
        projectilesRef.current.forEach(proj => {
            proj.pos.x += proj.vel.x;
            proj.pos.y += proj.vel.y;
        });

        projectilesRef.current = projectilesRef.current.filter(p => {
            if (p.pos.x < 0 || p.pos.x >= GRID_W || p.pos.y < 0 || p.pos.y >= GRID_H) return false;
            if (gridRef.current[Math.round(p.pos.y)][Math.round(p.pos.x)] === 1) return false; 
            
            let hit = false;
            enemiesRef.current.forEach(e => {
                if (!hit && !e.isDead) {
                    const dist = Math.abs(e.pos.x - p.pos.x) + Math.abs(e.pos.y - p.pos.y);
                    if (dist < 1.0) {
                        e.hp -= p.damage;
                        hit = true;
                        audio.playHit();
                    }
                }
            });
            return !hit;
        });
    }

    const handleMove = (pType: EntityType, dx: number, dy: number) => {
      const p = playersRef.current.find(pl => pl.type === pType);
      if (!p || p.isDead) return;
      
      const targetX = p.pos.x + dx;
      const targetY = p.pos.y + dy;
      
      if (dx > 0) p.direction = Direction.RIGHT;
      if (dx < 0) p.direction = Direction.LEFT;
      if (dy > 0) p.direction = Direction.DOWN;
      if (dy < 0) p.direction = Direction.UP;

      if (targetX >= 0 && targetX < GRID_W && targetY >= 0 && targetY < GRID_H) {
        const tile = gridRef.current[targetY][targetX];
        if (tile === 1 || tile === 2) return;

        const oxy = oxygenRef.current;
        if (!oxy.isDead && oxy.pos.x === targetX && oxy.pos.y === targetY) {
            const pushX = targetX + dx;
            const pushY = targetY + dy;
            
            if (pushX >= 0 && pushX < GRID_W && pushY >= 0 && pushY < GRID_H) {
                const pushTile = gridRef.current[pushY][pushX];
                if (pushTile !== 1 && pushTile !== 2) {
                    oxy.pos.x = pushX;
                    oxy.pos.y = pushY;
                    p.pos.x = targetX;
                    p.pos.y = targetY;
                }
            }
        } else {
            p.pos.x = targetX;
            p.pos.y = targetY;
        }
      }
    };

    if (Math.floor(time / 150) > Math.floor((time - dt*1000)/150)) {
        if (keysRef.current.has('KeyW')) handleMove(EntityType.PLAYER_RED, 0, -1);
        else if (keysRef.current.has('KeyS')) handleMove(EntityType.PLAYER_RED, 0, 1);
        else if (keysRef.current.has('KeyA')) handleMove(EntityType.PLAYER_RED, -1, 0);
        else if (keysRef.current.has('KeyD')) handleMove(EntityType.PLAYER_RED, 1, 0);

        if (keysRef.current.has('ArrowUp')) handleMove(EntityType.PLAYER_WHITE, 0, -1);
        else if (keysRef.current.has('ArrowDown')) handleMove(EntityType.PLAYER_WHITE, 0, 1);
        else if (keysRef.current.has('ArrowLeft')) handleMove(EntityType.PLAYER_WHITE, -1, 0);
        else if (keysRef.current.has('ArrowRight')) handleMove(EntityType.PLAYER_WHITE, 1, 0);
        
        enemiesRef.current.forEach(e => {
            const enemy = e as unknown as Enemy;
            if (enemy.hp <= 0) return;
            
            const targets = [...playersRef.current, oxygenRef.current].filter(t => !t.isDead);
            if (targets.length === 0) return;
            
            const target = targets.reduce((prev, curr) => {
                const distPrev = Math.abs(prev.pos.x - enemy.pos.x) + Math.abs(prev.pos.y - enemy.pos.y);
                const distCurr = Math.abs(curr.pos.x - enemy.pos.x) + Math.abs(curr.pos.y - enemy.pos.y);
                return distCurr < distPrev ? curr : prev;
            });

            if (Math.random() < 0.6) { 
                const dx = target.pos.x - enemy.pos.x;
                const dy = target.pos.y - enemy.pos.y;
                let mx = 0, my = 0;
                if (Math.abs(dx) > Math.abs(dy)) mx = Math.sign(dx);
                else my = Math.sign(dy);
                
                if (gridRef.current[enemy.pos.y + my]?.[enemy.pos.x + mx] === 0) {
                    enemy.pos.x += mx;
                    enemy.pos.y += my;
                }
            }
            
            if (Math.abs(target.pos.x - enemy.pos.x) + Math.abs(target.pos.y - enemy.pos.y) <= 1) {
                target.hp -= (enemy.type === EntityType.ENEMY_BOSS ? 10 : 2);
                if(target.hp < 0) target.hp = 0;
                audio.playHit();
            }
        });
    }

    if (keysRef.current.has('Space')) {
        const p1 = playersRef.current.find(p => p.type === EntityType.PLAYER_RED);
        if (p1 && p1.attackCooldown <= 0 && !p1.isDead) {
            const usedItem = useItem(p1);
            if (!usedItem) {
                fireProjectile(p1, PLAYER_STATS.RED.attack, '#ff9999'); 
                p1.attackCooldown = 20; 
            } else {
                p1.attackCooldown = 30;
            }
        }
    }

    if (keysRef.current.has('Enter') || keysRef.current.has('NumpadEnter')) {
        const p2 = playersRef.current.find(p => p.type === EntityType.PLAYER_WHITE);
        if (p2 && p2.attackCooldown <= 0 && !p2.isDead) {
             const usedItem = useItem(p2);
             if (!usedItem) {
                fireProjectile(p2, PLAYER_STATS.WHITE.attack, '#ffffff');
                p2.attackCooldown = 30; 
             } else {
                 p2.attackCooldown = 30;
             }
        }
    }
    
    playersRef.current.forEach(p => { if (p.attackCooldown > 0) p.attackCooldown--; });

    itemsRef.current = itemsRef.current.filter(item => {
        let picked = false;
        playersRef.current.forEach(p => {
            if (p.pos.x === item.pos.x && p.pos.y === item.pos.y && !p.isDead) {
                picked = true;
                audio.playPowerup();
                if (item.itemType === ItemType.BLOOD_ORB) p.hp = Math.min(p.hp + 50, p.maxHp);
                else if (item.itemType === ItemType.SHIELD) p.shield += 50;
                else if (item.itemType === ItemType.BLIND_BOX) {
                    if (Math.random() > 0.4) {
                         p.hp = Math.min(p.hp + 30, p.maxHp);
                         setNarrator({message: "幸运！恢复生命。", tone: "celebratory"});
                    } else {
                         p.hp -= 10;
                         setNarrator({message: "厄运！受到伤害。", tone: "ominous"});
                    }
                } else {
                    p.inventory.push(item.itemType);
                }
            }
        });
        return !picked;
    });

    playersRef.current.forEach(p => {
        if (p.isDead) return;
        const radius = 4;
        for(let y = -radius; y <= radius; y++) {
            for(let x = -radius; x <= radius; x++) {
                const fy = p.pos.y + y;
                const fx = p.pos.x + x;
                if (fx >=0 && fx < GRID_W && fy >=0 && fy < GRID_H) {
                    fogRef.current[fy][fx] = true;
                }
            }
        }
    });

    enemiesRef.current = enemiesRef.current.filter(e => e.hp > 0);

    const oxy = oxygenRef.current;
    const activePlayers = playersRef.current;
    // Game over if Oxygen dies or ALL players are dead
    const allPlayersDead = activePlayers.length > 0 && activePlayers.every(p => p.isDead);

    if (oxy.hp <= 0 || allPlayersDead) {
        setGameState(GameState.GAME_OVER);
        generateNarratorText(level, 'LOSE').then(setNarrator);
        audio.playLose();
        return;
    }

    if (oxy.pos.x === levelEndRef.current.x && oxy.pos.y === levelEndRef.current.y) {
        setGameState(GameState.LEVEL_COMPLETE);
        generateNarratorText(level, 'WIN').then(setNarrator);
        audio.playWin();
        return;
    }

    setTick(t => t + 1);
    loopRef.current = requestAnimationFrame(update);
  };

  useEffect(() => {
    return () => cancelAnimationFrame(loopRef.current);
  }, []);

  const handleNextLevel = () => {
    setLevel(l => l + 1);
    startLevel(level + 1);
  };

  const handleRestart = () => {
      // Logic for restarting handled in startGame
      startGame();
  };

  const mouseOnlyProps = {
    onKeyDown: (e: React.KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
    onFocus: (e: React.FocusEvent<HTMLButtonElement>) => {
      e.target.blur();
    },
    tabIndex: -1 
  };

  // --- Camera Style Calculation ---
  const getCameraStyle = () => {
    if (gameState !== GameState.PLAYING) return {};
    
    // Determine target based on active players
    const active = playersRef.current.filter(p => !p.isDead);
    const targets = active.length > 0 ? active : playersRef.current;
    
    if (targets.length === 0) return {};

    // Center in Tile Coordinates
    const avgX = targets.reduce((s, p) => s + p.pos.x, 0) / targets.length;
    const avgY = targets.reduce((s, p) => s + p.pos.y, 0) / targets.length;
    
    // Center in Pixels
    const targetPixelX = avgX * TILE_SIZE + (TILE_SIZE / 2);
    const targetPixelY = avgY * TILE_SIZE + (TILE_SIZE / 2);
    
    const { w, h } = windowSize;
    const mapW = GRID_W * TILE_SIZE;
    const mapH = GRID_H * TILE_SIZE;
    
    let tx = (w / 2) - targetPixelX;
    let ty = (h / 2) - targetPixelY;
    
    // Clamp to map bounds (optional, keeps edges clean)
    if (mapW > w) tx = Math.min(0, Math.max(w - mapW, tx));
    else tx = (w - mapW) / 2;

    if (mapH > h) ty = Math.min(0, Math.max(h - mapH, ty));
    else ty = (h - mapH) / 2;

    return {
        transform: `translate(${tx}px, ${ty}px)`,
        transition: 'transform 0.1s linear' 
    };
  };

  // Helper to render HUD panel
  const renderPlayerHUD = (p: Player | undefined, label: string, colorClass: string, isLeft: boolean) => {
      if (!p) return <div className="w-72"></div>; // Placeholder
      
      const content = (
          <div className="mc-panel p-2 w-72">
              <h3 className={`font-bold ${colorClass} flex items-center ${isLeft ? '' : 'justify-end'} gap-2 mb-1`}>
                 {isLeft && <div className="w-4 h-4 bg-red-600 border border-black"></div>}
                 {isLeft ? label : null}
                 <div className={`flex ${isLeft ? 'ml-2' : 'mr-2'}`}>
                     {Array.from({length: 4}).map((_, i) => (
                         <Heart key={i} size={12} fill={i < p.lives ? (isLeft ? "red" : "white") : "gray"} color="black" />
                     ))}
                 </div>
                 {!isLeft ? label : null}
                 {!isLeft && <div className="w-4 h-4 bg-white border border-black"></div>}
              </h3>
              <div className="w-full bg-gray-800 h-4 border-2 border-white relative">
                   <div className={`${isLeft ? 'bg-red-500' : 'bg-white'} h-full`} style={{width: `${(p.hp/p.maxHp)*100}%`}}></div>
              </div>
              <div className={`flex gap-1 mt-2 ${isLeft ? '' : 'justify-end'} flex-wrap min-h-[24px]`}>
                  {p.inventory.map((it, i) => (
                      <span key={i} className="text-xs bg-gray-400 border border-black px-1 text-black">{ITEM_CONFIG[it].name}</span>
                  ))}
              </div>
           </div>
      );
      return content;
  }

  const p1 = playersRef.current.find(p => p.type === EntityType.PLAYER_RED);
  const p2 = playersRef.current.find(p => p.type === EntityType.PLAYER_WHITE);

  return (
    <div className="w-full h-screen bg-[#333] relative overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
      
      {/* HUD Layer - Fixed */}
      {gameState === GameState.PLAYING && (
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none z-50 font-mono scale-75 origin-top-left md:scale-100 md:origin-top">
           {/* Player 1 HUD (Red) */}
           {gameMode === GameMode.COOP ? renderPlayerHUD(p1, "玩家1 (WASD)", "text-red-900", true) : <div className="w-72"></div>}

           <div className="flex flex-col items-center">
               <div className="mc-panel px-6 py-2 mb-2">
                   <h2 className="text-2xl font-bold text-black text-shadow-mc text-white">LEVEL {level}</h2>
                   <div className="text-center text-xs font-bold text-gray-700">{difficulty}</div>
               </div>
               <div className="mc-panel p-2 w-56 text-center">
                    <span className="text-blue-900 text-sm font-bold block mb-1">OXYGEN TANK</span>
                    <div className="w-full bg-gray-800 h-4 border-2 border-white relative">
                        <div className="bg-cyan-400 h-full" style={{width: `${(oxygenRef.current.hp/oxygenRef.current.maxHp)*100}%`}}></div>
                    </div>
               </div>
           </div>

           {/* Player 2 HUD (White) */}
           {renderPlayerHUD(p2, "玩家 (Arrows)", "text-gray-800", false)}
        </div>
      )}

      {/* Narrator Toast */}
      {gameState === GameState.PLAYING && (
          <div className="absolute bottom-40 left-1/2 -translate-x-1/2 w-[90%] md:w-[600px] z-40 pointer-events-none">
             <div className="bg-black/70 border-2 border-gray-500 p-2 text-white font-mono text-sm md:text-lg">
                 <p>
                    <span className="text-yellow-400">&lt;System&gt;</span> {isLoading ? "..." : narrator.message}
                 </p>
             </div>
          </div>
      )}

      {/* Touch Controls Overlay */}
      {gameState === GameState.PLAYING && (
        <>
            {/* Left Pad (WASD) - Only in COOP */}
            {gameMode === GameMode.COOP && (
                <div className="absolute bottom-4 left-4 z-50 flex flex-col items-center gap-1 select-none md:hidden">
                    <button 
                        className="w-12 h-12 rounded-lg dpad-btn flex items-center justify-center text-white"
                        onTouchStart={(e) => { e.preventDefault(); handleTouchStart('KeyW'); }}
                        onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('KeyW'); }}
                    ><ArrowUp size={24}/></button>
                    <div className="flex gap-1">
                        <button 
                            className="w-12 h-12 rounded-lg dpad-btn flex items-center justify-center text-white"
                            onTouchStart={(e) => { e.preventDefault(); handleTouchStart('KeyA'); }}
                            onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('KeyA'); }}
                        ><ArrowLeft size={24}/></button>
                        <button 
                            className="w-12 h-12 rounded-lg dpad-btn flex items-center justify-center text-white"
                            onTouchStart={(e) => { e.preventDefault(); handleTouchStart('KeyS'); }}
                            onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('KeyS'); }}
                        ><ArrowDown size={24}/></button>
                        <button 
                            className="w-12 h-12 rounded-lg dpad-btn flex items-center justify-center text-white"
                            onTouchStart={(e) => { e.preventDefault(); handleTouchStart('KeyD'); }}
                            onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('KeyD'); }}
                        ><ArrowRight size={24}/></button>
                    </div>
                    <button 
                        className="w-16 h-12 mt-2 rounded-lg bg-red-600/50 border-2 border-red-400 flex items-center justify-center text-white"
                        onTouchStart={(e) => { e.preventDefault(); handleTouchStart('Space'); }}
                        onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('Space'); }}
                    ><Crosshair size={24}/></button>
                </div>
            )}

            {/* Right Pad (Arrows) - Always visible for P2 (White Cell) */}
            <div className="absolute bottom-4 right-4 z-50 flex flex-col items-center gap-1 select-none md:hidden">
                <button 
                    className="w-12 h-12 rounded-lg dpad-btn flex items-center justify-center text-white"
                    onTouchStart={(e) => { e.preventDefault(); handleTouchStart('ArrowUp'); }}
                    onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('ArrowUp'); }}
                ><ArrowUp size={24}/></button>
                <div className="flex gap-1">
                    <button 
                        className="w-12 h-12 rounded-lg dpad-btn flex items-center justify-center text-white"
                        onTouchStart={(e) => { e.preventDefault(); handleTouchStart('ArrowLeft'); }}
                        onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('ArrowLeft'); }}
                    ><ArrowLeft size={24}/></button>
                     <button 
                        className="w-12 h-12 rounded-lg dpad-btn flex items-center justify-center text-white"
                        onTouchStart={(e) => { e.preventDefault(); handleTouchStart('ArrowDown'); }}
                        onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('ArrowDown'); }}
                    ><ArrowDown size={24}/></button>
                     <button 
                        className="w-12 h-12 rounded-lg dpad-btn flex items-center justify-center text-white"
                        onTouchStart={(e) => { e.preventDefault(); handleTouchStart('ArrowRight'); }}
                        onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('ArrowRight'); }}
                    ><ArrowRight size={24}/></button>
                </div>
                <button 
                    className="w-16 h-12 mt-2 rounded-lg bg-white/50 border-2 border-white flex items-center justify-center text-black"
                    onTouchStart={(e) => { e.preventDefault(); handleTouchStart('Enter'); }}
                    onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('Enter'); }}
                ><Crosshair size={24}/></button>
            </div>
        </>
      )}

      {/* Main Menu */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50">
          <h1 className="text-4xl md:text-6xl mb-8 text-white text-shadow-mc font-bold tracking-widest text-center">
            CELL DEFENDERS
          </h1>
          <div className="mc-panel p-8 text-center max-w-md flex flex-col gap-4 items-center mx-4">
              <p className="text-lg mb-2 text-black font-bold">
                 PROTECT THE OXYGEN<br/>
                 SURVIVE THE INFECTION
              </p>
              
              {/* Difficulty Select */}
              <div className="flex gap-2 mb-2 w-full justify-center">
                  {[Difficulty.EASY, Difficulty.NORMAL, Difficulty.HARD].map(d => (
                      <button 
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={`mc-button py-2 px-3 text-xs flex-1 ${difficulty === d ? 'brightness-125 border-yellow-400 bg-gray-500' : ''}`}
                      >
                          {d}
                      </button>
                  ))}
              </div>

              {/* Game Mode Select */}
              <div className="flex gap-2 mb-4 w-full justify-center">
                  <button 
                    onClick={() => setGameMode(GameMode.SINGLE)}
                    className={`mc-button py-3 px-4 flex-1 flex items-center justify-center gap-2 ${gameMode === GameMode.SINGLE ? 'brightness-125 border-green-500 bg-gray-500' : ''}`}
                  >
                     <User size={16} /> 1 PLAYER
                  </button>
                  <button 
                    onClick={() => setGameMode(GameMode.COOP)}
                    className={`mc-button py-3 px-4 flex-1 flex items-center justify-center gap-2 ${gameMode === GameMode.COOP ? 'brightness-125 border-green-500 bg-gray-500' : ''}`}
                  >
                     <Users size={16} /> 2 PLAYERS
                  </button>
              </div>

              <button onClick={startGame} className="mc-button py-4 px-8 text-2xl active:translate-y-1 w-full">
                START GAME
              </button>
          </div>
        </div>
      )}

      {/* Game Over / Win Screens */}
      {(gameState === GameState.GAME_OVER || gameState === GameState.LEVEL_COMPLETE) && (
        <div className="absolute inset-0 bg-red-900/50 flex items-center justify-center z-[100]">
          <div className="mc-panel p-8 text-center max-w-lg mx-4">
             {gameState === GameState.GAME_OVER ? (
                 <>
                    <h2 className="text-4xl text-red-700 mb-4 font-bold text-shadow-mc text-red-900">GAME OVER</h2>
                    <p className="text-black mb-6 text-xl">{narrator.message}</p>
                    <button 
                        onClick={handleRestart} 
                        className="mc-button py-3 px-8 text-xl w-full"
                        {...mouseOnlyProps}
                    >
                        RESPAWN
                    </button>
                 </>
             ) : (
                 <>
                    <h2 className="text-4xl text-green-700 mb-4 font-bold text-shadow-mc text-green-900">LEVEL COMPLETE!</h2>
                    <p className="text-black mb-6 text-xl">{narrator.message}</p>
                    <button onClick={handleNextLevel} className="mc-button py-3 px-8 text-xl w-full">
                        NEXT LEVEL
                    </button>
                 </>
             )}
          </div>
        </div>
      )}

      {/* Game Map Layer - With Camera Transform */}
      {gameState !== GameState.MENU && (
        <div 
            className="absolute top-0 left-0 origin-top-left" 
            style={getCameraStyle()}
        >
            <GridMap 
                grid={gridRef.current}
                fog={fogRef.current}
                players={playersRef.current}
                enemies={enemiesRef.current}
                items={itemsRef.current}
                oxygenTank={oxygenRef.current}
                width={GRID_W}
                height={GRID_H}
                projectiles={projectilesRef.current}
                effects={effectsRef.current}
                exitPos={levelEndRef.current}
            />
        </div>
      )}
      
      {/* Top Right Controls: Restart & Audio */}
      <div className="absolute top-4 right-4 flex gap-2 z-50">
        {gameState !== GameState.MENU && (
             <button 
                onClick={handleRestart} 
                className="mc-button p-2 bg-red-600 hover:bg-red-500"
                title="Restart Game"
                {...mouseOnlyProps}
            >
                <RotateCcw size={20} />
            </button>
        )}
        <button 
            onClick={() => { audio.resume(); setMuted(!muted); }} 
            className="mc-button p-2"
            title="Toggle Audio"
        >
            {muted ? <VolumeX size={20}/> : <Volume2 size={20}/>}
        </button>
      </div>

    </div>
  );
}
