import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

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
    <div className="min-h-screen bg-page">
      <Sidebar />
      <div className="lg:pl-64">
        <Header />
        <main className="p-4 sm:p-6 lg:p-8 text-main">{children}</main>
      </div>
    </div>
  );
}
