import React, { useState } from 'react';
import { useAppStore } from '../store';
import { CurrencyCode, ExchangeRates } from '../types';
import { CURRENCY_SYMBOLS, DEFAULT_EXCHANGE_RATES } from '../utils/costEngine';
import { DollarSign, Settings, Check, X, RotateCcw, Globe } from 'lucide-react';

interface CurrencySelectorProps {
  className?: string;
  showRateSettings?: boolean;
}

export function CurrencySelector({
  className = '',
  showRateSettings = true,
}: CurrencySelectorProps) {
  const currency = useAppStore((s) => s.currency);
  const setCurrency = useAppStore((s) => s.setCurrency);
  const exchangeRates = useAppStore((s) => s.exchangeRates);
  const setExchangeRates = useAppStore((s) => s.setExchangeRates);

  const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);
  const [usdRateInput, setUsdRateInput] = useState<string>(String(exchangeRates?.USD || 16000));
  const [audRateInput, setAudRateInput] = useState<string>(String(exchangeRates?.AUD || 10500));

  const currencies: { code: CurrencyCode; label: string; symbol: string }[] = [
    { code: 'IDR', label: 'IDR', symbol: 'Rp' },
    { code: 'USD', label: 'USD', symbol: '$' },
    { code: 'AUD', label: 'AUD', symbol: 'A$' },
  ];

  const handleOpenRates = () => {
    setUsdRateInput(String(exchangeRates?.USD || 16000));
    setAudRateInput(String(exchangeRates?.AUD || 10500));
    setIsRatesModalOpen(true);
  };

  const handleSaveRates = () => {
    const usd = parseFloat(usdRateInput) || 16000;
    const aud = parseFloat(audRateInput) || 10500;
    setExchangeRates({
      IDR: 1,
      USD: usd > 0 ? usd : 16000,
      AUD: aud > 0 ? aud : 10500,
    });
    setIsRatesModalOpen(false);
  };

  const handleResetRates = () => {
    setExchangeRates(DEFAULT_EXCHANGE_RATES);
    setUsdRateInput(String(DEFAULT_EXCHANGE_RATES.USD));
    setAudRateInput(String(DEFAULT_EXCHANGE_RATES.AUD));
  };

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {/* Segmented Pill Selector */}
      <div className="inline-flex items-center bg-base-surface border border-base-border rounded-xl p-0.5 shadow-2xs select-none">
        {currencies.map((curr) => {
          const isActive = currency === curr.code;
          return (
            <button
              key={curr.code}
              type="button"
              onClick={() => setCurrency(curr.code)}
              className={`px-2.5 py-1 rounded-lg text-xs font-condensed font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer flex items-center gap-1 ${
                isActive
                  ? 'bg-base-accent text-white font-black shadow-xs'
                  : 'text-base-muted hover:text-base-text hover:bg-base-surface2'
              }`}
              title={`Switch currency view to ${curr.label} (${curr.symbol})`}
            >
              <span className="font-mono opacity-80">{curr.symbol}</span>
              <span>{curr.label}</span>
            </button>
          );
        })}
      </div>

      {/* Exchange Rate Config Button */}
      {showRateSettings && (
        <div className="relative">
          <button
            type="button"
            onClick={handleOpenRates}
            className="p-1.5 rounded-lg text-base-muted hover:text-base-text hover:bg-base-surface2 border border-transparent hover:border-base-border transition-colors cursor-pointer"
            title={`Kurs Valuta Asing (1 USD = Rp ${exchangeRates?.USD?.toLocaleString('id-ID') || '16.000'}, 1 AUD = Rp ${exchangeRates?.AUD?.toLocaleString('id-ID') || '10.500'})`}
          >
            <Settings className="h-3.5 w-3.5" />
          </button>

          {/* Rates Settings Modal / Popover */}
          {isRatesModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
              <div 
                className="bg-base-surface border border-base-border rounded-2xl p-5 shadow-2xl w-full max-w-sm space-y-4 animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-base-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-base-accent" />
                    <h3 className="font-condensed font-bold text-sm uppercase tracking-wider text-base-text">
                      Pengaturan Kurs Valuta (Exchange Rates)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRatesModalOpen(false)}
                    className="p-1 text-base-muted hover:text-base-text rounded-lg hover:bg-base-surface2 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <p className="text-[11px] text-base-muted leading-relaxed">
                  Semua transaksi internal tercatat dalam Rupiah (IDR). Sistem mengonversi tampilan ke USD / AUD secara otomatis berdasarkan kurs acuan di bawah ini:
                </p>

                <div className="space-y-3 font-sans text-xs">
                  {/* USD Rate Input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted flex items-center justify-between">
                      <span>1 US Dollar (USD $) =</span>
                      <span className="font-mono text-base-accent">Rp IDR</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-base-muted font-mono">Rp</span>
                      <input
                        type="number"
                        min="1"
                        step="100"
                        value={usdRateInput}
                        onChange={(e) => setUsdRateInput(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-base-surface2 border border-base-border rounded-xl text-xs font-mono font-bold text-base-text outline-none focus:ring-1 focus:ring-base-accent"
                        placeholder="16000"
                      />
                    </div>
                  </div>

                  {/* AUD Rate Input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted flex items-center justify-between">
                      <span>1 Australian Dollar (AUD A$) =</span>
                      <span className="font-mono text-base-accent">Rp IDR</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-base-muted font-mono">Rp</span>
                      <input
                        type="number"
                        min="1"
                        step="100"
                        value={audRateInput}
                        onChange={(e) => setAudRateInput(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-base-surface2 border border-base-border rounded-xl text-xs font-mono font-bold text-base-text outline-none focus:ring-1 focus:ring-base-accent"
                        placeholder="10500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-base-border/60">
                  <button
                    type="button"
                    onClick={handleResetRates}
                    className="flex items-center gap-1 text-[11px] text-base-muted hover:text-base-text cursor-pointer transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset Default</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsRatesModalOpen(false)}
                      className="px-3 py-1.5 border border-base-border rounded-lg text-xs font-bold font-condensed uppercase tracking-wider hover:bg-base-surface2 cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveRates}
                      className="px-4 py-1.5 bg-base-accent text-white rounded-lg text-xs font-bold font-condensed uppercase tracking-wider hover:opacity-90 cursor-pointer shadow-xs"
                    >
                      Simpan Kurs
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CurrencySelector;
