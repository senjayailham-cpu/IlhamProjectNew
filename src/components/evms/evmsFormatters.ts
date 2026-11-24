import { CurrencyCode, ExchangeRates } from '../../types';
import { formatCompactCurrency, formatCurrency, DEFAULT_EXCHANGE_RATES } from '../../utils/costEngine';
import { EvmsHealthStatus, EvmsUnitMode } from '../../utils/evmsEngine';

export function formatEvmsValue(
  val: number,
  unitMode: EvmsUnitMode,
  currency: CurrencyCode = 'IDR',
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES,
  compact = false
): string {
  if (unitMode === 'hours') {
    const rounded = Math.round(val * 10) / 10;
    return `${rounded.toLocaleString('id-ID')} Jam`;
  }
  return compact
    ? formatCompactCurrency(val, currency, rates)
    : formatCurrency(val, currency, rates);
}

export function formatEvmsDelta(
  val: number,
  unitMode: EvmsUnitMode,
  currency: CurrencyCode = 'IDR',
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES,
  compact = true
): string {
  const prefix = val > 0 ? '+' : val < 0 ? '-' : '';
  const abs = Math.abs(val);
  if (unitMode === 'hours') {
    const rounded = Math.round(abs * 10) / 10;
    return `${prefix}${rounded.toLocaleString('id-ID')} Jam`;
  }
  const formatted = compact
    ? formatCompactCurrency(abs, currency, rates)
    : formatCurrency(abs, currency, rates);
  return `${prefix}${formatted}`;
}

export function getIndexStatusMeta(val: number): {
  label: string;
  textClass: string;
  bgClass: string;
} {
  if (val >= 1.0) {
    return {
      label: 'Optimal',
      textClass: 'text-base-green',
      bgClass: 'bg-base-green-dim',
    };
  }
  if (val >= 0.9) {
    return {
      label: 'Waspada',
      textClass: 'text-base-accent',
      bgClass: 'bg-base-accent-dim',
    };
  }
  return {
    label: 'Kritis',
    textClass: 'text-base-red',
    bgClass: 'bg-base-red-dim',
  };
}

export function getHealthBadgeStyle(status: EvmsHealthStatus): {
  textClass: string;
  bgClass: string;
  dotColor: string;
} {
  switch (status) {
    case 'optimal':
      return {
        textClass: 'text-base-green',
        bgClass: 'bg-base-green-dim',
        dotColor: '#16a34a',
      };
    case 'efficient_behind':
      return {
        textClass: 'text-base-accent',
        bgClass: 'bg-base-accent-dim',
        dotColor: '#d97706',
      };
    case 'overbudget_ahead':
      return {
        textClass: 'text-base-blue',
        bgClass: 'bg-base-blue-dim',
        dotColor: '#2563eb',
      };
    case 'critical':
      return {
        textClass: 'text-base-red',
        bgClass: 'bg-base-red-dim',
        dotColor: '#dc2626',
      };
    default:
      return {
        textClass: 'text-base-muted',
        bgClass: 'bg-base-surface3',
        dotColor: '#64748b',
      };
  }
}
