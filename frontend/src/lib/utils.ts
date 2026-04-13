import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const rawToDeg = (raw: number) =>
  Math.round(((raw - 2048) / 4095) * 360);
