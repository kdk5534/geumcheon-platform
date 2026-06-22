import { state } from "../core/state.js";
import { createDataState } from "../core/data-state.js";
import { escapeHtml } from "../core/dom.js";
import { renderDataStamp } from "../core/meta.js";
import { icon } from "../core/icons.js";
import { injectPageCss } from "../core/assets.js";

let rootContainer = null;

export function mount(container) {
  rootContainer = container;
  injectPageCss("css-page-topics", "./css/pages/topics.css");

  const metrics = Array.isArray(state.data?.metrics) ? state.data.metrics : [];
  const facilities = Array.isArray(state.data?.facilities) ? state.data.facilities : [];
  const topicState = createDataState({
    hasData: metrics.length > 0 || facilities.length > 0,
    sourceMode: state.data?.sourceMode,
    error: state.data?.sourceModeError,
    messages: {
      empty: "표시할 분야별 데이터가 아직 준비되지 않았습니다.",
      error: "분야별 데이터를 불러오는 중 문제가 발생했습니다.",
      live: "최신 연결 데이터 기준으로 분야별 탐색을 제공합니다.",
      stale: "일부 원천이 지연되어 마지막 정상 자료와 보강 자료를 함께 표시합니다.",
      sample: "현재는 샘플 또는 로컬 데이터 기준 분야별 화면입니다.",
    },
  });

  container.innerHTML = `
    <div class="topics-page">
      <div class="page-banner" style="--banner-from:#173b2f;--banner-to:#0d7b5f">
        <div class="page-banner-icon">${icon("bar-chart", { size: 26 })}</div>
        <div class="page-banner-copy">
          <p class="page-banner-eyebrow">분야별</p>
          <h2 class="page-banner-title">질문 중심으로 들어가는 금천 데이터</h2>
          <p class="page-banner-desc">안전 현황, 상권 변화, 주요 지표, 원본 데이터까지 이어지는 탐색 흐름을 하나의 허브로 묶었습니다.</p>
        </div>
        <div class="page-banner-stats">
          <div class="page-banner-stat">
            <span class="page-banner-stat-val">${metrics.length || 0}</span>
            <span class="page-banner-stat-label">홈 요약 지표</span>
          </div>
          <div class="page-banner-stat">
            <span class="page-banner-stat-val">${facilities.length || 0}</span>
            <span class="page-banner-stat-label">생활시설 데이터</span>
          </div>
          <div class="page-banner-stat">
            <span class="page-banner-stat-val">${escapeHtml(topicState.label)}</span>
            <span class="page-banner-stat-label">현재 상태</span>
          </div>
        </div>
        <a class="page-banner-back" href="#/home">홈으로</a>
      </div>

      <section class="topics-status-card">
        <div class="topics-status-head">
          <div>
            <p class="topics-section-eyebrow">탐색 상태</p>
            <h3>분야별 허브 데이터 준비 상태</h3>
          </div>
          <span class="topics-state-pill topics-state-pill--${topicState.tone}">${escapeHtml(topicState.label)}</span>
        </div>
        <p class="topics-status-copy">${escapeHtml(topicState.message)}</p>
        ${renderDataStamp("overview", "분야별 허브")}
        ${state.data?.sourceModeError ? '<p class="topics-status-note">일부 원천의 갱신이 지연되어 마지막으로 확인된 자료 또는 샘플 자료를 함께 표시합니다.</p>' : ""}
      </section>

      <div class="topics-grid">
        ${buildTopicCard({
          href: "#/topics?topic=safety",
          eyebrow: "안전·재난",
          title: "오늘 이동하거나 생활할 때 주의할 일이 있나요?",
          desc: "교통 통제와 안전 알림을 확인하고 필요한 행동 안내로 이어갑니다.",
          meta: getMetricMeta("교통 알림"),
          iconName: "activity",
          actionLabel: "주의 현황 보기"
        })}
        ${buildTopicCard({
          href: "#/nearby?category=주차장",
          eyebrow: "교통·이동",
          title: "가까운 주차장이나 이동 수단은 어디에 있나요?",
          desc: "주차장과 따릉이 위치를 목록과 지도에서 함께 확인합니다.",
          meta: `${countFacilities("주차장") + countFacilities("따릉이")}개 이동 시설 연결`,
          iconName: "map",
          actionLabel: "이동 시설 찾기"
        })}
        ${buildTopicCard({
          href: "#/nearby?category=병원",
          eyebrow: "보건·복지",
          title: "가까운 병원과 생활 지원 시설을 어떻게 찾나요?",
          desc: "병원·약국·쉼터의 주소와 연락 행동을 우선 제공합니다.",
          meta: `${countFacilities("병원") + countFacilities("약국") + countFacilities("쉼터")}개 관련 시설 연결`,
          iconName: "heart",
          actionLabel: "보건·복지 시설 찾기"
        })}
        ${buildTopicCard({
          href: "#/nearby?category=보호구역",
          eyebrow: "교육·돌봄",
          title: "아이의 통학과 돌봄 주변 환경은 안전한가요?",
          desc: "어린이 보호구역과 주변 안전시설을 위치 기준으로 살펴봅니다.",
          meta: `${countFacilities("보호구역")}개 보호구역 연결`,
          iconName: "users",
          actionLabel: "교육·돌봄 주변 보기"
        })}
        ${buildTopicCard({
          href: "#/indicators",
          eyebrow: "환경·생활",
          title: "오늘 대기 상태와 생활환경은 어떤가요?",
          desc: "미세먼지 상태에서 출발해 환경 지표와 원자료를 확인합니다.",
          meta: getMetricMeta("미세먼지"),
          iconName: "filter",
          actionLabel: "환경 지표 보기"
        })}
        ${buildTopicCard({
          href: "#/topics?topic=economy",
          eyebrow: "지역경제·상권",
          title: "우리 동네 상권과 업종은 어떻게 달라지고 있나요?",
          desc: "업종별 점포 분포와 월별 추이를 중심으로 지역 경제 흐름을 봅니다.",
          meta: getEconomyMeta(),
          iconName: "shopping-bag",
          actionLabel: "상권 변화 보기"
        })}
      </div>

      <section class="topics-metrics-grid" aria-label="분야별 빠른 요약">
        <article class="topics-metric-card">
          <p>실시간 확인 포인트</p>
          <strong>${escapeHtml(getMetricValue("미세먼지") || "-")}</strong>
          <span>${escapeHtml(getMetricNote("미세먼지") || "실시간 대기 정보")}</span>
        </article>
        <article class="topics-metric-card">
          <p>상권 탐색 시작점</p>
          <strong>${escapeHtml(state.industry || "카페")}</strong>
          <span>${escapeHtml(getEconomyMeta())}</span>
        </article>
        <article class="topics-metric-card">
          <p>원본 데이터 확인</p>
          <strong>${facilities.length.toLocaleString()}</strong>
          <span>생활시설과 공개 데이터셋을 데이터 찾기에서 이어서 확인</span>
        </article>
      </section>

      <section class="topics-footer-callout">
        <div>
          <h3>원본 데이터까지 이어보기</h3>
          <p>지표를 본 뒤 출처와 갱신 주기를 확인하려면 데이터 찾기로 이동하세요.</p>
        </div>
        <a class="topics-callout-link" href="#/datasets">데이터 찾기 열기</a>
      </section>
    </div>
  `;
}

