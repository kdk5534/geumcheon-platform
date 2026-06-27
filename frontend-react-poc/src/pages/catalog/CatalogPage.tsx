import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API_TIMEOUT_MS, BACKEND_API_BASE, isBackendApiEnabled } from "../../data/env";

interface DatasetItem {
  id: string;
  title: string;
  org: string;
  category: string;
  types: string[];
  updateCycle: string;
  updatedAt: string;
  format: string;
  description: string;
}

interface DatasetStatus {
  datasetKey?: string;
  datasetName?: string;
  dataStatus?: string;
  attemptStatus?: string;
  collectedAt?: string;
  attemptedAt?: string;
}

const fallbackDatasets: DatasetItem[] = [
  {
    id: "parking-lots",
    title: "금천구 공영주차장 현황",
    org: "서울특별시 금천구청",
    category: "교통물류",
    types: ["sheet", "map", "api"],
    updateCycle: "수시",
    updatedAt: "항목별 기준일",
    format: "CSV, JSON",
    description: "공영주차장 위치, 운영 정보, 좌표를 시설 단위로 확인합니다.",
  },
  {
    id: "stores",
    title: "금천구 상가업소 정보",
    org: "소상공인시장진흥공단",
    category: "산업고용",
    types: ["sheet", "chart", "map", "api"],
    updateCycle: "일",
    updatedAt: "항목별 기준일",
    format: "CSV, JSON",
    description: "업종 분포와 공간 현황을 중립적으로 탐색합니다.",
  },
  {
    id: "population",
    title: "주민등록 인구 현황",
    org: "행정안전부",
    category: "공공행정",
    types: ["sheet", "chart"],
    updateCycle: "월",
    updatedAt: "항목별 기준일",
    format: "CSV",
    description: "행정동별 주민등록 인구 원값과 기준일을 확인합니다.",
  },
  {
    id: "air-quality",
    title: "금천구 대기질 관측",
    org: "AirKorea",
    category: "환경기상",
    types: ["chart", "api"],
    updateCycle: "3시간",
    updatedAt: "항목별 기준일",
    format: "JSON",
    description: "대기질 관측값과 마지막 정상 수집 상태를 함께 확인합니다.",
  },
  {
    id: "cctv-stations",
    title: "금천구 CCTV 설치 현황",
    org: "서울특별시 금천구청",
    category: "재난안전",
    types: ["sheet", "map"],
    updateCycle: "월",
    updatedAt: "항목별 기준일",
    format: "CSV",
    description: "공개 정책에 맞춰 안전시설 위치와 출처를 확인합니다.",
  },
  {
    id: "welfare-health-facilities",
    title: "복지·건강 시설 수집 상태",
    org: "서울특별시 금천구청·공공데이터포털",
    category: "보건복지",
    types: ["sheet", "map", "api"],
    updateCycle: "항목별",
    updatedAt: "수집 상태 확인 필요",
    format: "CSV, JSON",
    description: "복지·의료·돌봄 시설은 신뢰 가능한 원천 데이터가 확인된 항목만 공개 분석에 연결합니다.",
  },
  {
    id: "public-wifi",
    title: "공공 Wi-Fi 현황",
    org: "서울 열린데이터광장",
    category: "공공행정",
    types: ["sheet", "map", "api"],
    updateCycle: "일",
    updatedAt: "마지막 정상 스냅샷",
    format: "CSV, JSON",
    description: "최근 수집 지연 시 마지막 정상 스냅샷을 기준으로 표시합니다.",
  },
];

const typeLabels: Record<string, string> = {
  sheet: "시트",
  chart: "차트",
  map: "지도",
  file: "파일",
  api: "API",
};

const queryExpansions: Record<string, string[]> = {
  복지: ["welfare", "health", "보건", "의료", "돌봄"],
  건강: ["health", "의료", "보건", "병원", "약국"],
  안전: ["safety", "cctv", "재난", "쉼터", "대피"],
  환경: ["air", "quality", "대기", "기상"],
  상권: ["commercial", "store", "상가", "업소"],
  상가업소: ["commercial", "store", "상권", "업소"],
  인구: ["population", "주민등록", "행정동"],
  생활: ["facility", "wifi", "주차장", "생활시설"],
};

