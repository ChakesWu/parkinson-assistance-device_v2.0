import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * A utility function to conditionally join class names.
 * Requires `clsx` and `tailwind-merge` to be installed.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}