/**
 * Multi-Currency Conversion Engine
 *
 * Supports: AED, SAR, BHD, KWD, PKR
 * All rates are relative to AED (base currency).
 *
 * In production, these would be fetched from a live FX API.
 */

export interface ExchangeRates {
  [currency: string]: number; // rate to convert 1 unit of currency to AED
}

// Static rates (updated periodically in production)
const RATES_TO_AED: ExchangeRates = {
  AED: 1.0,
  SAR: 0.98,       // 1 SAR ≈ 0.98 AED
  BHD: 9.74,       // 1 BHD ≈ 9.74 AED
  KWD: 11.95,      // 1 KWD ≈ 11.95 AED
  PKR: 0.013,      // 1 PKR ≈ 0.013 AED
  USD: 3.67,       // 1 USD ≈ 3.67 AED
  EUR: 3.98,       // 1 EUR ≈ 3.98 AED
  GBP: 4.64,       // 1 GBP ≈ 4.64 AED
};

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
): number {
  const fromRate = RATES_TO_AED[fromCurrency];
  const toRate = RATES_TO_AED[toCurrency];

  if (!fromRate || !toRate) {
    throw new Error(`Unsupported currency: ${fromCurrency} or ${toCurrency}`);
  }

  // Convert to AED first, then to target
  const amountInAed = amount * fromRate;
  return amountInAed / toRate;
}

export function convertToAed(amount: number, currency: string): number {
  return convertCurrency(amount, currency, 'AED');
}

export function formatCurrencyAmount(
  amount: number,
  currency: string,
): string {
  const symbols: Record<string, string> = {
    AED: 'AED',
    SAR: 'SAR',
    BHD: 'BHD',
    KWD: 'KWD',
    PKR: 'PKR',
    USD: '$',
    EUR: '€',
    GBP: '£',
  };

  const decimals = ['BHD', 'KWD'].includes(currency) ? 3 : 2;
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `${symbols[currency] || currency} ${formatted}`;
}

export function getSupportedCurrencies(): string[] {
  return Object.keys(RATES_TO_AED);
}

export function getExchangeRate(from: string, to: string): number {
  const fromRate = RATES_TO_AED[from];
  const toRate = RATES_TO_AED[to];
  if (!fromRate || !toRate) throw new Error(`Unsupported currency pair`);
  return fromRate / toRate;
}

export { RATES_TO_AED };
