export const THEME_STORAGE_KEY = "haliya-theme";

export type Theme = "light" | "dark";

export function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}
