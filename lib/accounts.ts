export type AccountsOptions = {
  enabled: boolean;
  showSignIn: boolean;
  allowSignup: boolean;
  requireSignIn: boolean;
  allowBuyAgain: boolean;
  allowCancel: boolean;
  allowReturn: boolean;
  returnDays: number;
  storeCredit: boolean;
};

export const defaultAccounts: AccountsOptions = {
  enabled: false,
  showSignIn: true,
  allowSignup: true,
  requireSignIn: false,
  allowBuyAgain: true,
  allowCancel: true,
  allowReturn: false,
  returnDays: 14,
  storeCredit: false,
};

export function readAccounts(raw: unknown): AccountsOptions {
  const o = raw && typeof raw === 'object' ? (raw as Partial<AccountsOptions>) : {};
  return { ...defaultAccounts, ...o };
}