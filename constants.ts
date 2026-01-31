
export const GRID_SIZE = 0.00006; // Aproximadamente 6-7m para altíssima precisão de captura
export const CELL_AREA_M2 = 45; // Área aproximada de uma célula do novo grid
export const ANTI_CHEAT_SPEED_LIMIT_KMH = 25;
export const XP_PER_KM = 100;
export const XP_PER_SECTOR = 2; // XP por célula reduzido pois agora existem mais células
export const XP_PER_SABOTAGE = 2;
export const XP_PER_CITADEL = 50;
export const LEVEL_XP_BASE = 1000;

export const COLORS = {
  PRIMARY: '#3B82F6', 
  ACCENT: '#10B981', 
  DANGER: '#EF4444', 
  NEUTRAL: '#4B5563',
  GOLD: '#F59E0B'
};

export const BADGES = [
  { id: 'first_blood', name: 'First Blood', description: 'Neutralized an enemy sector', icon: 'Zap' },
  { id: 'landlord', name: 'Landlord', description: 'Claimed over 10,000m² in one run', icon: 'Home' },
  { id: 'saboteur', name: 'Elite Saboteur', description: 'Neutralized 20 enemy sectors', icon: 'Ghost' },
  { id: 'explorer', name: 'Vanguard', description: 'Traversed 5km total', icon: 'Navigation' },
  { id: 'citadel', name: 'Citadel King', description: 'Captured a Strategic Zone', icon: 'Landmark' }
];
