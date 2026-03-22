import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="pl-[var(--sidebar-width)] transition-all duration-300">
        <Header
          user={{
            name: session.user.name,
            email: session.user.email,
            role: session.user.role,
            organizationSlug: session.user.organizationSlug,
          }}
        />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
