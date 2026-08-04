import { OrgSettings } from '../types';

export function normalizePosition(pos?: string, tradePositions?: OrgSettings['tradePositions']): string {
  if (!pos) return 'Other';
  const p = pos.toLowerCase();

  if (tradePositions && tradePositions.length > 0) {
    for (const trade of tradePositions) {
      if (p.includes(trade.key.toLowerCase()) || p.includes(trade.label.toLowerCase())) {
        return trade.label;
      }
    }
  }

  if (p.includes('welder'))     return 'Welder';
  if (p.includes('fitter'))     return 'Fitter';
  if (p.includes('grinder'))    return 'Grinder';
  if (p.includes('supervisor')) return 'Supervisor';
  if (p.includes('engineer'))   return 'Engineer';
  if (p.includes('hse'))        return 'HSE';
  if (p.includes('installer') || p.includes('e&i')) return 'Installer';
  if (p.includes('tech'))       return 'Tech';
  if (p.includes('painter'))    return 'Painter';
  if (p.includes('rigger'))     return 'Rigger';
  if (p.includes('inspector') || p.includes('qc')) return 'QC Inspector';
  if (p.includes('helper'))     return 'Helper';
  if (p.includes('admin'))      return 'Admin';
  return pos.split(' ')[0] || 'Other';
}

export function getCraftColor(position: string, tradePositions?: OrgSettings['tradePositions']): string {
  const normalized = normalizePosition(position, tradePositions);
  if (tradePositions) {
    const found = tradePositions.find(t => t.label.toLowerCase() === normalized.toLowerCase() || t.key.toLowerCase() === normalized.toLowerCase());
    if (found?.color) return found.color;
  }
  return CRAFT_COLORS[normalized] || 'var(--muted)';
}

export const CRAFT_COLORS: Record<string, string> = {
  Welder:        'var(--accent)',
  Fitter:        '#2c6eb3',
  Grinder:       'var(--green)',
  Supervisor:    '#8b5cf6',
  Engineer:      '#0d9488',
  HSE:           'var(--red)',
  Installer:     '#f59e0b',
  Tech:          '#6366f1',
  Painter:       '#ec4899',
  Rigger:        '#84cc16',
  'QC Inspector':'#06b6d4',
  Helper:        '#94a3b8',
  Admin:         'var(--muted)',
  Other:         'var(--muted)',
};
