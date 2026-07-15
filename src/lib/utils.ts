import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(val: number) {
  const isNegative = val < 0;
  const absVal = Math.abs(val);
  const formatted = Math.round(absVal).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (isNegative ? '-Rp ' : 'Rp ') + formatted;
}
