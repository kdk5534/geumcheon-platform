import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePublicData } from "../../data/PublicDataContext";
import type { FacilitySummary, OverviewTopic } from "../overview/overviewTypes";
import { LinkedChart } from "../overview/components/LinkedChart";
import { VworldMap } from "../overview/components/VworldMap";

interface Props {
  topic: OverviewTopic;
  eyebrow: string;
  title: string;
  description: string;
  primaryQuestion: string;
}

const topicCopy: Record<
  OverviewTopic,
  {
    metricKeys: string[];
    accent: string;
    route: string;
    secondary: string;
    facilityAliases: string[];
    lens: Array<{ label: string; value: string; note: string }>;
    emptyAction: { label: string; to: string; note: string };
    evidence: Array<{ label: string; value: string; note: string }>;
    serviceNeeds?: Array<{ label: string; description: string; aliases: string[]; catalogQuery: string }>;
    safetyLayers?: Array<{ label: string; description: string; aliases: string[]; catalogQuery: string; tone: "amber" | "cobalt" | "mint" }>;
  }
> = {
  population: {
    metricKeys: ["population", "facility", "air"],
    accent: "cobalt",
    route: "/nearby?category=생활",
    secondary: "행정동별 인구와 생활시설 접근 흐름을 함께 봅니다.",
    facilityAliases: ["공공", "문화", "의료", "행정", "복지", "교통", "시설", "전기차충전소", "주차장", "공공 wi-fi", "wifi", "자전거"],
    lens: [
      { label: "주요 관점", value: "거주 분포", note: "행정동별 원값과 생활시설 목록을 같은 화면에서 확인합니다." },
      { label: "연결 과업", value: "생활시설 지도", note: "선택한 행정동 조건을 시설 찾기로 이어갑니다." },
      { label: "주의", value: "단위 분리", note: "인구와 시설 수를 점수화하지 않고 원값으로만 표시합니다." },
    ],
    emptyAction: { label: "생활시설 전체 보기", to: "/nearby?category=생활", note: "검색 조건을 해제하고 생활 시설 전체를 확인합니다." },
    evidence: [
      { label: "인구", value: "행정동별 주민등록 인구", note: "차트는 행정동 원값만 사용합니다." },
      { label: "생활시설", value: "공개 시설 API", note: "주소·좌표가 있는 행만 지도에 표시합니다." },
      { label: "해석", value: "점수화 없음", note: "인구와 시설을 합산해 평가하지 않습니다." },
    ],
  },
  commercial: {
    metricKeys: ["commercial", "population", "facility"],
    accent: "coral",
    route: "/dong",
    secondary: "업종 분포와 공간 현황을 지역 평가 없이 원값 중심으로 봅니다.",
    facilityAliases: ["상가", "업소", "시장", "주차장", "공공 wi-fi", "wifi", "전기차충전소"],
    lens: [
      { label: "주요 관점", value: "업종 구성", note: "창업 추천이 아니라 업종 분포와 변화 단서를 확인합니다." },
      { label: "연결 과업", value: "지역 비교", note: "선택한 두 행정동의 원값 차이만 비교합니다." },
      { label: "주의", value: "평가 금지", note: "상권 우수/취약, 빨강/초록 판단 표현을 사용하지 않습니다." },
    ],
    emptyAction: { label: "지역 비교 열기", to: "/dong", note: "상권 해석은 비교 화면에서 원값 중심으로 이어갑니다." },
    evidence: [
      { label: "상권", value: "상가업소 업종 분류", note: "업종 구성과 건수 중심으로 표시합니다." },
      { label: "공간", value: "GEUMCHEON 범위", note: "인접 지역은 기본 공개 분석에 포함하지 않습니다." },
      { label: "해석", value: "추천/순위 없음", note: "창업 추천이나 지역 우열 판단으로 표현하지 않습니다." },
    ],
  },
  welfare: {
    metricKeys: ["facility", "population", "air"],
    accent: "mint",
    route: "/nearby?category=복지",
    secondary: "필요한 도움에서 시작해 시설 목록과 근거로 이어집니다.",
    facilityAliases: ["복지", "돌봄", "의료", "보건", "병원", "약국", "어르신", "장애", "어린이집"],
    lens: [
      { label: "주요 관점", value: "필요한 도움", note: "어르신·돌봄·의료 등 도움 유형에서 시설 근거로 이동합니다." },
      { label: "데이터 정책", value: "무대체", note: "신뢰 가능한 복지 원천이 없으면 다른 시설로 채우지 않습니다." },
      { label: "확인 경로", value: "카탈로그", note: "수집 상태와 마지막 정상 기준을 데이터 카탈로그에서 확인합니다." },
    ],
    emptyAction: { label: "복지 데이터 상태 확인", to: "/datasets?q=복지", note: "복지·건강 데이터가 공개 분석에 들어올 수 있는 상태인지 확인합니다." },
    evidence: [
      { label: "복지", value: "복지·돌봄·의료 시설", note: "신뢰 가능한 시설 원천만 화면에 노출합니다." },
      { label: "상세", value: "주소·분류·좌표", note: "연락처/운영시간은 원천 확인 후 단계적으로 붙입니다." },
      { label: "공백", value: "대체 표시 금지", note: "없는 복지 데이터를 다른 시설로 채우지 않습니다." },
    ],
    serviceNeeds: [
      {
        label: "어르신",
        description: "어르신 돌봄·건강·이용시설을 우선 확인합니다.",
        aliases: ["어르신", "노인", "경로", "요양", "돌봄", "복지"],
        catalogQuery: "어르신 복지",
      },
      {
        label: "장애·이동",
        description: "장애, 이동지원, 접근성 관련 시설 근거를 확인합니다.",
        aliases: ["장애", "이동", "재활", "복지"],
        catalogQuery: "장애 복지",
      },
      {
        label: "의료·약국",
        description: "보건·병원·약국 등 건강 관련 시설을 확인합니다.",
        aliases: ["의료", "보건", "병원", "약국", "건강"],
        catalogQuery: "의료 약국",
      },
      {
        label: "돌봄·아동",
        description: "어린이집, 돌봄, 가족 지원 시설을 확인합니다.",
        aliases: ["돌봄", "아동", "어린이", "어린이집", "가족"],
        catalogQuery: "돌봄 어린이집",
      },
    ],
  },
  safety: {
    metricKeys: ["air", "facility", "population"],
    accent: "amber",
    route: "/nearby?category=CCTV",
    secondary: "안전·환경 레이어와 시설 목록을 같은 기준으로 확인합니다.",
    facilityAliases: ["cctv", "안전", "방범", "재난", "보호", "스쿨존", "어린이보호", "쉼터", "대피", "민방위", "환경", "대기"],
    lens: [
      { label: "주요 관점", value: "상황 지도", note: "CCTV·쉼터·환경 관측을 같은 지도 흐름으로 확인합니다." },
      { label: "연결 과업", value: "안전시설 목록", note: "지도 실패 시에도 목록에서 동일 과업을 완료합니다." },
      { label: "주의", value: "위험판정 아님", note: "안전 취약도나 위험 순위로 해석하지 않습니다." },
    ],
    emptyAction: { label: "CCTV 목록 보기", to: "/nearby?category=CCTV", note: "현재 공개된 안전시설 좌표 목록으로 이동합니다." },
    evidence: [
      { label: "안전", value: "CCTV·쉼터·보호구역", note: "시설 위치와 분류 중심으로만 표시합니다." },
      { label: "환경", value: "대기질 관측", note: "상태 문구와 기준일을 함께 확인합니다." },
      { label: "해석", value: "위험판정 아님", note: "위험도·취약도 색상 평가를 사용하지 않습니다." },
    ],
    safetyLayers: [
      {
        label: "CCTV",
        description: "방범·생활안전 시설 위치를 목록과 지도에서 확인합니다.",
        aliases: ["cctv", "방범", "안전"],
        catalogQuery: "CCTV",
        tone: "cobalt",
      },
      {
        label: "쉼터·대피",
        description: "쉼터, 대피, 민방위 관련 시설을 확인합니다.",
        aliases: ["쉼터", "대피", "민방위", "재난"],
        catalogQuery: "쉼터 대피 민방위",
        tone: "amber",
      },
      {
        label: "보호구역",
        description: "스쿨존·어린이보호 등 보호구역성 자료를 확인합니다.",
        aliases: ["스쿨존", "어린이보호", "보호"],
        catalogQuery: "스쿨존 어린이보호",
        tone: "mint",
      },
      {
        label: "대기질",
        description: "환경 관측값은 시설 위치와 분리해 기준일과 상태만 표시합니다.",
        aliases: ["대기", "환경", "관측"],
        catalogQuery: "대기질 환경",
        tone: "amber",
      },
    ],
  },
};

