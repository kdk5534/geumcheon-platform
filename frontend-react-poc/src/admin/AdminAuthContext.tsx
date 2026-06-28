// 관리자 세션 인증 상태를 React Context로 관리 — 로그인·로그아웃·세션 복원을 제공합니다
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  getAdminSession,
  loadAdminCsrfToken,
  loginAdminSession,
  logoutAdminSession,
} from "./adminApi";
import type { AdminSessionUser } from "./adminApi";

type AuthStatus = "loading" | "authed" | "anon";

interface AdminAuthState {
  user: AdminSessionUser | null;
  status: AuthStatus;
  /** 세션 복원 실패(네트워크 오류 등) 메시지. 401은 null. */
  error: string | null;
  login: (loginId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminSessionUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  // 마운트 시 기존 세션 복원 시도
  useEffect(() => {
    getAdminSession()
      .then((payload) => {
        setUser(payload.data);
        setStatus("authed");
        // 세션 복원 성공 후 CSRF 토큰 사전 로드
        loadAdminCsrfToken().catch(() => {
          /* 첫 변경 요청 시 재시도 */
        });
      })
      .catch((err: unknown) => {
        const httpStatus = (err as { status?: number }).status;
        setStatus("anon");
        // 401은 정상 미인증, 그 외는 연결 오류 안내
        if (httpStatus !== 401 && httpStatus !== undefined) {
          setError("서버에 연결할 수 없습니다.");
        }
      });
  }, []);

  const login = useCallback(async (loginId: string, password: string) => {
    setError(null);
    const payload = await loginAdminSession(loginId, password);
    setUser(payload.data);
    setStatus("authed");
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutAdminSession();
    } finally {
      setUser(null);
      setStatus("anon");
    }
  }, []);

  return (
    <AdminAuthContext.Provider value={{ user, status, error, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthState {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth는 AdminAuthProvider 안에서만 사용할 수 있습니다.");
  return ctx;
}
