// 행정동·접근성 지표 비교 화면 — 권역별 생활·교통·안전 점수를 비교합니다
import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { LegacyGridContainLabel } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import { Link } from "react-router-dom";
import { usePublicData } from "../../data/PublicDataContext";

echarts.use([BarChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer, LegacyGridContainLabel]);

const GEO_METRICS = ["생활", "교통", "안전"] as const;
type GeoMetric = (typeof GEO_METRICS)[number];

interface GeoDistrict {
  name: string;
  zone: string;
  scores: Record<GeoMetric, number>;
  note: string;
}

const SAMPLE_DISTRICTS: GeoDistrict[] = [
  {
    name: "가산동",
    zone: "상권·업무",
    scores: { 생활: 86, 교통: 94, 안전: 68 },
    note: "교통 접근성이 뛰어나고 상권이 밀집한 권역입니다.",
  },
  {
    name: "독산동",
    zone: "주거·생활",
    scores: { 생활: 79, 교통: 73, 안전: 81 },
    note: "생활시설과 안전시설 균형이 좋아 주민 체감도가 높습니다.",
  },
  {
    name: "시흥동",
    zone: "생활·교육",
    scores: { 생활: 74, 교통: 69, 안전: 84 },
    note: "학교·생활시설이 고르게 있고 안전 지표가 강한 편입니다.",
  },
];

const SAMPLE_ACCESS = [
  { name: "의료 접근성", score: 82 },
  { name: "교통 접근성", score: 76 },
  { name: "안전시설 접근성", score: 69 },
  { name: "생활편의 접근성", score: 88 },
];

interface MetricBarChartProps {
  districts: GeoDistrict[];
  metric: GeoMetric;
  selectedDistrict: string;
}

function MetricBarChart({ districts, metric, selectedDistrict }: MetricBarChartProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current || !districts.length) return undefined;
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    const avg = Math.round(districts.reduce((s, d) => s + d.scores[metric], 0) / districts.length);

    chart.setOption({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: {
        data: [metric, "구 평균"],
        right: 0,
        top: 0,
        textStyle: { color: "#607487", fontSize: 11 },
        itemWidth: 10,
        itemHeight: 10,
      },
      grid: { left: 12, right: 14, top: 36, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: districts.map((d) => d.name),
        axisLabel: { color: "#607487", fontSize: 12 },
        axisLine: { lineStyle: { color: "#dbe4ee" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        min: 50,
        max: 100,
        splitLine: { lineStyle: { color: "#edf2f7" } },
        axisLabel: { color: "#8497a8", fontSize: 11 },
        axisLine: { show: false },
      },
      series: [
        {
          name: metric,
          type: "bar",
          data: districts.map((d) => ({
            value: d.scores[metric],
            itemStyle: {
              color: selectedDistrict && selectedDistrict !== d.name ? "#b8c6d6" : "#3159d8",
              borderRadius: [4, 4, 0, 0],
            },
          })),
          barMaxWidth: 48,
          label: { show: true, position: "top", color: "#3e4f5e", fontSize: 11 },
        },
        {
          name: "구 평균",
          type: "bar",
          data: districts.map(() => avg),
          barMaxWidth: 48,
          itemStyle: { color: "#b8c6d6", borderRadius: [4, 4, 0, 0] },
          label: { show: true, position: "top", color: "#8497a8", fontSize: 11 },
        },
      ],
    });

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [districts, metric, selectedDistrict]);

  return (
    <div
      ref={ref}
      style={{ height: 200 }}
      role="img"
      aria-label={`행정동별 ${metric} 지표 비교 막대 차트`}
    />
  );
}

function AccessBarChart() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return undefined;
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });

    chart.setOption({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 12, right: 28, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: "value",
        max: 100,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#edf2f7" } },
        axisLabel: { color: "#8497a8", fontSize: 11 },
      },
      yAxis: {
        type: "category",
        data: SAMPLE_ACCESS.map((a) => a.name),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#3e4f5e", fontSize: 11 },
      },
      series: [
        {
          type: "bar",
          data: SAMPLE_ACCESS.map((a) => ({
            value: a.score,
            itemStyle: {
              color: a.score >= 80 ? "#3159d8" : a.score >= 75 ? "#00a88f" : "#d49324",
              borderRadius: [0, 4, 4, 0],
            },
          })),
          label: {
            show: true,
            position: "right",
            color: "#8497a8",
            fontSize: 11,
            formatter: (p: { value: number }) => `${p.value}점`,
          },
          barMaxWidth: 28,
        },
      ],
    });

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{ height: 170 }}
      role="img"
      aria-label="생활 접근성 지수 가로 막대 차트"
    />
  );
}

