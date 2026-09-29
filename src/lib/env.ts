import "server-only";

/**
 * Server-side environment access. Never import this from client components.
 * Optional integrations (Stripe, Resend, Supabase storage) return null when not
 * configured so callers can show a clear "not configured" error instead of
 * pretending to work.
 */
function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export function requireEnv(name: string): string {
  const v = read(name);
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

export const env = {
  get databaseUrl() {
    return requireEnv("DATABASE_URL");
  },
  get siteUrl() {
    return (read("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get supabaseUrl() {
    return read("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return read("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get supabaseServiceRoleKey() {
    return read("SUPABASE_SERVICE_ROLE_KEY");
  },
  get stripeSecretKey() {
    return read("STRIPE_SECRET_KEY");
  },
  get stripeWebhookSecret() {
    return read("STRIPE_WEBHOOK_SECRET");
  },
  get resendApiKey() {
    return read("RESEND_API_KEY");
  },
  get emailFrom() {
    return read("EMAIL_FROM") ?? "Crieff Angling Club <permits@crieffanglingclub.org.uk>";
  },
  get emailReplyTo() {
    return read("EMAIL_REPLY_TO");
  },
  get adminNotificationEmail() {
    return read("ADMIN_NOTIFICATION_EMAIL");
  },
  get ipHashSalt() {
    return read("IP_HASH_SALT") ?? "crieff-angling-club";
  },
};

export const isProduction = process.env.NODE_ENV === "production";
