import { redirect } from "next/navigation";
import { getBoSession } from "@/lib/bo-auth";
import { BoLoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function BoLoginPage() {
  const session = await getBoSession();
  if (session) redirect("/");
  return <BoLoginForm />;
}
