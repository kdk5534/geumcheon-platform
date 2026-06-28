// 행정동별 인구·시설 비교 화면 — 실데이터 기반 행정동 인구·시설 수 비교
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../../shell/ThemeContext";
import { readChartTokens } from "../../data/themeTokens";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { LegacyGridContainLabel } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import { Link } from "react-router-dom";
import { usePublicData } from "../../data/PublicDataContext";
import { useDongBoundaries } from "../../data/dongBoundaries";
import { aggregateByDong } from "../../data/aggregateByDong";
import { normalizeDongName } from "../../data/dongName";
import { VworldMap } from "../overview/components/VworldMap";
import type { ChoroplethProps } from "../overview/components/VworldMap";

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer, LegacyGridContainLabel]);

type CompareMetric = "population" | "facility";

/** 행정동별 수치 비교 막대 차트 */
function DongBarChart({
  data,
  label,
  selectedDong,
}: {
  data: Map<string, number>;
  label: string;
  selectedDong: string | null;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const theme = useTheme();

  useEffect(() => {
    if (!ref.current || data.size === 0) return undefined;
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    const dongs = [...data.keys()].sort();
    const values = dongs.map((d) => data.get(d) ?? 0);
    const avg = Math.round(values.reduce((s, val) => s + val, 0) / values.length);
    const tok = readChartTokens();

    chart.setOption({
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: { name: string; value: number }[]) => {
          const p = params[0];
          return `<strong>${p.name}</strong><br/>${label}: ${p.value.toLocaleString("ko-KR")}`;
        },
      },
      grid: { left: 12, right: 14, top: 12, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: dongs,
        axisLabel: { color: tok.axisLabel, fontSize: 11, rotate: 30 },
        axisLine: { lineStyle: { color: tok.axisLine } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: tok.gridLine } },
        axisLabel: {
          color: tok.axisLabel,
          fontSize: 10,
          formatter: (val: number) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val),
        },
        axisLine: { show: false },
      },
      series: [
        {
          name: label,
          type: "bar",
          data: dongs.map((d) => ({
            value: data.get(d) ?? 0,
            itemStyle: {
              color: selectedDong && selectedDong !== d ? tok.inactiveBar : tok.action,
              borderRadius: [4, 4, 0, 0],
            },
          })),
          barMaxWidth: 40,
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: tok.amber, type: "dashed" },
            data: [{ yAxis: avg, label: { formatter: `평균 ${avg.toLocaleString("ko-KR")}`, color: tok.amber, fontSize: 10 } }],
          },
        },
      ],
    });

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [data, label, selectedDong, theme]);

  return (
    <div
      ref={ref}
      style={{ height: 220 }}
      role="img"
      aria-label={`행정동별 ${label} 비교 막대 차트`}
    />
  );
}

