// 연령대별 인구 피라미드 차트 — AgeBandDatum[] 입력, 남성 음수 / 여성 양수 양방향 막대
import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useTheme } from "../../shell/ThemeContext";
import { readChartTokens } from "../../data/themeTokens";
import type { AgeBandDatum } from "../../pages/overview/overviewTypes";

echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

interface Props {
  data: AgeBandDatum[];
  height?: number;
}

export function PopulationPyramid({ data, height = 280 }: Props) {
  const theme = useTheme();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current || !data.length) return undefined;
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    const tok = readChartTokens();
    const labels = data.map((d) => d.ageBand);
    const maleValues = data.map((d) => -d.male);
    const femaleValues = data.map((d) => d.female);

    chart.setOption({
      animation: true,
      animationDuration: 800,
      animationEasing: "cubicOut",
      legend: {
        data: ["남성", "여성"],
        bottom: 0,
        textStyle: { color: tok.axisLabel, fontSize: 11 },
      },
      grid: { left: 12, right: 12, top: 8, bottom: 32, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const arr = params as Array<{ seriesName: string; value: number; name: string }>;
          const ageBand = arr[0]?.name ?? "";
          const lines = arr
            .map((p) => `${p.seriesName}: <strong>${Math.abs(p.value).toLocaleString("ko-KR")}명</strong>`)
            .join("<br/>");
          return `${ageBand}<br/>${lines}`;
        },
      },
      xAxis: {
        type: "value",
        axisLabel: {
          color: tok.axisLabel,
          fontSize: 9,
          formatter: (val: number) => Math.abs(val).toLocaleString("ko-KR"),
        },
        splitLine: { lineStyle: { color: tok.gridLine } },
      },
      yAxis: {
        type: "category",
        data: labels,
        axisLabel: { color: tok.axisLabel, fontSize: 9 },
        axisLine: { lineStyle: { color: tok.axisLine } },
      },
      series: [
        {
          name: "남성",
          type: "bar",
          stack: "pyramid",
          data: maleValues,
          itemStyle: { color: tok.action, borderRadius: [0, 0, 0, 0] },
          barWidth: 12,
          emphasis: { itemStyle: { opacity: 0.8 } },
        },
        {
          name: "여성",
          type: "bar",
          stack: "pyramid",
          data: femaleValues,
          itemStyle: { color: tok.series[2], borderRadius: [0, 0, 0, 0] },
          barWidth: 12,
          emphasis: { itemStyle: { opacity: 0.8 } },
        },
      ],
    });

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [data, theme]);

  if (!data.length) {
    return (
      <div className="gdp-linked-chart-empty" role="status" style={{ height }}>
        연령대별 인구 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div
      ref={ref}
      style={{ width: "100%", height }}
      role="img"
      aria-label="연령대별 인구 피라미드 차트"
    />
  );
}
