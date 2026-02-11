import React from "react";
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
        <main className="flex-1 text-white bg-[#121212] ">{children}</main>
      </div>
    );
  }

  // Fallback (shouldn't reach here)
  return null;
};

export default Main;
