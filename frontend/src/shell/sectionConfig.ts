export type SectionKey = "home" | "population" | "commercial" | "welfare" | "safety" | "catalog";

export interface SectionNavItem {
  label: string;
  to: string;
  pages: string[];
}

export interface SectionConfig {
  title: string;
  documentTitle: string;
  items: SectionNavItem[];
}

export const sectionConfig: Record<SectionKey, SectionConfig> = {
  home: {
    title: "종합 현황",
    documentTitle: "종합 현황",
    items: [
      { label: "대시보드", to: "/home", pages: ["home"] },
      { label: "최근 도시현황", to: "/realtime", pages: ["realtime"] },
      { label: "핵심 지표", to: "/indicators", pages: ["indicators"] },
    ],
  },
  population: {
    title: "인구·생활",
    documentTitle: "인구·생활 분석",
    items: [
      { label: "인구 구조", to: "/population", pages: ["population"] },
      { label: "생활시설 지도", to: "/nearby", pages: ["nearby"] },
      { label: "접근성·권역 지도", to: "/geo", pages: ["geo"] },
      { label: "분야별 생활 데이터", to: "/topics", pages: ["topics"] },
    ],
  },
  commercial: {
    title: "상권·경제",
    documentTitle: "상권·경제 분석",
    items: [
      { label: "상권 현황", to: "/commercial", pages: ["commercial"] },
      { label: "지역별 비교", to: "/dong", pages: ["dong"] },
      { label: "관련 데이터셋", to: "/datasets", pages: ["datasets"] },
    ],
  },
  welfare: {
    title: "복지·건강",
    documentTitle: "복지·건강 정보",
    items: [
      { label: "필요한 도움", to: "/welfare", pages: ["welfare"] },
      { label: "복지시설 찾기", to: "/nearby?category=복지", pages: ["nearby"] },
      { label: "관련 데이터", to: "/datasets?topic=welfare", pages: ["datasets"] },
    ],
  },
  safety: {
    title: "안전·환경",
    documentTitle: "안전·환경 현황",
    items: [
      { label: "통합 상황 지도", to: "/safety", pages: ["safety"] },
      { label: "안전시설 목록", to: "/nearby?category=CCTV", pages: ["nearby"] },
      { label: "관련 데이터", to: "/datasets?topic=safety", pages: ["datasets"] },
    ],
  },
  catalog: {
    title: "데이터 카탈로그",
    documentTitle: "데이터 카탈로그",
    items: [
      { label: "데이터셋 검색", to: "/datasets", pages: ["datasets"] },
      { label: "데이터 이용안내", to: "/about", pages: ["about"] },
      { label: "API 수집 현황", to: "/api-status", pages: ["api-status"] },
      { label: "수집 로그", to: "/api-logs", pages: ["api-logs"] },
    ],
  },
};

export function routeToSection(pathname: string, search: string): SectionKey | "" {
  const path = pathname.replace(/^\//, "") || "home";
  const params = new URLSearchParams(search);

  if (path === "home" || path === "realtime" || path === "indicators") return "home";
  if (path === "population" || path === "topics" || path === "geo") return "population";
  if (path === "commercial" || path === "dong") return "commercial";
  if (path === "welfare") return "welfare";
  if (path === "safety") return "safety";
  if (path === "datasets" || path === "about" || path === "api-status" || path === "api-logs") return "catalog";
  if (path === "nearby" || path === "map") {
    const explicit = params.get("nav") || params.get("section");
    if (explicit === "welfare" || explicit === "safety" || explicit === "commercial" || explicit === "population") {
      return explicit;
    }
    const category = (params.get("category") || "").toLocaleLowerCase("ko-KR");
    if (["복지", "병원", "약국", "의료", "돌봄", "어르신", "장애", "쉼터"].some((word) => category.includes(word))) {
      return "welfare";
    }
    if (["cctv", "안전", "보호구역", "스쿨존", "대피", "대기", "환경"].some((word) => category.includes(word))) {
      return "safety";
    }
    return "population";
  }
  return "";
}

export function currentPageKey(pathname: string) {
  return pathname.replace(/^\//, "") || "home";
}
