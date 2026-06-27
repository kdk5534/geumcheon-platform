import React, { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./shell/AppShell";
import "./styles/tokens.css";
import "./styles/app.css";

const root = document.getElementById("geumcheon-data-platform-root");

if (!root) {
  throw new Error("Missing #geumcheon-data-platform-root");
}

const OverviewPage = React.lazy(() => import("./pages/overview/OverviewPage").then((module) => ({ default: module.OverviewPage })));
const CatalogPage = React.lazy(() => import("./pages/catalog/CatalogPage").then((module) => ({ default: module.CatalogPage })));
const FacilityFinderPage = React.lazy(() => import("./pages/facilities/FacilityFinderPage").then((module) => ({ default: module.FacilityFinderPage })));
const ThematicAnalysisPage = React.lazy(() =>
  import("./pages/analysis/ThematicAnalysisPage").then((module) => ({ default: module.ThematicAnalysisPage })),
);
const RealtimePage = React.lazy(() => import("./pages/realtime/RealtimePage").then((module) => ({ default: module.RealtimePage })));
const IndicatorsPage = React.lazy(() => import("./pages/indicators/IndicatorsPage").then((module) => ({ default: module.IndicatorsPage })));
const DistrictComparePage = React.lazy(() =>
  import("./pages/district/DistrictComparePage").then((module) => ({ default: module.DistrictComparePage })),
);
const TopicsPage = React.lazy(() => import("./pages/topics/TopicsPage").then((module) => ({ default: module.TopicsPage })));
const AboutPage = React.lazy(() => import("./pages/about/AboutPage").then((module) => ({ default: module.AboutPage })));

function RouteFallback() {
  return (
    <section className="gdp-route-fallback" role="status" aria-live="polite">
      <span />
      화면 데이터를 준비하고 있습니다.
    </section>
  );
}

createRoot(root).render(
  <React.StrictMode>
    <HashRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<OverviewPage />} />
            <Route path="/realtime" element={<RealtimePage />} />
            <Route path="/indicators" element={<IndicatorsPage />} />
            <Route
              path="/population"
              element={
                <ThematicAnalysisPage
                  topic="population"
                  eyebrow="POPULATION & LIFE"
                  title="인구·생활"
                  description="누가 어디에 사는가를 중심으로 행정동별 인구, 생활시설, 기준일을 함께 확인합니다."
                  primaryQuestion="어느 행정동의 인구와 생활시설을 함께 볼 것인가?"
                />
              }
            />
            <Route
              path="/commercial"
              element={
                <ThematicAnalysisPage
                  topic="commercial"
                  eyebrow="LOCAL ECONOMY"
                  title="상권·경제"
                  description="창업 추천이나 지역 평가가 아니라 업종 분포와 공간 현황을 중립적으로 확인합니다."
                  primaryQuestion="어떤 업종 구성이 현재 데이터에서 관측되는가?"
                />
              }
            />
            <Route
              path="/welfare"
              element={
                <ThematicAnalysisPage
                  topic="welfare"
                  eyebrow="WELFARE & HEALTH"
                  title="복지·건강"
                  description="어르신·장애·돌봄·의료·긴급지원처럼 필요한 도움에서 시작해 시설과 근거로 이어집니다."
                  primaryQuestion="필요한 도움과 연결되는 시설은 어디에 있는가?"
                />
              }
            />
            <Route
              path="/safety"
              element={
                <ThematicAnalysisPage
                  topic="safety"
                  eyebrow="SAFETY & ENVIRONMENT"
                  title="안전·환경"
                  description="대기질·CCTV·쉼터 등 안전·환경 데이터를 지도와 목록 과업으로 연결합니다."
                  primaryQuestion="어떤 안전·환경 레이어를 확인할 것인가?"
                />
              }
            />
            <Route path="/nearby" element={<FacilityFinderPage />} />
            <Route path="/dong" element={<DistrictComparePage />} />
            <Route path="/topics" element={<TopicsPage />} />
            <Route path="/datasets" element={<CatalogPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  </React.StrictMode>,
);
