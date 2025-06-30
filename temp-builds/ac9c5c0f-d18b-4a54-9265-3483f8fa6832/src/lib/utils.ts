import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines Tailwind classes conditionally and resolves conflicts.
 * Example: `cn("px-2", isActive && "bg-blue-500")`
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
