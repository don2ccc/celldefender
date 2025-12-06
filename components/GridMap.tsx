
import React, { useMemo } from 'react';
import { Entity, EntityType, Player, GameItem, TILE_SIZE, ItemType, Projectile, VisualEffect, Position } from '../types';
import { COLORS } from '../constants';
import { 
  Shield, Sword, Heart, Bomb, Eye, 
  Shovel, Pickaxe, Box, User, 
  Skull, Hexagon, DoorOpen
} from 'lucide-react';

interface Props {
  grid: number[][];
  fog: boolean[][];
  players: Player[];
  enemies: Entity[];
  items: GameItem[];
  oxygenTank: Entity;
  width: number;
  height: number;
  projectiles?: Projectile[];
  effects?: VisualEffect[];
  exitPos: Position;
}

const IconMap = {
  [ItemType.SHIELD]: Shield,
  [ItemType.KNIFE]: Sword,
  [ItemType.BLOOD_ORB]: Heart,
  [ItemType.BOMB]: Bomb,
  [ItemType.TELESCOPE]: Eye,
  [ItemType.SHOVEL]: Pickaxe,
  [ItemType.BAND_AID]: Box,
  [ItemType.BLIND_BOX]: Hexagon,
};

// CSS for a "3D" Block effect
const getBlockStyle = (color: string, size: number = TILE_SIZE) => ({
    backgroundColor: color,
    width: size,
    height: size,
    // Bevel effect
    boxShadow: `inset 4px 4px 0px rgba(255,255,255,0.3), inset -4px -4px 0px rgba(0,0,0,0.3)`,
});

