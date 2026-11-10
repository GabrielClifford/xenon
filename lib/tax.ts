export type TaxSettings = {
  enabled: boolean;
  rate: number;
  label: string;
  inclusive: boolean;
  taxShipping: boolean;
  vatNumber: string;
};

export const defaultTax: TaxSettings = {
  enabled: false,
  rate: 7.5,
  label: 'VAT',
  inclusive: false,
  taxShipping: false,
  vatNumber: '',
};

export function readTax(raw: unknown): TaxSettings {
  const o = raw && typeof raw === 'object' ? (raw as Partial<TaxSettings>) : {};
  const merged = { ...defaultTax, ...o };
  return { ...merged, rate: Number(merged.rate) || 0 };
}