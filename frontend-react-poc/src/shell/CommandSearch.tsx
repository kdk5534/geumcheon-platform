import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_API_BASE, isBackendApiEnabled } from "../data/env";

interface SearchItem {
  type: string;
  title: string;
  detail: string;
  href: string;
  keywords: string;
}

const items: SearchItem[] = [
  { type: "화면", title: "종합 현황", detail: "지도와 핵심 지표", href: "/home", keywords: "대시보드 지도 지표 현황" },
  { type: "화면", title: "인구·생활", detail: "인구 차트와 생활시설", href: "/population", keywords: "인구 주민등록 생활시설 행정동 population life facility" },
  { type: "화면", title: "상권·경제", detail: "업종 구성과 지역 비교", href: "/commercial", keywords: "상권 업종 점포 경제 상가업소 commercial economy store business" },
  { type: "화면", title: "복지·건강", detail: "필요한 도움과 시설 근거", href: "/welfare", keywords: "복지 돌봄 의료 어르신 장애 약국 병원 welfare health care hospital pharmacy" },
  { type: "화면", title: "안전·환경", detail: "CCTV·쉼터·대기질 레이어", href: "/safety", keywords: "안전 cctv 대기 쉼터 스쿨존 환경 safety environment shelter air" },
  { type: "화면", title: "데이터 카탈로그", detail: "출처와 수집 상태", href: "/datasets", keywords: "근거 출처 기준일 데이터 카탈로그 dataset catalog source evidence" },
  { type: "주제", title: "인구", detail: "행정동별 인구 구조", href: "/population", keywords: "인구 주민등록 행정동 population" },
  { type: "주제", title: "상권", detail: "업종별 점포 구성", href: "/commercial", keywords: "상권 업종 점포 경제 commercial store" },
  { type: "주제", title: "복지", detail: "도움과 시설", href: "/welfare", keywords: "복지 돌봄 의료 어르신 welfare health care" },
  { type: "주제", title: "안전", detail: "안전·환경 상황", href: "/safety", keywords: "안전 cctv 대기 쉼터 safety environment" },
  { type: "행정동", title: "가산동", detail: "행정동 필터", href: "/home?district=가산동", keywords: "가산" },
  { type: "행정동", title: "독산1동", detail: "행정동 필터", href: "/home?district=독산1동", keywords: "독산" },
  { type: "행정동", title: "독산2동", detail: "행정동 필터", href: "/home?district=독산2동", keywords: "독산" },
  { type: "행정동", title: "독산3동", detail: "행정동 필터", href: "/home?district=독산3동", keywords: "독산" },
  { type: "행정동", title: "시흥1동", detail: "행정동 필터", href: "/home?district=시흥1동", keywords: "시흥" },
  { type: "행정동", title: "시흥2동", detail: "행정동 필터", href: "/home?district=시흥2동", keywords: "시흥" },
  { type: "시설", title: "금천구청", detail: "공공시설", href: "/nearby?category=생활", keywords: "구청 공공 행정" },
  { type: "시설", title: "복지시설 찾기", detail: "복지·의료·돌봄 시설", href: "/nearby?category=복지", keywords: "복지 병원 약국 돌봄 의료" },
  { type: "시설", title: "안전시설 목록", detail: "CCTV·쉼터·보호구역", href: "/nearby?category=안전", keywords: "안전 cctv 쉼터 대피 스쿨존" },
  { type: "데이터셋", title: "인구 데이터", detail: "주민등록 인구 근거", href: "/datasets?q=인구", keywords: "인구 주민등록 데이터" },
  { type: "데이터셋", title: "상권 데이터", detail: "상가업소 업종 근거", href: "/datasets?q=상가업소", keywords: "상권 상가업소 업종 데이터" },
  { type: "데이터셋", title: "복지 데이터", detail: "복지·건강 수집 상태", href: "/datasets?q=복지", keywords: "복지 건강 의료 돌봄 데이터 welfare health care dataset" },
  { type: "데이터셋", title: "안전·환경 데이터", detail: "CCTV·대기질 근거", href: "/datasets?q=안전 환경", keywords: "안전 환경 cctv 대기질 데이터 safety environment dataset" },
];

interface Props {
  open: boolean;
  language: string;
  onClose: () => void;
}

interface ApiSearchItem {
  type?: string;
  title?: string;
  detail?: string;
  href?: string;
}

function normalizeHref(href: string) {
  if (!href) return "/home";
  if (href.startsWith("#/")) return href.slice(1);
  if (href.startsWith("/")) return href;
  return `/home?search=${encodeURIComponent(href)}`;
}

function searchTypeLabel(type: string) {
  return ({ SCREEN: "화면", DATASET: "데이터셋", FACILITY: "시설", AREA: "행정동" } as Record<string, string>)[type] || type || "검색";
}

