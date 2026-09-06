"use client";

import { useSession } from "next-auth/react";
import { User } from "lucide-react";

export default function Header() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-30 nav-blur border-b border-card px-6 py-3">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-main">{session?.user?.name || "Admin"}</p>
            <p className="text-xs text-muted">{session?.user?.email}</p>
          </div>
          <div className="w-9 h-9 bg-accent-soft rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-accent" />
          </div>
        </div>
      </div>
    </header>
  );
}