export function GeoPage() {
  const { model } = usePublicData();
  const dongFC = useDongBoundaries();
  const [metric, setMetric] = useState<CompareMetric>("population");
  const [selectedDong, setSelectedDong] = useState<string | null>(null);

  // 인구 행정동별 맵 (정규화 이름 키)
  const populationMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const item of model.populationSeries) {
      m.set(normalizeDongName(item.name), item.value);
    }
    return m;
  }, [model.populationSeries]);

  // 시설 동별 집계
  const facilityMap = useMemo(() => {
    if (!dongFC) return new Map<string, number>();
    return aggregateByDong(model.facilities, dongFC);
  }, [dongFC, model.facilities]);

  // choropleth prop
  const choropleth: ChoroplethProps | undefined = useMemo(() => {
    if (metric === "population" && populationMap.size > 0) {
      return { valuesByDong: populationMap, metricLabel: "행정동별 인구(명)" };
    }
    if (metric === "facility" && facilityMap.size > 0) {
      return { valuesByDong: facilityMap, metricLabel: "행정동별 시설 수(개)" };
    }
    return undefined;
  }, [metric, populationMap, facilityMap]);

  // 행정동 이름 목록 (GeoJSON 기준, 없으면 인구에서)
  const dongNames = useMemo(() => {
    if (dongFC) {
      return dongFC.features
        .map((f) =>
          normalizeDongName(
            String(f.properties?.name || f.properties?.adm_nm || f.properties?.ADM_NM || ""),
          ),
        )
        .filter(Boolean)
        .sort();
    }
    return [...populationMap.keys()].sort();
  }, [dongFC, populationMap]);

  const hasPopulation = populationMap.size > 0;
  const hasFacility = facilityMap.size > 0;
  const hasData = hasPopulation || hasFacility;
  const currentData = metric === "population" ? populationMap : facilityMap;
  const currentLabel = metric === "population" ? "인구(명)" : "시설 수(개)";

  return (
    <section className="gdp-geo-page" aria-labelledby="geo-title">
      <header className="gdp-operational-hero">
        <div>
          <span>DISTRICT COMPARISON</span>
          <h1 id="geo-title">행정동별 인구·시설 비교</h1>
          <p>금천구 10개 행정동의 주민등록 인구와 시설 분포를 비교합니다.</p>
        </div>
        <Link to="/nearby">시설 지도로 보기</Link>
      </header>

      {!hasData && (
        <aside className="gdp-geo-notice" role="note">
          <strong>데이터를 불러오는 중입니다.</strong>
          {" "}백엔드가 연결되면 행정동별 실데이터가 표시됩니다.
          {" "}<Link to="/datasets">데이터 상태 보기</Link>
        </aside>
      )}

      {hasData && (
        <>
          {/* 지표 선택 세그먼트 */}
          <div className="gdp-geo-metric-seg" role="group" aria-label="비교 지표 선택">
            <div className="gdp-segmented">
              {hasPopulation && (
                <button
                  type="button"
                  className={metric === "population" ? "is-active" : ""}
                  onClick={() => setMetric("population")}
                >
                  인구
                </button>
              )}
              {hasFacility && (
                <button
                  type="button"
                  className={metric === "facility" ? "is-active" : ""}
                  onClick={() => setMetric("facility")}
                >
                  시설 수
                </button>
              )}
            </div>
          </div>

          {/* choropleth 지도 */}
          <div className="gdp-geo-map-card">
            <VworldMap
              facilities={[]}
              choropleth={choropleth}
            />
          </div>

          {/* 막대 차트 */}
          {currentData.size > 0 && (
            <div className="gdp-geo-chart-card">
              <h2 className="gdp-geo-chart-title">행정동별 {currentLabel} 비교</h2>
              <DongBarChart data={currentData} label={currentLabel} selectedDong={selectedDong} />
            </div>
          )}

          {/* 비교 표 */}
          <section className="gdp-geo-table-section" aria-labelledby="geo-table-title">
            <h2 id="geo-table-title">행정동별 현황표</h2>
            <div className="gdp-geo-table-wrap">
              <table className="gdp-geo-table" aria-label="행정동별 인구·시설 수 현황">
                <thead>
                  <tr>
                    <th scope="col">행정동</th>
                    {hasPopulation && <th scope="col">인구(명)</th>}
                    {hasFacility && <th scope="col">시설 수(개)</th>}
                  </tr>
                </thead>
                <tbody>
                  {dongNames.map((dong) => (
                    <tr key={dong} className={selectedDong === dong ? "is-selected" : ""}>
                      <td>
                        <button
                          type="button"
                          onClick={() => setSelectedDong(dong === selectedDong ? null : dong)}
                        >
                          {dong}
                        </button>
                      </td>
                      {hasPopulation && (
                        <td>
                          {populationMap.has(dong)
                            ? populationMap.get(dong)!.toLocaleString("ko-KR")
                            : "—"}
                        </td>
                      )}
                      {hasFacility && (
                        <td>{facilityMap.get(dong) ?? 0}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="gdp-geo-table-note">
              인구: 주민등록 원값 · 시설: 공개데이터 누적 · 기준일 {model.asOf || "—"}
            </p>
          </section>
        </>
      )}
    </section>
  );
}
