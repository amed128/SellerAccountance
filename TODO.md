# Backlog

Left-aside items, roughly in priority order.

- **Password reset**: no way to recover an account after a forgotten password — a hard lockout for a real user. Needs a transactional email service (e.g. [Resend](https://resend.com), free tier). Blocked on picking a provider.
- **E-mail verification on signup**: less urgent than password reset (doesn't lock anyone out), but should land before a real public launch. Depends on the same email service.
- **Verify the production auth flow end-to-end**: signup/login/logout and a real upload were only tested against a local Postgres during development, never against the live Neon database on Vercel. Worth a manual pass (sign up, upload a report, check the overview page) to confirm nothing environment-specific broke.
- **Isolated preview database branches**: Preview deployments currently share the same Neon database as Production (chose the simple option when connecting the integration). Revisit enabling per-deployment Neon branches for Preview once things stabilize, so PR previews don't touch production data.
