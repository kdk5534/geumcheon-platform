import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { CommandSearch } from "./CommandSearch";
import { adaptOverviewModel } from "../data/overviewAdapter";
import { loadPublicData } from "../data/publicApi";
import { overviewModel } from "../pages/overview/overviewModel";
import type { OverviewModel } from "../pages/overview/overviewTypes";
import { currentPageKey, routeToSection, sectionConfig } from "./sectionConfig";

const navItems = [
  { key: "home", to: "/home", label: "종합 현황" },
  { key: "population", to: "/population", label: "인구·생활" },
  { key: "commercial", to: "/commercial", label: "상권·경제" },
  { key: "welfare", to: "/welfare", label: "복지·건강" },
  { key: "safety", to: "/safety", label: "안전·환경" },
  { key: "catalog", to: "/datasets", label: "데이터 카탈로그" },
];

const supportedLanguages = ["ko", "en", "ja", "zh-CN"] as const;
type Language = (typeof supportedLanguages)[number];
type Theme = "light" | "dark";

function todayLabel() {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());
}

function getInitialTheme(): Theme {
  const requested = new URL(window.location.href).searchParams.get("theme");
  if (requested === "dark" || requested === "light") return requested;
  return localStorage.getItem("gdp-theme") === "dark" ? "dark" : "light";
}

function getInitialLanguage(): Language {
  const requested = new URL(window.location.href).searchParams.get("lang");
  if (supportedLanguages.includes(requested as Language)) return requested as Language;
  const saved = localStorage.getItem("gdp-language");
  return supportedLanguages.includes(saved as Language) ? (saved as Language) : "ko";
}

function syncUrlParam(key: string, value: string, defaultValue: string) {
  const url = new URL(window.location.href);
  if (value === defaultValue) url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  window.history.replaceState({}, "", url);
}