function withQuery(baseRoute: string, params: Record<string, string>) {
  const [path, query = ""] = baseRoute.split("?");
  const search = new URLSearchParams(query);
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const serialized = search.toString();
  return serialized ? `${path}?${serialized}` : path;
}

export function ThematicAnalysisPage({ topic, eyebrow, title, description, primaryQuestion }: Props) {
  const { model } = usePublicData();
  const [district, setDistrict] = useState("");
  const [query, setQuery] = useState("");
  const [selectedBreakdown, setSelectedBreakdown] = useState("");
  const [selectedFacilityId, setSelectedFacilityId] = useState("");
  const [selectedNeed, setSelectedNeed] = useState("");
  const [selectedSafetyLayer, setSelectedSafetyLayer] = useState("");
  const [showMap, setShowMap] = useState(true);


  const config = topicCopy[topic];
  const selectedNeedConfig = config.serviceNeeds?.find((need) => need.label === selectedNeed) || null;
  const selectedSafetyConfig =
    config.safetyLayers?.find((layer) => layer.label === selectedSafetyLayer) || null;
  const metrics = model.metrics.filter((metric) => config.metricKeys.includes(metric.key));
  const relatedFacilities = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko-KR");
    const needAliases = selectedNeedConfig?.aliases.map((word) => word.toLocaleLowerCase("ko-KR")) || [];
    const safetyAliases = selectedSafetyConfig?.aliases.map((word) => word.toLocaleLowerCase("ko-KR")) || [];
    return model.facilities
      .filter((facility) => {
        const haystack = `${facility.name} ${facility.category} ${facility.address}`.toLocaleLowerCase("ko-KR");
        const matchesQuery = !normalized || haystack.includes(normalized);
        const matchesDistrict = !district || haystack.includes(district.toLocaleLowerCase("ko-KR"));
        const matchesTopic = config.facilityAliases.some((word) => haystack.includes(word));
        const matchesNeed = !needAliases.length || needAliases.some((word) => haystack.includes(word));
        const matchesSafety = !safetyAliases.length || safetyAliases.some((word) => haystack.includes(word));
        return matchesQuery && matchesDistrict && matchesTopic && matchesNeed && matchesSafety;
      })
      .slice(0, 10);
  }, [config.facilityAliases, district, model.facilities, query, selectedNeedConfig, selectedSafetyConfig]);

  const linkedCoordinateCount = relatedFacilities.filter((facility) => facility.lat && facility.lng).length;
  const selectedContext = district || "금천구 전체";
  const activeBreakdown = topic === "commercial" ? selectedBreakdown : district;
  const commercialMix = model.storeCategorySeries.slice(0, 8);
  const commercialTotal = commercialMix.reduce((sum, item) => sum + item.value, 0);
  const selectedCommercialItem =
    commercialMix.find((item) => item.name === selectedBreakdown) || commercialMix[0] || null;
  const selectedCommercialShare =
    selectedCommercialItem && commercialTotal ? Math.round((selectedCommercialItem.value / commercialTotal) * 100) : 0;
  const showFacilityMap = topic !== "commercial";
  const sourceModeLabel = model.sourceMode || "공개 데이터";
  const handleMapUnavailable = useCallback(() => setShowMap(false), []);
  const handleSelectFacility = useCallback((facility: FacilitySummary) => {
    setSelectedFacilityId(facility.id);
  }, []);

  useEffect(() => {
    setSelectedFacilityId("");
    setShowMap(true);
  }, [district, query, selectedNeed, selectedSafetyLayer, topic]);

  useEffect(() => {
    setSelectedNeed("");
    setSelectedSafetyLayer("");
  }, [topic]);

  return (
    <section className={`gdp-analysis-page is-${config.accent}`} aria-labelledby="analysis-title">
      <header className="gdp-analysis-hero">
        <div>
          <span>{eyebrow}</span>
          <h1 id="analysis-title">{title}</h1>
          <p>{description}</p>
        </div>
        <aside>
          <span>핵심 질문</span>
          <strong>{primaryQuestion}</strong>
          <small>{config.secondary}</small>
        </aside>
      </header>

      <section className="gdp-analysis-controls" aria-label="분석 조건">
        <label>
          행정동
          <select value={district} onChange={(event) => setDistrict(event.target.value)}>
            <option value="">금천구 전체</option>
            {model.districts.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          시설·키워드
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="시설명, 주소, 분류 검색" />
        </label>
        <Link to={withQuery(config.route, { district })}>관련 지도 보기</Link>
      </section>

      <div className="gdp-analysis-workbench">
        <article className="gdp-analysis-chart">
          <header>
            <span>{topic === "commercial" ? "CATEGORY MIX" : "DISTRICT SERIES"}</span>
            <h2>{topic === "commercial" ? "업종별 구성" : "행정동별 원값"}</h2>
            <p>차트 항목을 선택하면 현재 분석 맥락과 관련 시설 탐색으로 이어집니다.</p>
          </header>
          <LinkedChart
            model={model}
            topic={topic}
            selectedBreakdown={activeBreakdown}
            onSelectBreakdown={(name) => {
              if (topic === "commercial") {
                setSelectedBreakdown(name);
                return;
              }
              setDistrict(name);
            }}
          />
        </article>

        <aside className="gdp-analysis-list">
          <header>
            <span>{topic === "commercial" ? "BUSINESS MIX" : "RELATED FACILITIES"}</span>
            <h2>{topic === "commercial" ? "업종 구성 요약" : "관련 시설"}</h2>
          </header>
          {topic === "commercial" && commercialMix.length ? (
            <div className="gdp-commerce-panel">
              <section className="gdp-commerce-focus" aria-label="선택 업종 요약">
                <span>SELECTED CATEGORY</span>
                <strong>{selectedCommercialItem?.name || "업종 선택"}</strong>
                <div>
                  <small>표시 업종 합계</small>
                  <b>{commercialTotal.toLocaleString("ko-KR")}개</b>
                </div>
                <div>
                  <small>구성 비중</small>
                  <b>{selectedCommercialShare}%</b>
                </div>
                <p>업종 구성의 원값과 비중만 표시합니다. 창업 추천, 우수 지역, 취약 지역으로 해석하지 않습니다.</p>
              </section>
              <div className="gdp-analysis-mix-list" aria-label="업종 구성 목록">
                {commercialMix.map((item) => {
                  const share = commercialTotal ? Math.round((item.value / commercialTotal) * 100) : 0;
                  return (
                    <button
                      key={item.name}
                      className={selectedBreakdown === item.name ? "is-active" : ""}
                      type="button"
                      aria-pressed={selectedBreakdown === item.name}
                      onClick={() => setSelectedBreakdown(selectedBreakdown === item.name ? "" : item.name)}
                    >
                      <span>{item.name}</span>
                      <strong>{item.value.toLocaleString("ko-KR")}개</strong>
                      <i style={{ inlineSize: `${Math.max(6, share)}%` }} aria-hidden="true" />
                      <small>표시 업종 합계 대비 {share}% · 지역 평가 아님</small>
                    </button>
                  );
                })}
              </div>
              <div className="gdp-commerce-actions">
                <Link to={withQuery("/dong", { topic: "commercial", category: selectedBreakdown })}>
                  선택 업종으로 지역 비교
                </Link>
                <Link to={withQuery("/datasets", { q: "상가업소" })}>상권 데이터 근거</Link>
              </div>
            </div>
          ) : topic === "welfare" ? (
            <div className="gdp-welfare-panel">
              <section className="gdp-welfare-needs" aria-label="필요한 도움 유형">
                <header>
                  <span>HELP FIRST</span>
                  <strong>필요한 도움에서 시작</strong>
                  <p>복지·건강 화면은 시설 수를 평가하지 않고 도움 유형과 원천 근거를 연결합니다.</p>
                </header>
                <div>
                  {config.serviceNeeds?.map((need) => (
                    <button
                      key={need.label}
                      className={selectedNeed === need.label ? "is-active" : ""}
                      type="button"
                      aria-pressed={selectedNeed === need.label}
                      onClick={() => setSelectedNeed(selectedNeed === need.label ? "" : need.label)}
                    >
                      <span>{need.label}</span>
                      <small>{need.description}</small>
                    </button>
                  ))}
                </div>
              </section>
              <section className="gdp-welfare-current" aria-label="복지 탐색 상태">
                <span>CURRENT VIEW</span>
                <strong>{selectedNeedConfig?.label || "전체 복지·건강"}</strong>
                <p>{selectedNeedConfig?.description || "복지·의료·돌봄 관련 공개 시설을 같은 기준으로 확인합니다."}</p>
                <div>
                  <small>연결 시설</small>
                  <b>{relatedFacilities.length.toLocaleString("ko-KR")}행</b>
                </div>
                <div>
                  <small>좌표 연결</small>
                  <b>{linkedCoordinateCount.toLocaleString("ko-KR")}행</b>
                </div>
              </section>
              {relatedFacilities.length ? (
                <div className="gdp-analysis-facility-stack">
                  {showMap && linkedCoordinateCount ? (
                    <div className="gdp-analysis-mini-map">
                      <VworldMap
                        facilities={relatedFacilities}
                        selectedFacilityId={selectedFacilityId}
                        onSelectFacility={handleSelectFacility}
                        onUnavailable={handleMapUnavailable}
                      />
                    </div>
                  ) : (
                    <div className="gdp-analysis-map-fallback" role="status">
                      <strong>목록 기준으로 확인</strong>
                      <span>좌표 또는 지도 연결 상태가 충분하지 않아 같은 데이터를 목록으로 제공합니다.</span>
                    </div>
                  )}
                  <div className="gdp-analysis-facility-list" aria-label="복지·건강 시설 목록">
                    {relatedFacilities.map((facility) => (
                      <button
                        key={facility.id}
                        className={selectedFacilityId === facility.id ? "is-selected" : ""}
                        type="button"
                        aria-pressed={selectedFacilityId === facility.id}
                        onClick={() => setSelectedFacilityId(selectedFacilityId === facility.id ? "" : facility.id)}
                      >
                        <span>{facility.category}</span>
                        <strong>{facility.name}</strong>
                        <small>{facility.address}</small>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="gdp-analysis-empty">
                  <span>NO MATCHED RECORDS</span>
                  <strong>{selectedNeedConfig?.label || "복지·건강"} · {selectedContext}</strong>
                  <p>현재 도움 유형과 조건에 맞는 시설이 없습니다. 다른 시설로 대체하지 않고 수집 상태와 카탈로그 확인 경로를 제공합니다.</p>
                  <div>
                    <small>확인할 것</small>
                    <small>도움 유형, 시설 분류, 좌표 보유 여부, 공개 가능 상태</small>
                  </div>
                  <Link to={withQuery("/datasets", { q: selectedNeedConfig?.catalogQuery || "복지" })}>
                    데이터 상태 확인
                  </Link>
                  <small>{config.emptyAction.note}</small>
                </div>
              )}
              <div className="gdp-welfare-actions">
                <Link to={withQuery("/nearby", { category: "복지", district, q: selectedNeedConfig?.label || "" })}>
                  시설 찾기에서 계속 보기
                </Link>
                <Link to={withQuery("/datasets", { q: selectedNeedConfig?.catalogQuery || "복지 건강" })}>
                  수집 상태 확인
                </Link>
              </div>
            </div>
          ) : topic === "safety" ? (
            <div className="gdp-safety-panel">
              <section className="gdp-safety-layers" aria-label="안전·환경 레이어">
                <header>
                  <span>LAYER CONTROL</span>
                  <strong>상황 레이어 선택</strong>
                  <p>레이어는 자료 유형을 구분하기 위한 장치이며 위험도·취약도 판단을 의미하지 않습니다.</p>
                </header>
                <div>
                  {config.safetyLayers?.map((layer) => (
                    <button
                      key={layer.label}
                      className={`is-${layer.tone} ${selectedSafetyLayer === layer.label ? "is-active" : ""}`}
                      type="button"
                      aria-pressed={selectedSafetyLayer === layer.label}
                      onClick={() => setSelectedSafetyLayer(selectedSafetyLayer === layer.label ? "" : layer.label)}
                    >
                      <span>{layer.label}</span>
                      <small>{layer.description}</small>
                    </button>
                  ))}
                </div>
              </section>
              <section className="gdp-safety-current" aria-label="안전·환경 현재 표시">
                <span>CURRENT LAYER</span>
                <strong>{selectedSafetyConfig?.label || "전체 안전·환경"}</strong>
                <p>{selectedSafetyConfig?.description || "CCTV·쉼터·보호구역·대기질 자료를 평가 표현 없이 분리해 확인합니다."}</p>
                <div>
                  <small>표시 시설</small>
                  <b>{relatedFacilities.length.toLocaleString("ko-KR")}행</b>
                </div>
                <div>
                  <small>좌표 연결</small>
                  <b>{linkedCoordinateCount.toLocaleString("ko-KR")}행</b>
                </div>
                <div>
                  <small>환경 상태</small>
                  <b>{metrics.find((metric) => metric.key === "air")?.value || "기준일 확인"}</b>
                </div>
              </section>
              {relatedFacilities.length ? (
                <div className="gdp-analysis-facility-stack">
                  {showMap && linkedCoordinateCount ? (
                    <div className="gdp-analysis-mini-map">
                      <VworldMap
                        facilities={relatedFacilities}
                        selectedFacilityId={selectedFacilityId}
                        onSelectFacility={handleSelectFacility}
                        onUnavailable={handleMapUnavailable}
                      />
                    </div>
                  ) : (
                    <div className="gdp-analysis-map-fallback" role="status">
                      <strong>목록 기준으로 확인</strong>
                      <span>좌표 또는 지도 연결 상태가 충분하지 않아 같은 데이터를 목록으로 제공합니다.</span>
                    </div>
                  )}
                  <div className="gdp-analysis-facility-list" aria-label="안전·환경 시설 목록">
                    {relatedFacilities.map((facility) => (
                      <button
                        key={facility.id}
                        className={selectedFacilityId === facility.id ? "is-selected" : ""}
                        type="button"
                        aria-pressed={selectedFacilityId === facility.id}
                        onClick={() => setSelectedFacilityId(selectedFacilityId === facility.id ? "" : facility.id)}
                      >
                        <span>{facility.category}</span>
                        <strong>{facility.name}</strong>
                        <small>{facility.address}</small>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="gdp-analysis-empty">
                  <span>NO MATCHED RECORDS</span>
                  <strong>{selectedSafetyConfig?.label || "안전·환경"} · {selectedContext}</strong>
                  <p>현재 레이어와 조건에 맞는 시설이 없습니다. 위험도 판단으로 해석하지 않고 수집 상태와 원천 확인 경로를 제공합니다.</p>
                  <div>
                    <small>확인할 것</small>
                    <small>레이어 분류, 좌표 보유 여부, 지도 프록시, 공개 가능 상태</small>
                  </div>
                  <Link to={withQuery("/datasets", { q: selectedSafetyConfig?.catalogQuery || "안전 환경" })}>
                    데이터 상태 확인
                  </Link>
                  <small>{config.emptyAction.note}</small>
                </div>
              )}
              <div className="gdp-safety-actions">
                <Link to={withQuery("/nearby", { category: selectedSafetyConfig?.label || "안전", district })}>
                  시설 목록에서 계속 보기
                </Link>
                <Link to={withQuery("/datasets", { q: selectedSafetyConfig?.catalogQuery || "안전 환경" })}>
                  데이터 근거 확인
                </Link>
              </div>
            </div>
          ) : showFacilityMap && relatedFacilities.length ? (
            <div className="gdp-analysis-facility-stack">
              {showMap && linkedCoordinateCount ? (
                <div className="gdp-analysis-mini-map">
                  <VworldMap
                    facilities={relatedFacilities}
                    selectedFacilityId={selectedFacilityId}
                    onSelectFacility={handleSelectFacility}
                    onUnavailable={handleMapUnavailable}
                  />
                </div>
              ) : (
                <div className="gdp-analysis-map-fallback" role="status">
                  <strong>목록 기준으로 확인</strong>
                  <span>좌표 또는 지도 연결 상태가 충분하지 않아 같은 데이터를 목록으로 제공합니다.</span>
                </div>
              )}
              <div className="gdp-analysis-facility-list" aria-label="관련 시설 목록">
                {relatedFacilities.map((facility) => (
                  <button
                    key={facility.id}
                    className={selectedFacilityId === facility.id ? "is-selected" : ""}
                    type="button"
                    aria-pressed={selectedFacilityId === facility.id}
                    onClick={() => setSelectedFacilityId(selectedFacilityId === facility.id ? "" : facility.id)}
                  >
                    <span>{facility.category}</span>
                    <strong>{facility.name}</strong>
                    <small>{facility.address}</small>
                  </button>
                ))}
              </div>
              <Link className="gdp-analysis-more-link" to={withQuery(config.route, { map: "list", district })}>
                전체 목록에서 계속 보기
              </Link>
            </div>
          ) : relatedFacilities.length ? (
            relatedFacilities.map((facility) => (
              <Link key={facility.id} to={withQuery(config.route, { map: "list", district })}>
                <span>{facility.category}</span>
                <strong>{facility.name}</strong>
                <small>{facility.address}</small>
              </Link>
            ))
          ) : (
            <div className="gdp-analysis-empty">
              <span>NO MATCHED RECORDS</span>
              <strong>
                {selectedContext} · {query || "현재 주제"}
              </strong>
              <p>현재 조건에 맞는 시설이 없습니다. 신뢰 가능한 원천 데이터가 없는 경우 다른 주제의 시설로 대체하지 않습니다.</p>
              <div>
                <small>확인할 것</small>
                <small>카테고리 수집 상태, 좌표 보유 여부, 검색어·행정동 필터</small>
              </div>
              <Link to={config.emptyAction.to}>{config.emptyAction.label}</Link>
              <small>{config.emptyAction.note}</small>
            </div>
          )}
        </aside>
      </div>

      <section className="gdp-analysis-metrics" aria-label="대표 지표">
        {metrics.map((metric) => (
          <article key={metric.key} className={`is-${metric.accent}`}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>
              {metric.status} · {metric.source}
            </small>
          </article>
        ))}
      </section>

      <section className="gdp-analysis-context" aria-label="현재 분석 맥락">
        <article>
          <span>현재 범위</span>
          <strong>{selectedContext}</strong>
          <small>URL 공유와 화면 필터가 같은 조건을 유지하도록 설계합니다.</small>
        </article>
        <article>
          <span>연결 시설</span>
          <strong>{relatedFacilities.length.toLocaleString("ko-KR")}행</strong>
          <small>선택 주제와 검색어에 맞는 시설만 표시합니다.</small>
        </article>
        <article>
          <span>좌표 연결</span>
          <strong>
            {linkedCoordinateCount.toLocaleString("ko-KR")} / {relatedFacilities.length.toLocaleString("ko-KR")}행
          </strong>
          <small>좌표가 없는 데이터는 목록에서 근거 확인을 우선합니다.</small>
        </article>
        <article>
          <span>표현 방식</span>
          <strong>원값 중심</strong>
          <small>지역 순위·점수·우수/취약 표현을 쓰지 않습니다.</small>
        </article>
      </section>

      <section className="gdp-analysis-lens" aria-label="분석 관점">
        {config.lens.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.note}</small>
          </article>
        ))}
      </section>

      <section className="gdp-analysis-evidence" aria-label="데이터 근거">
        <header>
          <span>DATA EVIDENCE</span>
          <h2>데이터 근거와 표시 정책</h2>
          <p>
            {sourceModeLabel} · 기준 {model.asOf}. 수집 실패나 좌표 누락은 화면에서 숨기지 않고 목록·카탈로그 경로로 이어집니다.
          </p>
        </header>
        <div>
          {config.evidence.map((item) => (
            <article key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.note}</small>
            </article>
          ))}
        </div>
        <Link to={withQuery("/datasets", { q: title.replace("·", " ") })}>관련 데이터셋 확인</Link>
      </section>

      <section className="gdp-analysis-principles" aria-label="표현 원칙">
        <div>
          <span>기준</span>
          <strong>{model.asOf}</strong>
        </div>
        <div>
          <span>공개 범위</span>
          <strong>금천구 GEUMCHEON</strong>
        </div>
        <div>
          <span>표현 정책</span>
          <strong>순위·점수·우수/취약 표현 없음</strong>
        </div>
      </section>
    </section>
  );
}
