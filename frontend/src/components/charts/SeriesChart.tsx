// 단순 분포·순위 통합 차트 — bar / line / pie 3가지 kind 지원, 클릭 연동 옵션
import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { LegacyGridContainLabel } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import { useTheme } from "../../shell/ThemeContext";
import { readChartTokens } from "../../data/themeTokens";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  LegacyGridContainLabel,
  CanvasRenderer,
]);

export interface SeriesDatum {
  name: string;
  value: number;
}

interface Props {
  data: SeriesDatum[];
  kind: "bar" | "line" | "pie";
  selectedName?: string;
  onSelect?: (name: string) => void;
  height?: number;
  ariaLabel?: string;
}

export function SeriesChart({
  data,
  kind,
  selectedName = "",
  onSelect,
  height = 220,
  ariaLabel = "데이터 시각화 차트",
}: Props) {
  const theme = useTheme();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current || !data.length) return undefined;
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    const tok = readChartTokens();
    const isPie = kind === "pie";
    const isLine = kind === "line";

    const colorList = [tok.series[0], tok.series[2], tok.series[1], tok.series[3], tok.series[4], tok.series[5]];

    chart.setOption({
      animation: true,
      animationDuration: 650,
      animationEasing: "cubicOut",
      color: isPie ? colorList : [tok.action],
      tooltip: { trigger: isPie ? "item" : "axis" },
      legend: isPie ? { bottom: 0, textStyle: { color: tok.axisLabel, fontSize: 10 } } : undefined,
      grid: isPie ? undefined : { left: 8, right: 12, top: 12, bottom: 4, containLabel: true },
      xAxis: isPie
        ? undefined
        : {
            type: "category",
            data: data.map((d) => d.name),
            axisLabel: { color: tok.axisLabel, interval: 0, fontSize: 10 },
            axisLine: { lineStyle: { color: tok.axisLine } },
          },
      yAxis: isPie
        ? undefined
        : {
            type: "value",
            axisLabel: { color: tok.axisLabel, fontSize: 10 },
            splitLine: { lineStyle: { color: tok.gridLine } },
          },
      series: isPie
        ? [
            {
              type: "pie",
              radius: ["42%", "70%"],
              center: ["50%", "44%"],
              data: data.map((d) => ({
                ...d,
                selected: selectedName === d.name,
              })),
              selectedMode: "single",
              label: { color: tok.axisLabel, fontSize: 10 },
              animationType: "expansion",
            },
          ]
        : [
            {
              type: isLine ? "line" : "bar",
              data: data.map((d) => ({
                value: d.value,
                itemStyle: {
                  color:
                    selectedName && selectedName !== d.name ? tok.inactiveBar : tok.action,
                  opacity: selectedName && selectedName !== d.name ? 0.4 : 1,
                  borderRadius: isLine ? undefined : [6, 6, 0, 0],
                },
              })),
              barWidth: isLine ? undefined : 16,
              smooth: isLine ? 0.4 : undefined,
              areaStyle: isLine
                ? { opacity: 0.12, color: tok.action }
                : undefined,
            },
          ],
    });

    if (onSelect) {
      chart.off("click");
      chart.on("click", (params) => {
        const name = typeof params.name === "string" ? params.name : "";
        if (name) onSelect(name === selectedName ? "" : name);
      });
    }

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [data, kind, selectedName, onSelect, theme]);

  if (!data.length) {
    return (
      <div className="gdp-linked-chart-empty" role="status" style={{ height }}>
        표시할 데이터가 없습니다. 백엔드 연결 또는 필터 조건을 확인해 주세요.
      </div>
    );
  }

  return (
    <div
      ref={ref}
      style={{ width: "100%", height }}
      role="img"
      aria-label={ariaLabel}
    />
  );
}