export function AppShell() {
  const location = useLocation();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shellModel, setShellModel] = useState<OverviewModel>(overviewModel);
  const [healthOpen, setHealthOpen] = useState(false);
  const [dataState, setDataState] = useState<"loading" | "ready" | "fallback" | "error">("loading");

  useEffect(() => {
    localStorage.setItem("gdp-theme", theme);
    syncUrlParam("theme", theme, "light");
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("gdp-language", language);
    document.documentElement.lang = language;
    syncUrlParam("lang", language, "ko");
  }, [language]);

  useEffect(() => {
    const controller = new AbortController();
    loadPublicData(controller.signal)
      .then((bundle) => {
        if (controller.signal.aborted) return;
        setShellModel(adaptOverviewModel(bundle));
        setDataState(bundle.source === "backend" ? "ready" : "fallback");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setShellModel(overviewModel);
        setDataState("error");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const populationMetric = shellModel.metrics.find((metric) => metric.key === "population");
  const storeMetric = shellModel.metrics.find((metric) => metric.key === "commercial");
  const facilityMetric = shellModel.metrics.find((metric) => metric.key === "facility");
  const airMetric = shellModel.metrics.find((metric) => metric.key === "air");
  const activeSectionKey = routeToSection(location.pathname, location.search);
  const activeSection = activeSectionKey ? sectionConfig[activeSectionKey] : null;
  const pageKey = currentPageKey(location.pathname);

  useEffect(() => {
    document.title = `${activeSection?.documentTitle || "금천 데이터플랫폼"} | 금천 데이터플랫폼`;
  }, [activeSection?.documentTitle]);

  return (
    <div className="gdp-app" data-theme={theme}>
      <a className="gdp-skip-link" href="#gdp-main">
        본문으로 바로 이동
      </a>

      <div className="gdp-util-bar" role="complementary" aria-label="유틸리티 메뉴">
        <span>{todayLabel()}</span>
        <nav aria-label="관련 공공 사이트">
          <a href="https://www.geumcheon.go.kr/portal/index.do" target="_blank" rel="noreferrer">
            금천구청 홈페이지
          </a>
          <a href="https://data.seoul.go.kr" target="_blank" rel="noreferrer">
            서울 열린데이터
          </a>
          <a href="https://www.data.go.kr" target="_blank" rel="noreferrer">
            공공데이터포털
          </a>
        </nav>
      </div>

      <section className="gdp-pulse-bar" aria-label="주요 생활 지표 요약">
        <strong>지표 요약</strong>
        <div>
          <span>
            <i className="is-mint" /> 대기질 <b>{airMetric?.value || "항목별 표시"}</b>
          </span>
          <span>
            <i className="is-cobalt" /> 등록점포 <b>{storeMetric?.value || "확인 중"}</b>
          </span>
          <span>
            <i className="is-coral" /> 주민등록인구 <b>{populationMetric?.value || "확인 중"}</b>
          </span>
          <span>
            <i className="is-amber" /> 생활시설 <b>{facilityMetric?.value || "확인 중"}</b>
          </span>
        </div>
        <button type="button" onClick={() => setHealthOpen((current) => !current)} aria-expanded={healthOpen}>
          기준시각은 항목별 표시
        </button>
      </section>

      <header className="gdp-shell">
        <a className="gdp-brand" href="#/home" aria-label="금천 데이터플랫폼 홈">
          <span className="gdp-brand-mark">GC</span>
          <span>
            <strong>금천 데이터플랫폼</strong>
            <small>GEUMCHEON DATA PORTAL</small>
          </span>
        </a>
        <nav className="gdp-nav" aria-label="주요 화면">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={() => (activeSectionKey === item.key ? "active" : "")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="gdp-shell-actions">
          <button className="gdp-search-button" type="button" aria-label="통합 검색 열기" onClick={() => setSearchOpen(true)}>
            시설, 데이터셋, 행정동 검색
            <kbd>Ctrl K</kbd>
          </button>
          <select
            className="gdp-language-select"
            aria-label="언어 선택"
            value={language}
            onChange={(event) => setLanguage(event.target.value as Language)}
          >
            <option value="ko">KO</option>
            <option value="en">EN</option>
            <option value="ja">JA</option>
            <option value="zh-CN">ZH</option>
          </select>
          <button
            className="gdp-theme-toggle"
            type="button"
            aria-label={theme === "dark" ? "라이트 테마로 전환" : "다크 테마로 전환"}
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      <section className={`gdp-shell-health is-${dataState} ${healthOpen ? "is-open" : ""}`} aria-label="데이터 상태">
        <button type="button" onClick={() => setHealthOpen((current) => !current)} aria-expanded={healthOpen}>
          <span />
          <strong>
            {dataState === "ready"
              ? "공개 데이터 연결됨"
              : dataState === "fallback"
                ? "대체 데이터 표시 중"
                : dataState === "error"
                  ? "일부 데이터 연결 지연"
                  : "데이터 상태 확인 중"}
          </strong>
          <small>{shellModel.asOf}</small>
        </button>
        {healthOpen ? (
          <div>
            <p>
              <span>공개 범위</span>
              <strong>금천구 GEUMCHEON</strong>
            </p>
            <p>
              <span>표시 정책</span>
              <strong>마지막 정상 스냅샷 유지</strong>
            </p>
            <p>
              <span>데이터 공급</span>
              <strong>{shellModel.sourceMode}</strong>
            </p>
            <a href="#/datasets">데이터 근거 보기</a>
          </div>
        ) : null}
      </section>

      {activeSection ? (
        <section className="gdp-section-nav-shell" aria-label="현재 영역 세부 메뉴">
          <div className="gdp-section-context">
            <span>현재 영역</span>
            <strong>{activeSection.title}</strong>
          </div>
          <nav>
            {activeSection.items.map((item) => {
              const isActive = item.pages.includes(pageKey);
              return (
                <NavLink key={item.to} to={item.to} className={isActive ? "is-active" : ""} aria-current={isActive ? "page" : undefined}>
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
          <NavLink className="gdp-section-data-link" to="/datasets">
            데이터 검색
          </NavLink>
        </section>
      ) : null}

      <main className="gdp-main" id="gdp-main">
        <Outlet />
      </main>
      <footer className="gdp-site-footer">
        <div>
          <strong>금천구청 스마트도시과</strong>
          <span>서울특별시 금천구 시흥대로73길 70</span>
        </div>
        <p>각 수치의 기준일과 출처는 화면의 데이터 상태에서 확인할 수 있습니다.</p>
        <nav aria-label="하단 관련 링크">
          <a href="https://www.geumcheon.go.kr/portal/index.do" target="_blank" rel="noreferrer">
            금천구청
          </a>
          <a href="https://www.data.go.kr" target="_blank" rel="noreferrer">
            공공데이터포털
          </a>
        </nav>
      </footer>
      <CommandSearch open={searchOpen} language={language} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
