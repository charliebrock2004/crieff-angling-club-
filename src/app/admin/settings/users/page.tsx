import type { Metadata } from "next";
import { sql } from "@/lib/db";
import { setUserRole } from "@/lib/admin/misc-actions";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminForm } from "@/components/admin/admin-form";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Users & roles" };

export default async function UsersPage() {
  const staff = await sql`select email, full_name, role, created_at from public.profiles where role <> 'angler' order by role, email`;
  return (
    <>
      <AdminPageHeader back={{ href: "/admin/settings", label: "Settings" }} title="Users & roles" description="Admins can use this dashboard. Bailiffs can see full permit details when checking permits, and the daily permit list. Everyone else is a regular angler." />
      <div className="card overflow-x-auto">
        <table className="table-club">
          <thead><tr><th>Email</th><th>Name</th><th>Role</th></tr></thead>
          <tbody>{staff.map((s) => <tr key={s.email}><td>{s.email}</td><td>{s.full_name ?? "—"}</td><td><Badge tone={s.role === "admin" ? "dark" : "info"}>{s.role}</Badge></td></tr>)}</tbody>
        </table>
      </div>
      <h2 className="mt-10 font-display text-2xl">Change someone&rsquo;s role</h2>
      <AdminForm action={setUserRole} submitLabel="Update role" resetOnSuccess>
        <div className="card mt-4 grid gap-4 p-5 sm:grid-cols-2">
          <div><label htmlFor="email" className="field-label">Their account email</label><input id="email" name="email" type="email" required className="input" /></div>
          <div><label htmlFor="role" className="field-label">Role</label><select id="role" name="role" className="input"><option value="admin">Admin</option><option value="bailiff">Bailiff</option><option value="angler">Regular user (remove access)</option></select></div>
          <p className="text-sm text-stone sm:col-span-2">The person must first create an account at /register with this email.</p>
        </div>
      </AdminForm>
    </>
  );
}
