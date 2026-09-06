"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#FF6600] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) return null;

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