export function GeoPage() {
  const { model } = usePublicData();
  const [selectedMetric, setSelectedMetric] = useState<GeoMetric>("생활");
  const [selectedDistrict, setSelectedDistrict] = useState(SAMPLE_DISTRICTS[0].name);

  const populationMap = useMemo(
    () => new Map(model.populationSeries.map((item) => [item.name, item.value])),
    [model.populationSeries],
  );

  const selected = SAMPLE_DISTRICTS.find((d) => d.name === selectedDistrict) || SAMPLE_DISTRICTS[0];

  const scores = GEO_METRICS.map((m) => {
    const values = SAMPLE_DISTRICTS.map((d) => d.scores[m]);
    const avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
    const score = selected.scores[m];
    const rank = values.filter((v) => v > score).length + 1;
    return { metric: m, score, avg, rank, total: SAMPLE_DISTRICTS.length };
  });

  const currentScore = scores.find((s) => s.metric === selectedMetric) || scores[0];
  const hasPopulation = model.populationSeries.length > 0;

  return (
    <section className="gdp-geo-page" aria-labelledby="geo-title">
      <header className="gdp-operational-hero">
        <div>
          <span>ACCESSIBILITY &amp; DISTRICT</span>
          <h1 id="geo-title">접근성·권역 지도</h1>
          <p>
            행정동별 생활·교통·안전 접근성 지표를 비교합니다. 점수는 시범 데이터이며
            실 수집이 완료되면 자동으로 갱신됩니다.
          </p>
        </div>
        <Link to="/nearby">시설 지도로 보기</Link>
      </header>

      <aside className="gdp-geo-notice" role="note">
        <strong>접근성 점수는 시범 데이터입니다.</strong>
        {" "}실 수집 승인 후 갱신되며, 현재 표시 값은 방향성 참고용입니다.
        {" "}<Link to="/datasets">데이터 상태 보기</Link>
      </aside>

      <section className="gdp-geo-controls" aria-label="비교 조건 선택">
        <div className="gdp-geo-control-row">
          <fieldset className="gdp-geo-fieldset">
            <legend>비교 기준</legend>
            <div className="gdp-geo-button-group" role="group">
              {GEO_METRICS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={selectedMetric === m ? "is-active" : ""}
                  onClick={() => setSelectedMetric(m)}
                  aria-pressed={selectedMetric === m}
                >
                  {m}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="gdp-geo-fieldset">
            <legend>권역 선택</legend>
            <div className="gdp-geo-button-group gdp-geo-district-group" role="group">
              {SAMPLE_DISTRICTS.map((d) => (
                <button
                  key={d.name}
                  type="button"
                  className={selectedDistrict === d.name ? "is-active" : ""}
                  onClick={() => setSelectedDistrict(d.name)}
                  aria-pressed={selectedDistrict === d.name}
                >
                  <span>{d.name}</span>
                  <small>{d.zone}</small>
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </section>

      <section className="gdp-geo-kpi-row" aria-label="선택 권역 지표 요약">
        <article>
          <span>선택 권역</span>
          <strong>{selected.name}</strong>
          <small>{selected.zone}</small>
        </article>
        <article>
          <span>{selectedMetric} 점수</span>
          <strong>{currentScore.score}점</strong>
          <small>
            {currentScore.rank}위 / {currentScore.total}개 권역
          </small>
        </article>
        <article>
          <span>구 평균 ({selectedMetric})</span>
          <strong>{currentScore.avg}점</strong>
          <small>금천구 전체</small>
        </article>
        {hasPopulation && populationMap.has(selected.name) ? (
          <article>
            <span>주민등록 인구</span>
            <strong>{(populationMap.get(selected.name) || 0).toLocaleString("ko-KR")}명</strong>
            <small>{model.asOf}</small>
          </article>
        ) : null}
      </section>

      <div className="gdp-geo-charts">
        <div className="gdp-geo-chart-card">
          <h2 className="gdp-geo-chart-title">{selectedMetric} 권역 비교</h2>
          <MetricBarChart
            districts={SAMPLE_DISTRICTS}
            metric={selectedMetric}
            selectedDistrict={selectedDistrict}
          />
        </div>
        <div className="gdp-geo-chart-card">
          <h2 className="gdp-geo-chart-title">생활 접근성 지수</h2>
          <AccessBarChart />
        </div>
      </div>

      <section className="gdp-geo-detail" aria-labelledby="geo-detail-title">
        <h2 id="geo-detail-title">{selected.name} 세부 지표</h2>
        <p className="gdp-geo-detail-note">{selected.note}</p>
        <div className="gdp-geo-score-grid">
          {scores.map((s) => (
            <article
              key={s.metric}
              className={`gdp-geo-score-card${selectedMetric === s.metric ? " is-active" : ""}`}
            >
              <span>{s.metric}</span>
              <strong>{s.score}점</strong>
              <small>
                평균 {s.avg}점 · {s.rank}위
              </small>
            </article>
          ))}
        </div>
      </section>

      <section className="gdp-geo-table-section" aria-labelledby="geo-table-title">
        <h2 id="geo-table-title">권역별 지표 비교표</h2>
        <div className="gdp-geo-table-wrap">
          <table className="gdp-geo-table" aria-label="권역별 접근성 지표 전체">
            <thead>
              <tr>
                <th scope="col">행정동</th>
                <th scope="col">용도</th>
                <th scope="col">생활</th>
                <th scope="col">교통</th>
                <th scope="col">안전</th>
                <th scope="col">평균</th>
                {hasPopulation && <th scope="col">인구(명)</th>}
              </tr>
            </thead>
            <tbody>
              {SAMPLE_DISTRICTS.map((d) => {
                const avg = Math.round(
                  GEO_METRICS.reduce((s, m) => s + d.scores[m], 0) / GEO_METRICS.length,
                );
                const pop = populationMap.get(d.name);
                return (
                  <tr key={d.name} className={selectedDistrict === d.name ? "is-selected" : ""}>
                    <td>
                      <button type="button" onClick={() => setSelectedDistrict(d.name)}>
                        {d.name}
                      </button>
                    </td>
                    <td>{d.zone}</td>
                    <td>{d.scores.생활}</td>
                    <td>{d.scores.교통}</td>
                    <td>{d.scores.안전}</td>
                    <td>
                      <strong>{avg}점</strong>
                    </td>
                    {hasPopulation && <td>{pop ? pop.toLocaleString("ko-KR") : "—"}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="gdp-geo-table-note">
          접근성 점수는 시범 데이터 · 인구는 주민등록 원값 · 기준일 {model.asOf}
        </p>
      </section>
    </section>
  );
}
