// Shared constant only — kept separate from lib/auth.ts so proxy.ts doesn't
// have to pull in the Prisma client just to know the cookie name.
export const SESSION_COOKIE = "session";
