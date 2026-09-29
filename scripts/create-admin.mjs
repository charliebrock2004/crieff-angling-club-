#!/usr/bin/env node
// Grants the admin role to an existing account.
//   DATABASE_URL=... npm run admin:create -- secretary@example.com
// The person must first sign up at /register and confirm their email.
import postgres from "postgres";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email || !process.env.DATABASE_URL) {
  console.error("Usage: DATABASE_URL=... npm run admin:create -- someone@example.com");
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
try {
  const rows = await sql`update public.profiles set role = 'admin' where email = ${email} returning id`;
  if (!rows.length) {
    console.error(`No account found for ${email}. Ask them to register at /register first.`);
    process.exitCode = 1;
  } else {
    await sql`insert into public.audit_logs (action, entity_type, entity_id, details) values ('user.role', 'profile', ${rows[0].id}, ${sql.json({ email, to: "admin", via: "cli" })})`;
    console.log(`${email} is now an admin.`);
  }
} finally {
  await sql.end();
}