function expandQuery(value: string) {
  const base = value.trim().toLocaleLowerCase("ko-KR");
  if (!base) return [];
  const tokens = new Set([base]);
  Object.entries(queryExpansions).forEach(([key, aliases]) => {
    if (base.includes(key.toLocaleLowerCase("ko-KR"))) {
      aliases.forEach((alias) => tokens.add(alias.toLocaleLowerCase("ko-KR")));
    }
  });
  return [...tokens];
}

async function fetchJsonWithTimeout<T>(url: string, signal?: AbortSignal) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) controller.abort(signal.reason);
  else signal?.addEventListener("abort", abortFromCaller, { once: true });
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

async function loadDatasets(signal?: AbortSignal) {
  try {
    const payload = await fetchJsonWithTimeout<{ datasets?: DatasetItem[] }>(
      `${import.meta.env.BASE_URL}assets/data/datasets.json`,
      signal,
    );
    return Array.isArray(payload.datasets) && payload.datasets.length ? payload.datasets : fallbackDatasets;
  } catch {
    return fallbackDatasets;
  }
}

async function loadStatuses(signal?: AbortSignal) {
  if (!isBackendApiEnabled()) return [];
  try {
    const payload = await fetchJsonWithTimeout<{ success?: boolean; data?: DatasetStatus[] }>(
      `${BACKEND_API_BASE}/api/public/datasets/status`,
      signal,
    );
    return payload.success && Array.isArray(payload.data) ? payload.data : [];
  } catch {
    return [];
  }
}

function summarizeStatuses(statuses: DatasetStatus[], datasets: DatasetItem[]) {
  const available = statuses.filter((status) => status.dataStatus === "AVAILABLE").length;
  const attention = statuses.filter((status) => status.dataStatus === "AVAILABLE" && status.attemptStatus === "FAILED").length;
  const noSuccess = statuses.filter((status) => status.dataStatus === "NO_SUCCESS").length;
  const latest = statuses
    .map((status) => status.collectedAt || "")
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left))[0];

  return {
    total: statuses.length || datasets.length,
    available: statuses.length ? available : datasets.filter((dataset) => dataset.types.includes("api")).length,
    attention,
    noSuccess,
    latest: latest || datasets.map((dataset) => dataset.updatedAt).filter(Boolean).sort().at(-1) || "항목별 기준일",
  };
}

function datasetStatusFor(dataset: DatasetItem, statuses: DatasetStatus[]) {
  const normalized = `${dataset.id} ${dataset.title}`.toLocaleLowerCase("ko-KR");
  const matched = statuses.find((status) => {
    const haystack = `${status.datasetKey || ""} ${status.datasetName || ""}`.toLocaleLowerCase("ko-KR");
    return haystack && (normalized.includes(haystack) || haystack.includes(dataset.id.toLocaleLowerCase("ko-KR")));
  });

  if (!matched) {
    return dataset.types.includes("api")
      ? { tone: "pending", label: "연결 대기", note: "상태 API 연결 전 기본 목록" }
      : { tone: "static", label: "목록 제공", note: "카탈로그 기준 정보" };
  }
  if (matched.dataStatus === "NO_SUCCESS") {
    return { tone: "blocked", label: "공개 제외", note: "정상 수집 이력 없음" };
  }
  if (matched.attemptStatus === "FAILED") {
    return { tone: "attention", label: "최근 실패", note: "마지막 정상값 유지" };
  }
  if (matched.dataStatus === "AVAILABLE") {
    return { tone: "ready", label: "정상 보유", note: matched.collectedAt || "마지막 정상 수집" };
  }
  return { tone: "pending", label: "확인 필요", note: matched.attemptedAt || "상태 확인 필요" };
}

const evidenceShortcuts = [
  { label: "인구·생활", query: "인구 생활", description: "행정동 인구와 생활시설 근거" },
  { label: "상권·경제", query: "상가업소", description: "업종 구성과 상가업소 원천" },
  { label: "복지·건강", query: "복지 건강", description: "복지·의료·돌봄 시설 수집 상태" },
  { label: "안전·환경", query: "CCTV 대기질", description: "CCTV·쉼터·환경 관측 근거" },
];

