// 데이터 출처·기준시각 표시 유틸: state.data.meta를 읽어 출처 표기를 생성한다

import { state, DEFAULT_SECTION_META } from "./state.js";
import { escapeHtml } from "./dom.js";

/** 섹션별 메타(출처, 기준시각)를 반환한다. 백엔드 응답이 있으면 우선 사용한다. */
export function getSectionMeta(sectionKey) {
  const fallback = DEFAULT_SECTION_META[sectionKey] || DEFAULT_SECTION_META.overview;
  const meta = state.data?.meta?.[sectionKey] || {};
  return {
    source: meta.source || fallback.source,
    asOf: meta.asOf || fallback.asOf
  };
}

/** 화면 하단에 표시하는 "출처 ○○ · 기준시각 ○○" 문자열 HTML을 반환한다. */
export function renderDataStamp(sectionKey, detail = "") {
  const { source, asOf } = getSectionMeta(sectionKey);
  const detailSuffix = detail ? ` · ${escapeHtml(detail)}` : "";
  return `<p class="data-stamp">출처 ${escapeHtml(source)} · 기준시각 ${escapeHtml(asOf)}${detailSuffix}</p>`;
}

/**
 * meta 객체의 overview.source를 갱신해 새 객체를 반환한다.
 * 원본 meta를 직접 수정하지 않는다.
 */
export function updateOverviewMeta(meta, source) {
  return {
    ...meta,
    overview: {
      ...(meta?.overview || {}),
      source
    }
  };
}

/** 데이터 소스 모드 코드를 사람이 읽기 쉬운 한국어로 변환한다. */
export function sourceModeText(mode) {
  const normalized = String(mode || "").trim().toLowerCase();
  if (normalized === "db") {
    return "DB 데이터";
  }
  if (normalized === "mixed") {
    return "혼합 데이터";
  }
  if (normalized === "mock") {
    return "Mock 데이터";
  }
  if (normalized === "local") {
    return "로컬 샘플";
  }
  return "Mock 데이터";
}
