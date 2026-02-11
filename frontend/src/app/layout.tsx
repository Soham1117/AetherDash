"use client";
import { usePathname } from "next/navigation";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/components/ui/themeProvider";
import LoginPage from "@/app/login/page";
import "@/app/globals.css";
import Main from "./main";
import { AccountProvider } from "@/context/AccountContext";
import { TransactionProvider } from "@/context/TransactionContext";
import { TimeProvider } from "@/context/TimeContext";
import { BudgetProvider } from "@/context/BudgetContext";
import { DashboardProvider } from "@/context/DashboardContext";
import { CategoryProvider } from "@/context/CategoryContext";
import { Provider } from "react-redux";
import { store } from "@/app/redux/store";
import SigupPage from "./signup/page";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  let whichPage = "";
  if (pathname === "/login") {
    whichPage = "/login";
  } else if (pathname === "/signup") {
    whichPage = "/signup";
  } else {
    whichPage = "/";
  }

  // For login/signup pages, only wrap with AuthProvider and ThemeProvider
  // For other pages, wrap with all providers
  const isAuthPage = whichPage === "/login" || whichPage === "/signup";

  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {isAuthPage ? (
              <>
                {whichPage === "/login" && <LoginPage />}
                {whichPage === "/signup" && <SigupPage />}
              </>
            ) : (
              <TimeProvider>
                <AccountProvider>
                  <TransactionProvider>
                    <BudgetProvider>
                      <CategoryProvider>
                        <DashboardProvider>
                          <Provider store={store}>
                            <Main>{children}</Main>
                          </Provider>
                        </DashboardProvider>
                      </CategoryProvider>
                    </BudgetProvider>
                  </TransactionProvider>
                </AccountProvider>
              </TimeProvider>
            )}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
