// 관리자 콘솔 전용 최소 셸 — 인증 상태에 따라 로그인 화면 또는 콘텐츠를 렌더링합니다
import { Outlet } from "react-router-dom";
import { useAdminAuth } from "./AdminAuthContext";
import { AdminLoginPage } from "./pages/AdminLoginPage";

export function AdminShell() {
  const { user, status, logout } = useAdminAuth();

  if (status === "loading") {
    return (
      <div className="gdp-app" data-theme="light">
        <div className="gdp-admin-loading" role="status" aria-live="polite">
          <span className="gdp-admin-spinner" aria-hidden="true" />
          세션 확인 중…
        </div>
      </div>
    );
  }

  if (status === "anon") {
    return (
      <div className="gdp-app" data-theme="light">
        <AdminLoginPage />
      </div>
    );
  }

  return (
    <div className="gdp-app" data-theme="light">
      <header className="gdp-admin-header">
        <span className="gdp-admin-header-title">금천 데이터플랫폼 관리자</span>
        <div className="gdp-admin-header-user">
          <span className="gdp-admin-header-loginid">{user?.loginId}</span>
          <span className="gdp-admin-header-roles">
            {user?.roles.map((r) => (
              <span key={r} className="gdp-admin-role-badge">
                {r}
              </span>
            ))}
          </span>
          <button
            type="button"
            className="gdp-admin-logout-btn"
            onClick={() => void logout()}
          >
            로그아웃
          </button>
        </div>
      </header>
      <main className="gdp-admin-main">
        <Outlet />
      </main>
    </div>
  );
}
