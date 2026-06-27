import { state } from "../core/state.js";
import { escapeHtml } from "../core/dom.js";
import { icon } from "../core/icons.js";
import { getSectionMeta, sourceModeText } from "../core/meta.js";

function popularSkeleton() {
  return Array.from({ length: 4 }, () => `<div class="skeleton overview-dataset-skeleton"></div>`).join("");
}

function dongRows() {
  const population = Array.isArray(state.data?.population) ? state.data.population : [];
  if (!population.length) {
    return `<div class="overview-empty">표시 가능한 행정동 인구 데이터가 없습니다.</div>`;
  }
  return population.slice(0, 5).map((item) => `
    <button class="overview-dong-row" type="button" data-dong="${escapeHtml(item.areaName || "")}">
      <span class="overview-dong-name">${escapeHtml(item.areaName || "행정동")}</span>
      <span class="overview-dong-bar"><i style="--dong-ratio:${Math.min(100, Math.max(8, Number(item.total || 0) / 500))}%"></i></span>
      <strong>${Number(item.total || 0).toLocaleString("ko-KR")}명</strong>
      ${icon("chevron-right", { size: 15 })}
    </button>
  `).join("");
}

function mapFallbackRows() {
  const facilities = Array.isArray(state.data?.facilities) ? state.data.facilities : [];
  if (!facilities.length) {
    return `<div class="overview-map-empty"><strong>표시 가능한 공개 시설이 없습니다.</strong><span>데이터 카탈로그에서 수집 상태와 공개 여부를 확인해 주세요.</span></div>`;
  }
  const categories = [...new Set(facilities.map((item) => item.category || "시설"))].slice(0, 4);
  const rows = facilities.slice(0, 12).map((item) => `<div class="overview-map-list-row"><i></i><div><strong>${escapeHtml(item.name || "시설")}</strong><span>${escapeHtml(item.address || "주소 정보 없음")}</span></div><small>${escapeHtml(item.category || "시설")}</small></div>`).join("");
  return `
    <div class="overview-map-fallback-board">
      <div class="overview-map-fallback-visual">
        <div class="overview-map-fallback-status"><span>VWorld 연결 대기</span><strong>목록 모드로 동일 과업 수행</strong></div>
        <div class="overview-map-abstract" aria-hidden="true">
          <i style="--x:22%;--y:26%;--c:#3159d8"></i>
          <i style="--x:48%;--y:38%;--c:#19a88a"></i>
          <i style="--x:68%;--y:28%;--c:#ef6b5b"></i>
          <i style="--x:36%;--y:62%;--c:#d49324"></i>
          <i style="--x:76%;--y:70%;--c:#3159d8"></i>
          <span>GEUMCHEON</span>
        </div>
        <div class="overview-map-fallback-legend">
          ${categories.map((category) => `<span><i></i>${escapeHtml(category)}</span>`).join("")}
        </div>
      </div>
      <div class="overview-map-fallback-list">
        ${rows}
      </div>
    </div>
  `;
}

