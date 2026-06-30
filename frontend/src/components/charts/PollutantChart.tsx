// 대기질 오염물질 항목별 수치 막대 차트 — AirQualityDetail 입력
import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent, MarkLineComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useTheme } from "../../shell/ThemeContext";
import { readChartTokens } from "../../data/themeTokens";
import type { AirQualityDetail } from "../../pages/overview/overviewTypes";

echarts.use([BarChart, GridComponent, TooltipComponent, MarkLineComponent, CanvasRenderer]);

// 항목별 안전 임계 기준 (환경부 기준, 단위 동일)
const THRESHOLDS: Record<string, { good: number; normal: number; bad: number }> = {
  pm10:  { good: 30,     normal: 80,     bad: 150 },
  pm25:  { good: 15,     normal: 35,     bad: 75 },
  no2:   { good: 0.03,   normal: 0.06,   bad: 0.2 },
  o3:    { good: 0.03,   normal: 0.09,   bad: 0.15 },
  co:    { good: 2,      normal: 9,      bad: 15 },
  so2:   { good: 0.02,   normal: 0.05,   bad: 0.15 },
};

function barColor(key: string, value: number, tok: ReturnType<typeof readChartTokens>): string {
  const t = THRESHOLDS[key];
  if (!t) return tok.action;
  if (value <= t.good) return tok.series[1];   // mint — 좋음
  if (value <= t.normal) return tok.action;    // cobalt — 보통
  if (value <= t.bad) return tok.series[3];    // amber — 나쁨
  return tok.series[2];                        // coral — 매우나쁨
}

interface Props {
  detail: AirQualityDetail;
  height?: number;
}

export function PollutantChart({ detail, height = 200 }: Props) {
  const theme = useTheme();
  const ref = useRef<HTMLDivElement | null>(null);

  const validPollutants = detail.pollutants.filter((p) => p.value !== null);

  useEffect(() => {
    if (!ref.current || !validPollutants.length) return undefined;
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    const tok = readChartTokens();

    chart.setOption({
      animation: true,
      animationDuration: 700,
      animationEasing: "cubicOut",
      grid: { left: 8, right: 16, top: 12, bottom: 0, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: tok.series[0],
        formatter: (params: unknown) => {
          const arr = params as Array<{ name: string; value: number; seriesIndex: number }>;
          const p = arr[0];
          const pollutant = validPollutants[p.seriesIndex] ?? validPollutants.find((x) => x.label === p.name);
          const unit = pollutant?.unit ?? "";
          return `${p.name}<br/><strong>${p.value} ${unit}</strong>`;
        },
      },
      xAxis: {
        type: "value",
        axisLabel: { color: tok.axisLabel, fontSize: 10 },
        splitLine: { lineStyle: { color: tok.gridLine } },
        axisLine: { show: false },
      },
      yAxis: {
        type: "category",
        data: validPollutants.map((p) => p.label),
        axisLabel: { color: tok.axisLabel, fontSize: 10 },
        axisLine: { lineStyle: { color: tok.axisLine } },
      },
      series: [
        {
          type: "bar",
          data: validPollutants.map((p) => ({
            value: p.value,
            itemStyle: {
              color: barColor(p.key, p.value!, tok),
              borderRadius: [0, 6, 6, 0],
            },
          })),
          barWidth: 14,
          label: {
            show: true,
            position: "right",
            color: tok.axisLabel,
            fontSize: 10,
            formatter: (params: { value: number }) => {
              const pol = validPollutants[params.value] ?? validPollutants.find((_, i) => i === (params as unknown as { dataIndex: number }).dataIndex);
              return pol ? `${params.value} ${pol.unit}` : String(params.value);
            },
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
  }, [validPollutants, theme]);

  if (!validPollutants.length) {
    return (
      <div className="gdp-linked-chart-empty" role="status" style={{ height }}>
        오염물질 측정 데이터가 없습니다. 백엔드 연결을 확인해 주세요.
      </div>
    );
  }

  return (
    <div
      ref={ref}
      style={{ width: "100%", height }}
      role="img"
      aria-label="대기질 오염물질 항목별 수치 차트"
    />
  );
}
