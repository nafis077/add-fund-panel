import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <div className="hidden md:block">
        <Sidebar user={session} />
      </div>
      <div className="flex min-h-screen flex-1 flex-col">
        <div className="border-b border-white/10 p-4 md:hidden">
          <Sidebar user={session} />
        </div>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
