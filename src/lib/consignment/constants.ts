export const TRANSACTION_TYPES = {
  SHIPMENT: 'SHIPMENT',
  SALE: 'SALE',
  PAYMENT: 'PAYMENT',
  PIUTANG_MANUAL: 'PIUTANG_MANUAL',
  ADJUSTMENT: 'ADJUSTMENT',
  RETURN: 'RETURN',
  // Legacy types
  BILLING: 'BILLING',
  PIUTANG: 'PIUTANG',
  PELUNASAN: 'PELUNASAN',
} as const;

export type TransactionType = keyof typeof TRANSACTION_TYPES | string;

export const BREAKDOWN_STATUS = {
  COMPLETE: 'COMPLETE',
  PENDING: 'PENDING',
  ESTIMATED: 'ESTIMATED',
} as const;

export type BreakdownStatus = keyof typeof BREAKDOWN_STATUS;

export const OPNAME_STATUS = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type OpnameStatus = keyof typeof OPNAME_STATUS;

