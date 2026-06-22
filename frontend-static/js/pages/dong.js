import { state } from "../core/state.js";
import { createDataState } from "../core/data-state.js";
import { escapeHtml } from "../core/dom.js";
import { renderDataStamp } from "../core/meta.js";
import { icon } from "../core/icons.js";
import { injectPageCss } from "../core/assets.js";
import { csvDataUrl, rowsToCsv } from "../core/visualization.js";
import {
  averageDistrictScore,
  averageScoreAcrossDistricts,
  formatDelta,
  getDistrictAverages,
  getElderlyRatio,
  getPopulationElderlyRatio,
  rankDistricts,
  buildDistrictComparisonRows,
} from "./dong-metrics.js";

let rootContainer = null;

export function mount(container) {
  rootContainer = container;
  injectPageCss("css-page-dong", "./css/pages/dong.css");

  const districts = Array.isArray(state.data?.districts) ? state.data.districts : [];
  const population = Array.isArray(state.data?.population) ? state.data.population : [];
  const dataState = createDataState({
    hasData: districts.length > 0 || population.length > 0,
    sourceMode: state.data?.sourceMode,
    error: state.data?.sourceModeError,
    messages: {
      empty: "비교할 데이터가 아직 준비되지 않았습니다.",
      error: "비교 데이터를 불러오는 중 문제가 발생했습니다.",
      live: "최신 연결 데이터 기준으로 권역과 인구 비교를 제공합니다.",
      stale: "일부 원천이 지연되어 마지막 정상 자료와 보강 자료를 함께 표시합니다.",
      sample: "현재는 샘플 또는 로컬 데이터 기준 비교 화면입니다.",
    },
  });
  const topDistrict = rankDistricts(districts)[0] || null;
  const lowestDistrict = rankDistricts(districts).at(-1) || null;
  const elderlyRatio = getElderlyRatio(population);
  const selectedDistrict = districts.find((district) => district.name === state.geoDistrict) || topDistrict;
  const selectedPopulation = population.find((item) => item.areaName === selectedDistrict?.name) || null;
  const districtAverages = getDistrictAverages(districts);
  const comparisonRows = buildDistrictComparisonRows(selectedDistrict, districtAverages);
  const averagePopulation = population.length
    ? population.reduce((sum, item) => sum + Number(item.total || 0), 0) / population.length
    : 0;
  const selectedElderlyRatio = getPopulationElderlyRatio(selectedPopulation);

  container.innerHTML = `
    <div class="dong-page">
      <div class="page-banner" style="--banner-from:#0e2a52;--banner-to:#245b9e">
        <div class="page-banner-icon">${icon("users", { size: 26 })}</div>
        <div class="page-banner-copy">
          <p class="page-banner-eyebrow">우리 동</p>
          <h2 class="page-banner-title">금천구 권역과 인구를 한 번에 보기</h2>
          <p class="page-banner-desc">생활 접근성 비교와 인구 구조를 같은 흐름에서 살펴보고, 필요한 화면으로 바로 이동할 수 있습니다.</p>
        </div>
        <div class="page-banner-stats">
          <div class="page-banner-stat">
            <span class="page-banner-stat-val">${districts.length || 0}</span>
            <span class="page-banner-stat-label">비교 권역</span>
          </div>
          <div class="page-banner-stat">
            <span class="page-banner-stat-val">${selectedDistrict ? escapeHtml(selectedDistrict.name.replace("동", "")) : "-"}</span>
            <span class="page-banner-stat-label">선택한 동</span>
          </div>
          <div class="page-banner-stat">
            <span class="page-banner-stat-val">${selectedElderlyRatio ? `${selectedElderlyRatio}%` : "-"}</span>
            <span class="page-banner-stat-label">선택 동 60세 이상</span>
          </div>
        </div>
        <a class="page-banner-back" href="#/home">홈으로</a>
      </div>

      <section class="dong-status-card">
        <div class="dong-status-head">
          <div>
            <p class="dong-section-eyebrow">데이터 상태</p>
            <h3>우리 동 비교 데이터 준비 상태</h3>
          </div>
          <span class="dong-state-pill dong-state-pill--${dataState.tone}">${escapeHtml(dataState.label)}</span>
        </div>
        <p class="dong-status-copy">${escapeHtml(dataState.message)}</p>
        ${renderDataStamp("geo", "권역 비교")}
        ${renderDataStamp("population", "인구 비교")}
        ${state.data?.sourceModeError ? '<p class="dong-status-note">일부 원천의 갱신이 지연되어 마지막으로 확인된 자료 또는 샘플 자료를 함께 표시합니다.</p>' : ""}
      </section>

      <section class="dong-selector" aria-labelledby="dong-selector-title">
        <div>
          <p class="dong-section-eyebrow">동 선택</p>
          <h3 id="dong-selector-title">어느 동을 구 평균과 비교할까요?</h3>
          <p>선택한 동을 기준으로 생활 접근성, 인구와 연령 구조의 차이를 먼저 요약합니다.</p>
        </div>
        <label class="dong-select-label" for="dong-select">
          비교할 동
          <select id="dong-select">
            ${districts.map((district) => `
              <option value="${escapeHtml(district.name)}"${district.name === selectedDistrict?.name ? " selected" : ""}>${escapeHtml(district.name)}</option>
            `).join("")}
          </select>
        </label>
      </section>

      <section class="dong-metrics-grid" aria-label="우리 동 요약">
        <article class="dong-metric-card">
          <p>${selectedDistrict ? escapeHtml(selectedDistrict.name) : "선택 동"} 접근성 평균</p>
          <strong>${selectedDistrict ? `${Math.round(averageDistrictScore(selectedDistrict))}점` : "-"}</strong>
          <span>${selectedDistrict ? formatDelta(averageDistrictScore(selectedDistrict), averageScoreAcrossDistricts(districts), "구 평균") : "데이터 없음"}</span>
        </article>
        <article class="dong-metric-card">
          <p>${selectedDistrict ? escapeHtml(selectedDistrict.name) : "선택 동"} 인구</p>
          <strong>${selectedPopulation ? `${Number(selectedPopulation.total || 0).toLocaleString()}명` : "-"}</strong>
          <span>${selectedPopulation ? formatDelta(Number(selectedPopulation.total || 0), averagePopulation, "동 평균", "명") : "데이터 없음"}</span>
        </article>
        <article class="dong-metric-card">
          <p>60세 이상 비중</p>
          <strong>${selectedElderlyRatio ? `${selectedElderlyRatio}%` : "-"}</strong>
          <span>${selectedElderlyRatio ? formatDelta(Number(selectedElderlyRatio), Number(elderlyRatio), "구 전체", "%p") : "데이터 없음"}</span>
        </article>
      </section>

      <section class="dong-comparison" aria-labelledby="dong-comparison-title">
        <div class="dong-summary-head">
          <h3 id="dong-comparison-title">${selectedDistrict ? escapeHtml(selectedDistrict.name) : "선택 동"}과 구 평균</h3>
          <p>점수가 높고 낮다는 사실만으로 우열을 정하지 않고, 생활 서비스와 이동 동선을 살펴볼 출발점으로 사용합니다.</p>
        </div>
        <div class="dong-score-list">
          ${renderScoreRows(comparisonRows)}
        </div>
        ${renderComparisonTable(selectedDistrict, comparisonRows)}
        ${selectedDistrict ? `<p class="dong-comparison-note">${escapeHtml(selectedDistrict.note || "")} ${escapeHtml(selectedDistrict.recommendation || "")}</p>` : ""}
      </section>

      <div class="dong-grid">
        <article class="dong-card">
          <div class="dong-card-icon">${icon("pin", { size: 18 })}</div>
          <p class="dong-card-eyebrow">권역 비교</p>
          <h3>생활·교통·안전 지수 보기</h3>
          <p>행정권역별 평균 접근성과 현재 선택한 비교 기준을 중심으로 우리 동의 특징을 확인합니다.</p>
          <ul class="dong-card-points">
            <li>비교 기준: 생활, 교통, 안전</li>
            <li>현재 선택: ${selectedDistrict ? escapeHtml(selectedDistrict.name) : "데이터 없음"}</li>
            <li>다음 행동: 세부 비교 화면으로 이동</li>
          </ul>
          <a class="dong-card-link" href="#/dong?section=accessibility&amp;district=${encodeURIComponent(selectedDistrict?.name || "")}">선택 동 세부 비교</a>
        </article>

        <article class="dong-card">
          <div class="dong-card-icon dong-card-icon--green">${icon("bar-chart", { size: 18 })}</div>
          <p class="dong-card-eyebrow">인구 구조</p>
          <h3>행정동별 인구와 연령대 보기</h3>
          <p>총인구, 성별, 고령 비중을 중심으로 우리 동과 인접 동의 인구 구조를 빠르게 확인합니다.</p>
          <ul class="dong-card-points">
            <li>비교 단위: 행정동</li>
            <li>현재 고령 비중: ${elderlyRatio ? `${elderlyRatio}%` : "데이터 없음"}</li>
            <li>다음 행동: 인구 화면으로 이동</li>
          </ul>
          <a class="dong-card-link" href="#/dong?section=population&amp;district=${encodeURIComponent(selectedDistrict?.name || "")}">선택 동 인구 분석</a>
        </article>
      </div>

      <section class="dong-summary">
        <div class="dong-summary-head">
          <h3>비교 시작점</h3>
          <p>자주 보는 권역부터 바로 들어갈 수 있도록 현재 데이터 기준 상위 권역을 노출합니다.</p>
        </div>
        <div class="dong-chip-row">
          ${rankDistricts(districts).slice(0, 6).map((district) => `
            <a class="dong-chip${district.name === selectedDistrict?.name ? " is-active" : ""}" href="#/dong?district=${encodeURIComponent(district.name)}"${district.name === selectedDistrict?.name ? ' aria-current="true"' : ""}>
              ${escapeHtml(district.name)}
            </a>
          `).join("")}
        </div>
      </section>
    </div>
  `;

  const select = container.querySelector("#dong-select");
  select?.addEventListener("change", () => {
    const district = select.value;
    location.hash = `#/dong?district=${encodeURIComponent(district)}`;
  });
}

