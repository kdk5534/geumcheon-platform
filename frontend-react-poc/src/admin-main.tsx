// 관리자 콘솔 진입점 — 별도 엔트리(admin.html) 기반 세션 인증 SPA
import React, { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminAuthProvider } from "./admin/AdminAuthContext";
import { AdminShell } from "./admin/AdminShell";
import { AdminHomePage } from "./admin/pages/AdminHomePage";
import { AdminUploadPage } from "./admin/pages/AdminUploadPage";
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/admin.css";

const root = document.getElementById("geumcheon-admin-root");

if (!root) {
  throw new Error("Missing #geumcheon-admin-root");
}

function AdminRouteFallback() {
  return (
    <div className="gdp-admin-route-fallback" role="status" aria-live="polite">
      화면을 준비하고 있습니다.
    </div>
  );
}

createRoot(root).render(
  <React.StrictMode>
    <AdminAuthProvider>
      <HashRouter>
        <Suspense fallback={<AdminRouteFallback />}>
          <Routes>
            <Route element={<AdminShell />}>
              <Route path="/" element={<AdminHomePage />} />
              <Route path="/upload" element={<AdminUploadPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </HashRouter>
    </AdminAuthProvider>
  </React.StrictMode>,
);
