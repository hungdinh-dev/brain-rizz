import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Gộp class Tailwind: bỏ giá trị falsy, class sau đè class trước (vd. `px-5` + `px-2` → `px-2`). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
