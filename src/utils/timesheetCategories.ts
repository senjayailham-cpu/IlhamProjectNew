export type StandardPosition = 'Welder' | 'Fitter' | 'Grinder' | 'Coordinator' | 'Others';

export const POSITION_CATEGORIES: Record<StandardPosition, string[]> = {
  Welder: ['Hot Pass', 'Root Pass', 'Capping', 'Cleaning', 'Others'],
  Fitter: ['Fit-Up', 'Cleaning', 'Others'],
  Grinder: ['Cleaning', 'Others'],
  Coordinator: ['Monitoring', 'Others'],
  Others: ['Cleaning', 'Monitoring', 'Others']
};

/**
 * Detects the standard position group based on employee position string.
 */
export function detectPositionGroup(position?: string): StandardPosition {
  const p = (position || '').toLowerCase().trim();
  if (p.includes('weld')) return 'Welder';
  if (p.includes('fit')) return 'Fitter';
  if (p.includes('grind')) return 'Grinder';
  if (p.includes('coord')) return 'Coordinator';
  return 'Others';
}

/**
 * Returns available job categories for a given position string.
 */
export function getCategoriesForPosition(position?: string): string[] {
  const group = detectPositionGroup(position);
  return POSITION_CATEGORIES[group] || POSITION_CATEGORIES.Others;
}

/**
 * Returns the default job category for a given position string.
 */
export function getDefaultCategoryForPosition(position?: string): string {
  const group = detectPositionGroup(position);
  switch (group) {
    case 'Welder': return 'Root Pass';
    case 'Fitter': return 'Fit-Up';
    case 'Grinder': return 'Cleaning';
    case 'Coordinator': return 'Monitoring';
    default: return 'Others';
  }
}

/**
 * Return styling classes for category badges.
 */
export function getCategoryBadgeClass(category?: string): string {
  switch (category) {
    case 'Hot Pass':
      return 'bg-amber-500/15 text-amber-500 border border-amber-500/30';
    case 'Root Pass':
      return 'bg-rose-500/15 text-rose-500 border border-rose-500/30';
    case 'Capping':
      return 'bg-cyan-500/15 text-cyan-500 border border-cyan-500/30';
    case 'Fit-Up':
      return 'bg-indigo-500/15 text-indigo-500 border border-indigo-500/30';
    case 'Cleaning':
      return 'bg-teal-500/15 text-teal-500 border border-teal-500/30';
    case 'Monitoring':
      return 'bg-sky-500/15 text-sky-500 border border-sky-500/30';
    case 'Others':
    default:
      return 'bg-slate-500/15 text-slate-400 border border-slate-500/30';
  }
}