export function unmount() {
  rootContainer = null;
}

export function refresh() {
  if (rootContainer) mount(rootContainer);
}

function buildTopicCard({ href, eyebrow, title, desc, meta, iconName, actionLabel }) {
  return `
    <article class="topics-card">
      <div class="topics-card-icon">${icon(iconName, { size: 18 })}</div>
      <p class="topics-card-eyebrow">${escapeHtml(eyebrow)}</p>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(desc)}</p>
      <span class="topics-card-meta"><b>대표 정보</b> ${escapeHtml(meta)}</span>
      <div class="topics-card-actions">
        <a class="topics-card-link" href="${href}">${escapeHtml(actionLabel || "바로 보기")}</a>
        <a class="topics-card-source" href="#/datasets">원자료 찾기</a>
      </div>
    </article>
  `;
}

function countFacilities(category) {
  const facilities = Array.isArray(state.data?.facilities) ? state.data.facilities : [];
  return facilities.filter((facility) => facility.category === category).length;
}

function getEconomyMeta() {
  const commercial = state.data?.commercial?.[state.industry];
  if (!commercial) {
    return "상권 데이터 준비 중";
  }
  return `${state.industry} ${Number(commercial.total || 0).toLocaleString()}개소`;
}

function getMetricMeta(label) {
  const metric = findMetric(label);
  if (!metric) {
    return "관련 지표 준비 중";
  }
  return `${metric.value} · ${metric.badge || "지표"}`;
}

function getMetricValue(label) {
  return findMetric(label)?.value || "";
}

function getMetricNote(label) {
  return findMetric(label)?.note || "";
}

function findMetric(label) {
  const metrics = Array.isArray(state.data?.metrics) ? state.data.metrics : [];
  return metrics.find((item) => item.label === label) || null;
}