export function CommandSearch({ open, language, onClose }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [remoteItems, setRemoteItems] = useState<SearchItem[]>([]);
  const [remoteStatus, setRemoteStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const localResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items.slice(0, 7);
    return items
      .filter((item) => `${item.type} ${item.title} ${item.detail} ${item.keywords}`.toLowerCase().includes(normalized))
      .slice(0, 8);
  }, [query]);

  const results = remoteItems.length ? remoteItems : localResults;
  const resultGroups = useMemo(() => {
    const groups = new Map<string, SearchItem[]>();
    results.forEach((item) => {
      const group = groups.get(item.type) || [];
      group.push(item);
      groups.set(item.type, group);
    });
    return [...groups.entries()];
  }, [results]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(0);
    setRemoteItems([]);
    setRemoteStatus("idle");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open || !isBackendApiEnabled() || query.trim().length < 2) {
      setRemoteItems([]);
      setRemoteStatus("idle");
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setRemoteStatus("loading");
      try {
        const url = `${BACKEND_API_BASE}/api/public/search?q=${encodeURIComponent(query.trim())}&lang=${encodeURIComponent(language)}`;
        const response = await fetch(url, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || !Array.isArray(payload?.data?.items)) {
          setRemoteStatus("error");
          setRemoteItems([]);
          return;
        }
        setRemoteItems(
          payload.data.items.slice(0, 8).map((item: ApiSearchItem) => ({
            type: searchTypeLabel(String(item.type || "")),
            title: String(item.title || "검색 결과"),
            detail: String(item.detail || "상세 정보"),
            href: normalizeHref(String(item.href || "")),
            keywords: "",
          })),
        );
        setSelected(0);
        setRemoteStatus("ready");
      } catch {
        if (!controller.signal.aborted) {
          setRemoteStatus("error");
          setRemoteItems([]);
        }
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [language, open, query]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected((current) => Math.min(current + 1, Math.max(0, results.length - 1)));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((current) => Math.max(current - 1, 0));
      }
      if (event.key === "Enter" && results[selected]) {
        event.preventDefault();
        navigate(results[selected].href);
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, onClose, open, results, selected]);

  if (!open) return null;

  let visualIndex = 0;

  return (
    <div className="gdp-command" role="dialog" aria-modal="true" aria-label="통합 검색">
      <button className="gdp-command-backdrop" type="button" aria-label="검색 닫기" onClick={onClose} />
      <section className="gdp-command-panel">
        <header className="gdp-command-head">
          <span>UNIFIED SEARCH</span>
          <strong>화면, 시설, 행정동, 데이터셋을 찾습니다</strong>
        </header>
        <div className="gdp-command-input">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
            }}
            placeholder="시설, 데이터셋, 행정동, 화면 검색"
            aria-label="통합 검색어"
          />
          <kbd>ESC</kbd>
        </div>
        <div className={`gdp-command-source is-${remoteStatus}`}>
          {remoteStatus === "loading"
            ? "운영 검색 API 확인 중"
            : remoteStatus === "ready"
              ? "운영 검색 API 결과"
              : remoteStatus === "error"
                ? "운영 검색 지연 · 로컬 색인 표시"
                : "로컬 빠른 이동"}
        </div>
        <div className="gdp-command-results" role="listbox" aria-label="검색 결과">
          {results.length ? (
            resultGroups.map(([group, groupItems]) => (
              <section key={group} className="gdp-command-group" aria-label={`${group} 검색 결과`}>
                <h2>{group}</h2>
                {groupItems.map((item) => {
                  const index = visualIndex;
                  visualIndex += 1;
                  return (
                    <button
                      key={`${item.type}-${item.title}`}
                      className={selected === index ? "is-active" : ""}
                      type="button"
                      role="option"
                      aria-selected={selected === index}
                      onMouseEnter={() => setSelected(index)}
                      onClick={() => {
                        navigate(item.href);
                        onClose();
                      }}
                    >
                      <span>{item.type}</span>
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                    </button>
                  );
                })}
              </section>
            ))
          ) : (
            <div className="gdp-command-empty">
              <span>NO RESULT</span>
              <strong>검색 결과가 없습니다</strong>
              <p>화면명, 행정동, 시설 유형, 데이터셋 이름으로 다시 검색해 주세요.</p>
              <div>
                <button type="button" onClick={() => setQuery("복지")}>복지</button>
                <button type="button" onClick={() => setQuery("상권")}>상권</button>
                <button type="button" onClick={() => setQuery("CCTV")}>CCTV</button>
              </div>
            </div>
          )}
        </div>
        <footer>
          <span>↑↓ 이동</span>
          <span>Enter 선택</span>
          <span>Esc 닫기</span>
        </footer>
      </section>
    </div>
  );
}
