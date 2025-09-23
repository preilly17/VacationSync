/**
 * Enhanced payment app integration utilities
 * Supports both username and phone number-based payments
 */

export interface PaymentUser {
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  cashAppUsername?: string | null;
  cashAppUsernameLegacy?: string | null;
  cashAppPhone?: string | null;
  cashAppPhoneLegacy?: string | null;
  venmoUsername?: string | null;
  venmoPhone?: string | null;
}

/**
 * Formats a phone number for payment app URLs
 * Removes non-digit characters and ensures proper format
 */
export function formatPhoneForPayment(phone: string): string {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // If it starts with 1, keep it; otherwise add 1 for US numbers
  if (digitsOnly.length === 10) {
    return `1${digitsOnly}`;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return digitsOnly;
  }
  
  // Return as-is if format is unexpected
  return digitsOnly;
}

/**
 * Generate CashApp payment URL
 * Prioritizes phone number over username for more direct integration
 */
export function generateCashAppUrl(user: PaymentUser, amount: string): string | null {
  // Try phone number first (more direct integration)
  const cashAppPhone = user.cashAppPhone || user.cashAppPhoneLegacy;
  if (cashAppPhone || user.phoneNumber) {
    const phone = formatPhoneForPayment(cashAppPhone || user.phoneNumber!);
    return `https://cash.app/$${phone}/${amount}`;
  }

  // Fallback to username
  const cashAppUsername = user.cashAppUsername || user.cashAppUsernameLegacy;
  if (cashAppUsername) {
    return `https://cash.app/$${cashAppUsername}/${amount}`;
  }

  return null;
}

/**
 * Generate Venmo payment URL
 * Prioritizes phone number over username for more direct integration
 */
export function generateVenmoUrl(user: PaymentUser, amount: string, note?: string): string | null {
  const baseParams = `txn=pay&amount=${amount}`;
  const noteParam = note ? `&note=${encodeURIComponent(note)}` : '';
  
  // Try phone number first (more direct integration)
  if (user.venmoPhone || user.phoneNumber) {
    const phone = formatPhoneForPayment(user.venmoPhone || user.phoneNumber!);
    return `https://venmo.com/u/${phone}?${baseParams}${noteParam}`;
  }
  
  // Fallback to username
  if (user.venmoUsername) {
    return `https://venmo.com/${user.venmoUsername}?${baseParams}${noteParam}`;
  }
  
  return null;
}

/**
 * Check if user has any payment methods available
 */
export function hasPaymentMethods(user: PaymentUser): boolean {
  return !!(
    user.cashAppUsername ||
    user.cashAppUsernameLegacy ||
    user.cashAppPhone ||
    user.cashAppPhoneLegacy ||
    user.venmoUsername ||
    user.venmoPhone ||
    user.phoneNumber
  );
}

/**
 * Get available payment methods for display
 */
export function getAvailablePaymentMethods(user: PaymentUser): string[] {
  const methods: string[] = [];

  if (
    user.cashAppUsername ||
    user.cashAppUsernameLegacy ||
    user.cashAppPhone ||
    user.cashAppPhoneLegacy ||
    user.phoneNumber
  ) {
    methods.push('CashApp');
  }
  
  if (user.venmoUsername || user.venmoPhone || user.phoneNumber) {
    methods.push('Venmo');
  }
  
  return methods;
}

/**
 * Generate payment note for expense splitting
 */
export function generatePaymentNote(expenseName: string, tripName?: string): string {
  const baseNote = `Trip expense: ${expenseName}`;
  if (tripName) {
    return `${baseNote} (${tripName})`;
  }
  return baseNote;
}