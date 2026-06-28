// 관리자 로그인 폼 — 세션 인증을 통해 관리자 콘솔에 진입합니다
import { useState } from "react";
import type { FormEvent } from "react";
import { useAdminAuth } from "../AdminAuthContext";

export function AdminLoginPage() {
  const { login, error: ctxError } = useAdminAuth();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!loginId.trim() || !password) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await login(loginId.trim(), password);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 401) {
        setFormError("관리자 ID 또는 비밀번호를 확인해 주세요.");
      } else if (status === 429) {
        setFormError("로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.");
      } else {
        setFormError("서버에 연결할 수 없습니다. 백엔드 서버 상태를 확인해 주세요.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const displayError = formError ?? ctxError;

  return (
    <div className="gdp-admin-login-wrap">
      <form
        id="admin-login-form"
        className="gdp-admin-login-card"
        onSubmit={(e) => void handleSubmit(e)}
        noValidate
      >
        <h1 className="gdp-admin-login-title">관리자 로그인</h1>
        <p className="gdp-admin-login-desc">금천 데이터플랫폼 관리자 콘솔입니다.</p>

        {displayError ? (
          <p
            id="admin-login-error"
            className="gdp-admin-login-error"
            role="alert"
            aria-live="assertive"
          >
            {displayError}
          </p>
        ) : null}

        <label className="gdp-admin-field">
          <span>관리자 ID</span>
          <input
            type="text"
            id="admin-login-id"
            autoComplete="username"
            required
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            disabled={submitting}
          />
        </label>

        <label className="gdp-admin-field">
          <span>비밀번호</span>
          <input
            type="password"
            id="admin-password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />
        </label>

        <button
          type="submit"
          className="gdp-admin-submit-btn"
          disabled={submitting || !loginId.trim() || !password}
        >
          {submitting ? "로그인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
}
