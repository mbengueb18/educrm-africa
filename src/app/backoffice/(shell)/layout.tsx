import { redirect } from "next/navigation";
import { getBoSession } from "@/lib/bo-auth";
import { BoShell } from "./bo-shell";

export const dynamic = "force-dynamic";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const session = await getBoSession();
  if (!session) redirect("/login");
  return <BoShell name={session.name} role={session.role}>{children}</BoShell>;
}
