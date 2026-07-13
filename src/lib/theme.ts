import { cookies } from "next/headers";

export type Theme = "system" | "light" | "dark";
export const THEME_COOKIE = "theme";

export async function getTheme(): Promise<Theme> {
  const store = await cookies();
  const v = store.get(THEME_COOKIE)?.value;
  return v === "light" || v === "dark" ? v : "system";
}