const GridMap: React.FC<Props> = ({ grid, fog, players, enemies, items, oxygenTank, width, height, projectiles = [], effects = [], exitPos }) => {
  
  // Render grid background (static mostly)
  const renderGrid = useMemo(() => {
    return grid.map((row, y) => (
      <div key={`row-${y}`} className="flex">
        {row.map((cell, x) => {
          const isWall = cell === 1;
          const isBreakable = cell === 2;
          let bgColor = COLORS.FLOOR;
          let borderStyle = {};
          
          if (isWall) {
              bgColor = COLORS.WALL;
              borderStyle = {
                  boxShadow: `inset 4px 4px 0px #9e9e9e, inset -4px -4px 0px #424242`
              };
          } else if (isBreakable) {
              bgColor = COLORS.WALL_BREAKABLE;
              borderStyle = {
                  boxShadow: `inset 4px 4px 0px #a67c52, inset -4px -4px 0px #5c3a21`
              };
          } else {
             // Floor Texture hint
              borderStyle = {
                 boxShadow: `inset 2px 2px 0px rgba(255,255,255,0.1)`
              }
          }
          
          return (
            <div 
              key={`cell-${x}-${y}`} 
              style={{ 
                width: TILE_SIZE, 
                height: TILE_SIZE, 
                backgroundColor: bgColor,
                ...borderStyle
              }} 
            />
          );
        })}
      </div>
    ));
  }, [grid]);

  // Helpers for absolute positioning
  const getStyle = (pos: {x: number, y: number}) => ({
    left: pos.x * TILE_SIZE,
    top: pos.y * TILE_SIZE,
    width: TILE_SIZE,
    height: TILE_SIZE,
  });

  return (
    <div 
      className="relative overflow-hidden shadow-2xl border-4 border-black bg-black"
      style={{ width: width * TILE_SIZE, height: height * TILE_SIZE }}
    >
      {/* Layer 1: The Grid */}
      <div className="absolute inset-0 flex flex-col">{renderGrid}</div>

      {/* Layer 1.5: Exit Zone */}
      <div 
        className="absolute flex items-center justify-center animate-pulse" 
        style={{ 
            ...getStyle(exitPos), 
            backgroundColor: '#1a1a1a', 
            boxShadow: 'inset 0 0 15px #00ff00',
            border: '2px dashed #00ff00'
        }}
      >
        <div className="w-full h-full flex flex-col items-center justify-center opacity-80">
            <DoorOpen size={28} color="#00ff00" />
            <div className="text-[10px] text-green-400 font-bold bg-black/50 px-1 mt-[-4px]">EXIT</div>
        </div>
      </div>

      {/* Layer 2: Items */}
      {items.map(item => {
        const Icon = IconMap[item.itemType];
        return (
          <div key={item.id} className="absolute flex items-center justify-center animate-bounce" style={getStyle(item.pos)}>
             <div className="relative">
                 {/* Item glow */}
                 <div className="absolute inset-0 bg-yellow-400 opacity-20 blur-sm"></div>
                 <Icon size={24} color="#ffd700" strokeWidth={3} />
             </div>
          </div>
        );
      })}

      {/* Layer 2.5: Projectiles */}
      {projectiles.map(p => (
        <div
          key={p.id}
          className="absolute z-20"
          style={{
             left: p.pos.x * TILE_SIZE + (TILE_SIZE/2) - 6,
             top: p.pos.y * TILE_SIZE + (TILE_SIZE/2) - 6,
             width: 12, height: 12, backgroundColor: '#fff',
             boxShadow: '2px 2px 0 #555'
          }}
        />
      ))}

      {/* Layer 2.8: Effects */}
      {effects.map(effect => (
         <div 
            key={effect.id}
            className="absolute z-30 flex items-center justify-center pointer-events-none"
            style={getStyle(effect.pos)}
         >
            {effect.type === 'EXPLOSION' && (
                <div className="relative w-full h-full flex items-center justify-center">
                    {/* Core Explosion */}
                    <div className="absolute w-[140%] h-[140%] bg-orange-600 opacity-80 animate-ping rounded-full"></div>
                    <div className="absolute w-full h-full bg-red-500 border-4 border-yellow-300 animate-pulse"></div>
                    {/* Pixel Debris */}
                    <div className="absolute top-0 left-0 w-3 h-3 bg-black animate-[bounce_0.5s_infinite]"></div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-gray-800 animate-[bounce_0.5s_infinite_0.1s]"></div>
                    <div className="absolute top-0 right-0 w-3 h-3 bg-red-800 animate-[bounce_0.5s_infinite_0.2s]"></div>
                    <div className="absolute bottom-0 left-0 w-3 h-3 bg-orange-800 animate-[bounce_0.5s_infinite_0.3s]"></div>
                </div>
            )}
            {effect.type === 'FLASH' && (
                <div className="w-full h-full bg-white opacity-50 animate-pulse"></div>
            )}
            {effect.type === 'REVIVE' && (
                <div className="relative w-full h-full flex items-center justify-center">
                    <div className="absolute w-[180%] h-[180%] border-4 border-green-400 rounded-full animate-[ping_1s_ease-out_infinite] opacity-60"></div>
                    <Heart className="text-pink-500 animate-bounce relative z-10 drop-shadow-[0_0_10px_rgba(255,105,180,0.8)]" size={36} fill="#ff69b4" />
                    <div className="absolute w-full h-full bg-green-200 opacity-30 blur-md rounded-full"></div>
                </div>
            )}
         </div>
      ))}

      {/* Layer 3: Oxygen Tank (Diamond Block) */}
      {!oxygenTank.isDead && (
        <div 
          className="absolute flex items-center justify-center transition-all duration-300"
          style={getStyle(oxygenTank.pos)}
        >
          <div className="relative w-full h-full flex items-center justify-center">
             {/* Block Style Entity */}
             <div style={getBlockStyle(COLORS.OXYGEN, TILE_SIZE - 4)} className="flex items-center justify-center border-2 border-black">
                 <div className="w-4 h-4 bg-cyan-200 opacity-50"></div>
             </div>
             
             {/* HP Bar */}
            <div className="absolute -top-4 left-0 w-full h-2 bg-black border border-white">
              <div className="h-full bg-cyan-400" style={{width: `${(oxygenTank.hp / oxygenTank.maxHp) * 100}%`}}></div>
            </div>
          </div>
        </div>
      )}

      {/* Layer 4: Enemies (Zombies/Creepers) */}
      {enemies.map(enemy => {
        const isBoss = enemy.type === EntityType.ENEMY_BOSS;
        return (
            <div 
            key={enemy.id} 
            className="absolute flex items-center justify-center transition-all duration-200"
            style={getStyle(enemy.pos)}
            >
            <div className={`relative ${isBoss ? 'scale-125 z-20' : ''}`}>
                <div 
                    style={getBlockStyle(isBoss ? COLORS.BOSS : COLORS.ENEMY, isBoss ? 48 : 36)} 
                    className="flex flex-col items-center justify-center border-2 border-black"
                >
                    {/* Face */}
                    <div className="flex gap-1 mb-1">
                        <div className="w-1.5 h-1.5 bg-black"></div>
                        <div className="w-1.5 h-1.5 bg-black"></div>
                    </div>
                    <div className="w-4 h-1 bg-black"></div>
                </div>

                {/* HP Bar */}
                <div className="absolute -top-3 left-0 w-full h-1.5 bg-gray-800 border border-black">
                <div className="h-full bg-green-500" style={{width: `${(enemy.hp / enemy.maxHp) * 100}%`}}></div>
                </div>
            </div>
            </div>
        );
      })}

      {/* Layer 5: Players */}
      {players.map(p => {
        const isRed = p.type === EntityType.PLAYER_RED;
        const color = isRed ? COLORS.RED_CELL : COLORS.WHITE_CELL;
        return (
            <div 
            key={p.id} 
            className="absolute flex items-center justify-center transition-all duration-100 z-10"
            style={getStyle(p.pos)}
            >
            <div className={`relative ${p.shield > 0 ? 'border-4 border-blue-400' : ''}`}>
                 <div 
                    style={getBlockStyle(color, 36)} 
                    className="flex flex-col items-center justify-center border-2 border-black"
                >
                    {/* Eyes */}
                    <div className="flex gap-2 mb-1">
                         <div className="w-1.5 h-1.5 bg-black"></div>
                         <div className="w-1.5 h-1.5 bg-black"></div>
                    </div>
                    {/* Mouth */}
                    <div className="w-2 h-1 bg-pink-300"></div>
                </div>
                
                {/* Direction Pointer (Hand) */}
                <div 
                className="absolute w-3 h-3 bg-gray-300 border border-black"
                style={{
                    top: p.direction === 0 ? -6 : p.direction === 1 ? '100%' : '50%',
                    left: p.direction === 2 ? -6 : p.direction === 3 ? '100%' : '50%',
                    transform: 'translate(-50%, -50%)'
                }}
                />
            </div>
            </div>
        );
      })}

      {/* Layer 6: Fog of War */}
      <div className="absolute inset-0 pointer-events-none">
        {fog.map((row, y) => (
          row.map((visited, x) => {
            // Circular Fog logic
            const isVisible = players.some(p => {
                if (p.isDead) return false;
                // Circular distance for more natural lighting
                const dx = p.pos.x - x;
                const dy = p.pos.y - y;
                return Math.sqrt(dx*dx + dy*dy) < 4.5;
            });
            
            let opacity = 0;
            if (isVisible) {
                opacity = 0; // Fully Visible
            } else if (visited) {
                opacity = 0.6; // Explored area is dim (was 0.5)
            } else {
                opacity = 1; // Unexplored is black
            }
            
            if (opacity === 0) return null; 

            return (
               <div 
                key={`fog-${x}-${y}`} 
                className="absolute bg-black transition-opacity duration-500 ease-in-out"
                style={{ ...getStyle({x, y}), opacity: opacity }} 
              />
            );
          })
        ))}
      </div>
    </div>
  );
};

export default GridMap;
