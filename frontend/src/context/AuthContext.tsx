import validateToken from "@/lib/authUtils";
import { jwtDecode } from "jwt-decode";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";

interface Tokens {
  access: string;
  refresh: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  userData: any;
  login: (data: Tokens) => void;
  logout: () => void;
  loading: boolean;
  tokens: Tokens | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userData, setUserData] = useState<any>(null);
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const router = useRouter();

  const applyTokens = (data: Tokens, options?: { redirect?: boolean }) => {
    setIsAuthenticated(true);
    setUserData(jwtDecode(data.access));
    setTokens(data);
    localStorage.setItem("authTokens", JSON.stringify(data));
    if (options?.redirect !== false) {
      router.push("/");
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const storedTokens = localStorage.getItem("authTokens");
      const parsedTokens: Tokens | null = storedTokens
        ? JSON.parse(storedTokens)
        : null;

      if (parsedTokens && validateToken(parsedTokens.access)) {
        setIsAuthenticated(true);
        setTokens(parsedTokens);
        setUserData(jwtDecode(parsedTokens.access));
      } else if (parsedTokens) {
        await refreshToken();
      }

      setLoading(false);
    };

    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!tokens?.access) {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      return;
    }

    const decoded = jwtDecode(tokens.access) as { exp?: number };
    if (!decoded.exp) {
      return;
    }

    const expiresAt = decoded.exp * 1000;
    const refreshAt = Math.max(expiresAt - 60_000, Date.now() + 5_000);

    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      refreshToken();
    }, refreshAt - Date.now());

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [tokens]);

  const login = (data: Tokens) => {
    applyTokens(data, { redirect: true });
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUserData(null);
    setTokens(null);
    localStorage.removeItem("authTokens");
    router.push("/login");
  };

  const refreshToken = async () => {
    try {
      const storedTokens = localStorage.getItem("authTokens");
      const parsedTokens: Tokens | null = storedTokens
        ? JSON.parse(storedTokens)
        : null;

      if (!parsedTokens || !parsedTokens.refresh) {
        logout();
        return;
      }

      const response = await fetch(
        "http://localhost:8000/auth/token/refresh/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh: parsedTokens.refresh }),
        }
      );

      if (!response.ok) {
        logout();
        return;
      }

      const data = (await response.json()) as Partial<Tokens>;
      const mergedTokens = {
        access: data.access || parsedTokens.access,
        refresh: data.refresh || parsedTokens.refresh,
      } as Tokens;
      applyTokens(mergedTokens, { redirect: false });
    } catch (error) {
      console.error("Error refreshing token:", error);
      logout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        userData,
        login,
        logout,
        loading,
        tokens,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for using the AuthContext
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