export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const [datasets, setDatasets] = useState<DatasetItem[]>(fallbackDatasets);
  const [statuses, setStatuses] = useState<DatasetStatus[]>([]);
  const [query, setQuery] = useState(params.get("q") || "");
  const [category, setCategory] = useState(params.get("category") || "전체");
  const [type, setType] = useState(params.get("type") || "전체");
  const [onlyDownloadable, setOnlyDownloadable] = useState(params.get("download") === "true");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([loadDatasets(controller.signal), loadStatuses(controller.signal)]).then(([nextDatasets, nextStatuses]) => {
      if (controller.signal.aborted) return;
      setDatasets(nextDatasets);
      setStatuses(nextStatuses);
    });
    return () => controller.abort();
  }, []);

  const updateFilterParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === "전체" || value === "false") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const categories = useMemo(() => ["전체", ...Array.from(new Set(datasets.map((dataset) => dataset.category))).sort()], [datasets]);
  const types = useMemo(() => ["전체", ...Array.from(new Set(datasets.flatMap((dataset) => dataset.types))).sort()], [datasets]);
  const summary = summarizeStatuses(statuses, datasets);

  const filtered = useMemo(() => {
    const queryTokens = expandQuery(query);
    return datasets.filter((dataset) => {
      const matchesQuery =
        !queryTokens.length ||
        queryTokens.some((token) =>
          `${dataset.id} ${dataset.title} ${dataset.org} ${dataset.category} ${dataset.description}`
            .toLocaleLowerCase("ko-KR")
            .includes(token),
        );
      const matchesCategory = category === "전체" || dataset.category === category;
      const matchesType = type === "전체" || dataset.types.includes(type);
      const matchesDownload = !onlyDownloadable || /csv|xlsx|json|file/i.test(`${dataset.format} ${dataset.types.join(" ")}`);
      return matchesQuery && matchesCategory && matchesType && matchesDownload;
    });
  }, [category, datasets, onlyDownloadable, query, type]);

  const activeFilterLabels = [
    query ? `검색어 ${query}` : "",
    category !== "전체" ? `주제 ${category}` : "",
    type !== "전체" ? `형식 ${typeLabels[type] || type}` : "",
    onlyDownloadable ? "다운로드 가능" : "",
  ].filter(Boolean);

  const clearFilters = () => {
    setQuery("");
    setCategory("전체");
    setType("전체");
    setOnlyDownloadable(false);
    setParams(new URLSearchParams(), { replace: true });
  };

  const applyEvidenceQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    const next = new URLSearchParams(params);
    next.set("q", nextQuery);
    setParams(next, { replace: true });
  };

  return (
    <section className="gdp-catalog-page" aria-labelledby="catalog-title">
      <header className="gdp-catalog-head">
        <div>
          <span>DATA CATALOG</span>
          <h1 id="catalog-title">근거 데이터를 찾습니다</h1>
          <p>주제, 형식, 최신성, 다운로드 가능 여부를 기준으로 공개 데이터의 출처와 이용 방법을 확인합니다.</p>
        </div>
        <div className="gdp-catalog-head-stats">
          <strong>{datasets.length.toLocaleString("ko-KR")}</strong>
          <span>검색 가능 데이터셋</span>
        </div>
      </header>

      <section className="gdp-catalog-status" aria-label="데이터 운영 상태">
        <div>
          <span>운영 데이터셋</span>
          <strong>{summary.total.toLocaleString("ko-KR")}</strong>
        </div>
        <div>
          <span>{statuses.length ? "정상자료 보유" : "API 형식"}</span>
          <strong>{summary.available.toLocaleString("ko-KR")}</strong>
        </div>
        <div>
          <span>최근 실패·자료 유지</span>
          <strong>{summary.attention.toLocaleString("ko-KR")}</strong>
        </div>
        <div>
          <span>최근 기준</span>
          <strong>{summary.latest}</strong>
        </div>
        <p>
          {summary.noSuccess
            ? `정상 수집 이력이 없는 데이터셋 ${summary.noSuccess.toLocaleString("ko-KR")}건은 공개 지표에서 제외됩니다.`
            : "최근 시도 실패는 마지막 정상 스냅샷의 삭제나 공개 중단을 의미하지 않습니다."}
        </p>
      </section>

      <section className="gdp-catalog-toolbar" aria-label="데이터셋 검색 조건">
        <label>
          검색어
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              updateFilterParam("q", event.target.value);
            }}
            placeholder="데이터셋, 기관, 설명 검색"
          />
        </label>
        <label>
          주제
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              updateFilterParam("category", event.target.value);
            }}
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          형식
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              updateFilterParam("type", event.target.value);
            }}
          >
            {types.map((item) => (
              <option key={item} value={item}>
                {item === "전체" ? item : typeLabels[item] || item}
              </option>
            ))}
          </select>
        </label>
        <label className="gdp-catalog-check">
          <input
            type="checkbox"
            checked={onlyDownloadable}
            onChange={(event) => {
              setOnlyDownloadable(event.target.checked);
              updateFilterParam("download", String(event.target.checked));
            }}
          />
          다운로드 가능
        </label>
      </section>

      <section className="gdp-catalog-shortcuts" aria-label="화면별 데이터 근거 바로가기">
        <header>
          <span>EVIDENCE PATH</span>
          <h2>분석 화면별 근거 찾기</h2>
          <p>각 대시보드 화면에서 사용하는 데이터 출처와 수집 상태를 빠르게 좁혀 봅니다.</p>
        </header>
        <div>
          {evidenceShortcuts.map((item) => (
            <button key={item.label} type="button" onClick={() => applyEvidenceQuery(item.query)}>
              <span>{item.label}</span>
              <strong>{item.query}</strong>
              <small>{item.description}</small>
            </button>
          ))}
        </div>
      </section>

      <div className="gdp-catalog-result-head" role="status" aria-live="polite">
        <div>
          <strong>{filtered.length.toLocaleString("ko-KR")}개 데이터셋</strong>
          <span>{activeFilterLabels.length ? activeFilterLabels.join(" · ") : "전체 공개 카탈로그"}</span>
        </div>
        <button type="button" onClick={clearFilters}>필터 초기화</button>
      </div>

      <section className="gdp-catalog-grid" aria-label="데이터셋 목록">
        {filtered.length ? (
          filtered.map((dataset) => {
            const status = datasetStatusFor(dataset, statuses);
            return (
              <article key={dataset.id}>
                <div className="gdp-catalog-card-head">
                  <span>{dataset.category}</span>
                  <small>{dataset.updateCycle}</small>
                </div>
                <div className={`gdp-catalog-state is-${status.tone}`}>
                  <strong>{status.label}</strong>
                  <small>{status.note}</small>
                </div>
                <h2>{dataset.title}</h2>
                <p>{dataset.description}</p>
                <dl>
                  <div>
                    <dt>제공기관</dt>
                    <dd>{dataset.org}</dd>
                  </div>
                  <div>
                    <dt>기준일</dt>
                    <dd>{dataset.updatedAt}</dd>
                  </div>
                  <div>
                    <dt>형식</dt>
                    <dd>{dataset.format}</dd>
                  </div>
                </dl>
                <div className="gdp-catalog-types">
                  {dataset.types.map((item) => (
                    <span key={item}>{typeLabels[item] || item}</span>
                  ))}
                </div>
              </article>
            );
          })
        ) : (
          <div className="gdp-catalog-empty">
            <span>NO DATASET MATCH</span>
            <strong>조건에 맞는 데이터셋이 없습니다</strong>
            <p>검색어, 주제, 형식, 다운로드 조건을 완화해 주세요. 분석 화면의 근거가 보이지 않으면 수집 상태 또는 공개 가능 여부를 먼저 확인합니다.</p>
            <button type="button" onClick={clearFilters}>전체 카탈로그 보기</button>
          </div>
        )}
      </section>
    </section>
  );
}
