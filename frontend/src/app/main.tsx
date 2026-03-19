import React, { useEffect } from "react";
import Navbar from "@/components/ui/Navbar";
import Header from "@/components/ui/Header";
import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import LoginPage from "./login/page";

const Main = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Don't redirect if we're already on login/signup pages
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  useEffect(() => {
    const titleMap: Record<string, string> = {
      "/": "Dashboard",
      "/transactions": "Transactions",
      "/transactions/items": "Item Search",
      "/receipts": "Receipts",
      "/budgets": "Budgets",
      "/subscriptions": "Subscriptions",
      "/calendar": "Calendar",
      "/today": "Today",
      "/investments": "Investments",
      "/finance/accounts": "Accounts",
      "/notifications": "Notifications",
      "/login": "Login",
      "/signup": "Sign Up",
    };

    const base = "AetherDash";
    const page = titleMap[pathname] || pathname.split("/").filter(Boolean).map(p => p[0]?.toUpperCase() + p.slice(1)).join(" ") || "Dashboard";
    document.title = `${page} • ${base}`;
  }, [pathname]);

  // Show loading state while checking authentication
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // If not authenticated and not on auth pages, redirect to login
  if (!isAuthenticated && !isAuthPage) {
    router.push("/login");
    return <LoginPage />;
  }

  // If authenticated, show the main layout
  if (isAuthenticated) {
    return (
      <div className="flex flex-col z-10 bg-[#121212]">
        <Header />
        <Navbar />
        <main className="flex-1 text-white bg-[#121212] pb-24 md:pb-0">{children}</main>
      </div>
    );
  }

  // Fallback (shouldn't reach here)
  return null;
};

export default Main;
