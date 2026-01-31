
export const GRID_SIZE = 0.00006; 
export const CELL_AREA_M2 = 45; 
export const ANTI_CHEAT_SPEED_LIMIT_KMH = 25;
export const XP_PER_KM = 100;
export const XP_PER_SECTOR = 2; 
export const XP_PER_SABOTAGE = 2;
export const XP_PER_CITADEL = 50;
export const LEVEL_XP_BASE = 1000;

export const COLORS = {
  PRIMARY: '#3B82F6', 
  ACCENT: '#10B981', 
  DANGER: '#FF5A5F', 
  NEUTRAL: '#4B5563',
  GOLD: '#F59E0B'
};

// Paleta expandida para 24 cores táticas (Referência: Estética INTVL/Mapbox)
export const TACTICAL_COLORS = [
  '#10B981', '#FF5A5F', '#3B82F6', '#FACC15', '#A855F7', '#9CA3AF', '#F97316', '#14B8A6',
  '#EC4899', '#06B6D4', '#84CC16', '#F43F5E', '#6366F1', '#D946EF', '#F59E0B', '#2DD4BF',
  '#FB7185', '#38BDF8', '#A3E635', '#C084FC', '#FB923C', '#4ADE80', '#22D3EE', '#818CF8'
];

export const BADGES = [
  { id: 'first_blood', name: 'First Blood', description: 'Neutralized an enemy sector', icon: 'Zap' },
  { id: 'landlord', name: 'Landlord', description: 'Claimed over 10,000m² in one run', icon: 'Home' },
  { id: 'saboteur', name: 'Elite Saboteur', description: 'Neutralized 20 enemy sectors', icon: 'Ghost' },
  { id: 'explorer', name: 'Vanguard', description: 'Traversed 5km total', icon: 'Navigation' },
  { id: 'citadel', name: 'Citadel King', description: 'Captured a Strategic Zone', icon: 'Landmark' }
];
