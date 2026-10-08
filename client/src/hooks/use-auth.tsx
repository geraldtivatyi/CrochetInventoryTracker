import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface AuthUser {
  id: number;
  email: string;
  otpEnabled: boolean;
  isOwner: boolean;
}

interface MeResponse {
  user: AuthUser | null;
  needsSetup: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  needsSetup: boolean;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Server errors arrive as "<status>: {"message": "..."}"; extract the message
export function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const json = raw.replace(/^\d+:\s*/, "");
  try {
    return JSON.parse(json).message ?? json;
  } catch {
    return json;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<MeResponse>({ queryKey: ["/api/auth/me"] });

  const setUser = (user: AuthUser | null) => {
    queryClient.setQueryData<MeResponse>(["/api/auth/me"], { user, needsSetup: false });
  };

  const logout = async () => {
    await apiRequest("POST", "/api/auth/logout");
    queryClient.clear();
    queryClient.setQueryData<MeResponse>(["/api/auth/me"], { user: null, needsSetup: false });
  };

  return (
    <AuthContext.Provider
      value={{ user: data?.user ?? null, needsSetup: data?.needsSetup ?? false, isLoading, setUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
