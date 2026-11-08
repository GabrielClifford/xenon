export type FieldMode = 'off' | 'optional' | 'required';
export type OptIn = 'off' | 'show' | 'checked';

export type CheckoutOptions = {
  email: FieldMode;
  nameMode: 'single' | 'first_last';
  company: FieldMode;
  address2: FieldMode;
  altPhone: FieldMode;
  optEmail: OptIn;
  optEmailLabel: string;
  optSms: OptIn;
  optWhatsapp: OptIn;
  tipping: boolean;
  maxQty: number;
  ageCheck: boolean;
  buttonText: string;
  trackOrders: boolean;
};

export const defaultOptions: CheckoutOptions = {
  email: 'off',
  nameMode: 'single',
  company: 'off',
  address2: 'off',
  altPhone: 'off',
  optEmail: 'off',
  optEmailLabel: 'Email me with news and offers',
  optSms: 'off',
  optWhatsapp: 'off',
  tipping: false,
  maxQty: 20,
  ageCheck: false,
  buttonText: 'Place order',
  trackOrders: true,
};

export function readOptions(raw: unknown): CheckoutOptions {
  const o = raw && typeof raw === 'object' ? (raw as Partial<CheckoutOptions>) : {};
  return { ...defaultOptions, ...o };
}