export function buildDashHtml() {
  const { asOf } = getSectionMeta("overview");
  const sourceText = state.data ? sourceModeText(state.data.sourceMode) : "데이터 확인 중";
  const facilities = Array.isArray(state.data?.facilities) ? state.data.facilities.length : 0;
  const populationTotal = Array.isArray(state.data?.population)
    ? state.data.population.reduce((sum, item) => sum + Number(item.total || 0), 0)
    : 0;
  const sourceCount = Array.isArray(state.apiSources) ? state.apiSources.length : 0;

  return `
    <div class="home-dash home-dash-v2 urban-overview">
      <header class="overview-workbench">
        <div class="overview-title-block">
          <div class="overview-kicker"><span>GEUMCHEON COMMAND VIEW</span><i></i><span>${escapeHtml(asOf)} 기준</span></div>
          <h1>금천구 도시 데이터 관제 화면</h1>
          <p>공간 지도에서 출발해 인구·상권·복지·안전 데이터를 같은 필터와 근거 체계로 확인합니다.</p>
        </div>
        <div class="overview-toolbar" aria-label="대시보드 도구">
          <button type="button" data-shell-action="share">${icon("arrow-right", { size: 15 })}<span>공유</span></button>
          <button type="button" data-shell-action="csv">${icon("file", { size: 15 })}<span>CSV</span></button>
          <button type="button" data-shell-action="print">${icon("file", { size: 15 })}<span>PDF</span></button>
        </div>
      </header>

      <section class="overview-brief-strip" aria-label="현재 대시보드 분석 맥락">
        <article>
          <span>분석 범위</span>
          <strong>금천구 전체</strong>
          <p>인접 지역은 기본 분석에서 제외</p>
        </article>
        <article>
          <span>대표 지표</span>
          <strong>${populationTotal ? populationTotal.toLocaleString("ko-KR") : "—"}명</strong>
          <p>주민등록 인구 원값</p>
        </article>
        <article>
          <span>공간 데이터</span>
          <strong>${facilities ? facilities.toLocaleString("ko-KR") : "—"}행</strong>
          <p>지도 실패 시 목록으로 대체</p>
        </article>
        <article>
          <span>데이터 상태</span>
          <strong>${escapeHtml(sourceText)}</strong>
          <p>${sourceCount ? `${sourceCount.toLocaleString("ko-KR")}개 소스 연결` : escapeHtml(asOf)}</p>
        </article>
      </section>

      <section class="overview-command-grid overview-command-grid--prime" aria-label="공간 현황과 연동 분석">
        <article class="overview-map-card">
          <div class="overview-card-header">
            <div><span>SPATIAL CANVAS</span><h2 id="overview-map-title">인구 공간 현황</h2><p>금천구 경계 안의 데이터만 표시합니다.</p></div>
            <div class="overview-map-tools">
              <button type="button" data-map-mode="map" class="is-active">지도</button>
              <button type="button" data-map-mode="list">목록</button>
            </div>
          </div>
          <div id="home-map-pane" class="home-map-pane" role="region" aria-label="금천구 공간 데이터 지도"></div>
          <div id="home-map-fallback" class="overview-map-fallback" role="region" aria-label="시설 목록" tabindex="0" hidden>${mapFallbackRows()}</div>
          <div class="overview-map-footer">
            <span><i class="map-key map-key--cobalt"></i>현재 주제</span>
            <span><i class="map-key map-key--muted"></i>행정동 경계</span>
            <strong>공개 범위 GEUMCHEON · 등록 시설 ${facilities ? facilities.toLocaleString("ko-KR") : "—"}행</strong>
          </div>
        </article>

        <aside class="overview-analysis-panel">
          <div class="overview-analysis-head">
            <div><span>CONTROL PANEL</span><h2 id="overview-analysis-title">인구 구성</h2></div>
            <span class="home-mode-badge" id="home-mode-badge">${escapeHtml(sourceText)}</span>
          </div>
          <div class="overview-topic-stack" aria-labelledby="overview-topic-title">
            <div class="overview-topic-stack-head">
              <div><span>STEP 01</span><strong id="overview-topic-title">관심 주제 선택</strong></div>
              <label for="overview-dong-select">지역
                <select id="overview-dong-select"><option value="">금천구 전체</option></select>
              </label>
            </div>
            <div class="overview-topic-buttons" role="group" aria-label="관심 주제">
              <button class="is-active" type="button" data-overview-topic="population"><i class="topic-mark topic-mark--cobalt"></i><span>인구</span><small>거주와 구성</small></button>
              <button type="button" data-overview-topic="commercial"><i class="topic-mark topic-mark--coral"></i><span>상권</span><small>업종과 변화</small></button>
              <button type="button" data-overview-topic="welfare"><i class="topic-mark topic-mark--mint"></i><span>복지</span><small>도움과 시설</small></button>
              <button type="button" data-overview-topic="safety"><i class="topic-mark topic-mark--amber"></i><span>안전</span><small>환경과 대피</small></button>
            </div>
          </div>
          <div id="home-hero-stats" class="overview-mini-stats" aria-label="현재 화면 요약"></div>
          <div class="overview-analysis-chart" id="home-right-pop"></div>
          <div class="overview-analysis-chart is-hidden" id="home-right-donut"></div>
          <div class="overview-selection" aria-live="polite">
            <span>현재 선택</span>
            <strong id="overview-selection-label">금천구 전체 · 인구</strong>
            <button type="button" id="overview-clear-filter">전체 해제</button>
          </div>
          <div class="overview-dong-list" id="overview-dong-list">${dongRows()}</div>
          <a class="overview-detail-link" href="#/population">인구·생활 상세 분석 ${icon("arrow-right", { size: 15 })}</a>
        </aside>
      </section>

      <section class="overview-executive-strip" aria-label="종합 현황 요약">
        <article>
          <span>공개 범위</span>
          <strong>GEUMCHEON</strong>
          <p>인접 지역을 기본 분석에 포함하지 않습니다.</p>
        </article>
        <article>
          <span>인구</span>
          <strong><b id="overview-pop-total">—</b><small>만 명</small></strong>
          <p>행정동별 원값 기준</p>
        </article>
        <article>
          <span>생활시설</span>
          <strong><b id="overview-facility-total">—</b><small>행</small></strong>
          <p>시설 고유 수와 다를 수 있음</p>
        </article>
        <article>
          <span>연결 소스</span>
          <strong><b id="overview-source-total">—</b><small>종</small></strong>
          <p>수집 상태는 하단 근거에서 확인</p>
        </article>
      </section>

      <section class="overview-kpi-section" aria-labelledby="overview-kpi-title">
        <div class="overview-section-heading">
          <div><span>KEY MEASURES</span><h2 id="overview-kpi-title">핵심 측정값</h2></div>
          <p>평가나 순위가 아닌 원값과 출처를 제공합니다.</p>
        </div>
        <div class="home-kpi-grid" id="home-kpi-grid">
          ${Array.from({ length: 4 }, () => `<div class="skeleton overview-kpi-skeleton"></div>`).join("")}
        </div>
      </section>

      <section class="overview-provenance" aria-labelledby="overview-provenance-title">
        <div class="overview-section-heading">
          <div><span>DATA PROVENANCE</span><h2 id="overview-provenance-title">데이터 상태와 근거</h2></div>
          <a href="#/datasets">데이터 카탈로그에서 확인</a>
        </div>
        <div class="overview-provenance-grid">
          <div class="home-data-state" id="home-data-state" aria-live="polite"></div>
          <div class="overview-source-notes">
            <span>공간 범위</span><strong>금천구 GEUMCHEON</strong>
            <span>좌표 기준</span><strong>WGS84 / EPSG:4326</strong>
            <span>표시 원칙</span><strong>마지막 정상 스냅샷 유지</strong>
          </div>
        </div>
      </section>

      <section class="overview-insight-section" aria-labelledby="overview-insight-title">
        <div class="overview-section-heading">
          <div><span>CONNECTED VIEWS</span><h2 id="overview-insight-title">연결 분석</h2></div>
          <p>차트의 항목을 선택하면 같은 범위의 데이터로 좁혀집니다.</p>
        </div>
        <div class="overview-insight-grid">
          <article class="home-insight-card"><div class="home-insight-header"><div><span>상권·경제</span><h3>업종별 점포 구성</h3></div><a href="#/commercial">상세 ${icon("arrow-right", { size: 14 })}</a></div><div class="home-insight-chart" id="insight-commercial-chart"></div></article>
          <article class="home-insight-card"><div class="home-insight-header"><div><span>인구·생활</span><h3>행정동별 인구</h3></div><a href="#/population">상세 ${icon("arrow-right", { size: 14 })}</a></div><div class="home-insight-chart" id="insight-population-chart"></div></article>
          <article class="home-insight-card"><div class="home-insight-header"><div><span>데이터 카탈로그</span><h3>자주 확인하는 데이터</h3></div><a href="#/datasets">전체 ${icon("arrow-right", { size: 14 })}</a></div><div id="home-popular-datasets" class="home-popular-grid">${popularSkeleton()}</div></article>
        </div>
      </section>

      <div id="home-rt-summary" class="sr-only" aria-hidden="true"><span id="rt-critical">—</span><span id="rt-warning">—</span><span id="rt-normal">—</span></div>
      <span id="home-eyebrow" class="sr-only">${escapeHtml(asOf)} 기준</span>
      <div id="home-metrics" class="sr-only"></div>
      <div id="home-env-widgets" class="sr-only"></div>
    </div>
  `;
}