export function unmount() {
  rootContainer = null;
}

export function refresh() {
  if (rootContainer) mount(rootContainer);
}

function renderScoreRows(rows) {
  if (!rows.length) return '<p class="dong-empty">비교할 권역 데이터가 없습니다.</p>';
  return rows.map(({ metric, value, average, summary }) => {
    return `
      <div class="dong-score-row">
        <div class="dong-score-label">
          <strong>${escapeHtml(metric)}</strong>
          <span>${value}점 · 구 평균 ${average.toFixed(1)}점</span>
        </div>
        <div class="dong-score-track" aria-hidden="true">
          <span class="dong-score-average" style="left:${Math.min(100, Math.max(0, average))}%"></span>
          <span class="dong-score-value" style="width:${Math.min(100, Math.max(0, value))}%"></span>
        </div>
        <span class="dong-score-delta">${escapeHtml(summary)}</span>
      </div>
    `;
  }).join("");
}

function renderComparisonTable(district, rows) {
  if (!district || !rows.length) return "";
  const csv = rowsToCsv(
    ["행정동", "지표", "선택 동 점수", "구 평균", "차이"],
    rows.map((row) => [district.name, row.metric, row.value, row.average.toFixed(1), row.delta.toFixed(1)])
  );
  return `
    <div class="dong-comparison-data">
      <a class="dong-download-link" href="${csvDataUrl(csv)}" download="geumcheon-dong-comparison.csv">비교표 CSV 내려받기</a>
      <div class="dong-table-wrap" tabindex="0">
        <table class="dong-comparison-table" aria-label="${escapeHtml(district.name)} 구 평균 비교 정확값">
          <thead><tr><th scope="col">지표</th><th scope="col">${escapeHtml(district.name)}</th><th scope="col">구 평균</th><th scope="col">차이</th></tr></thead>
          <tbody>${rows.map((row) => `
            <tr><th scope="row">${escapeHtml(row.metric)}</th><td>${row.value.toFixed(1)}점</td><td>${row.average.toFixed(1)}점</td><td>${row.delta > 0 ? "+" : ""}${row.delta.toFixed(1)}점</td></tr>
          `).join("")}</tbody>
        </table>
      </div>
    </div>
  `;
}
