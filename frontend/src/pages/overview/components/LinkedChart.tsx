import { useEffect, useMemo, useRef } from "react";
import { useTheme } from "../../../shell/ThemeContext";
import { readChartTokens } from "../../../data/themeTokens";
import * as echarts from "echarts/core";
import { BarChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { LegacyGridContainLabel } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import type { OverviewModel, OverviewTopic } from "../overviewTypes";

echarts.use([BarChart, PieChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer, LegacyGridContainLabel]);

interface Props {
  model: OverviewModel;
  topic: OverviewTopic;
  selectedBreakdown: string;
  onSelectBreakdown: (name: string) => void;
}

export function LinkedChart({ model, topic, selectedBreakdown, onSelectBreakdown }: Props) {
  const theme = useTheme();
  const ref = useRef<HTMLDivElement | null>(null);
  const chartData = useMemo(() => {
    if (topic === "commercial") return model.storeCategorySeries;
    return model.populationSeries;
  }, [model.populationSeries, model.storeCategorySeries, topic]);

  useEffect(() => {
    if (!ref.current) return undefined;
    if (!chartData.length) return undefined;
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    const isCommercial = topic === "commercial";
    const tok = readChartTokens();
    chart.setOption({
      color: isCommercial
        ? [tok.series[2], tok.series[0], tok.series[1], tok.series[3]]
        : [tok.series[0]],
      tooltip: { trigger: isCommercial ? "item" : "axis" },
      grid: isCommercial ? undefined : { left: 12, right: 14, top: 16, bottom: 22, containLabel: true },
      legend: isCommercial ? { bottom: 0, textStyle: { color: tok.axisLabel } } : undefined,
      xAxis: isCommercial
        ? undefined
        : {
            type: "category",
            data: chartData.map((item) => item.name),
            axisLabel: { color: tok.axisLabel, interval: 0, fontSize: 10 },
            axisLine: { lineStyle: { color: tok.axisLine } },
          },
      yAxis: isCommercial
        ? undefined
        : {
            type: "value",
            axisLabel: { color: tok.axisLabel, fontSize: 10 },
            splitLine: { lineStyle: { color: tok.gridLine } },
          },
      series: isCommercial
        ? [
            {
              type: "pie",
              radius: ["45%", "72%"],
              center: ["50%", "43%"],
              data: chartData.map((item) => ({
                ...item,
                selected: selectedBreakdown === item.name,
              })),
              selectedMode: "single",
              label: { color: tok.axisLabel, fontSize: 11 },
            },
          ]
        : [
            {
              type: "bar",
              data: chartData.map((item) => ({
                value: item.value,
                itemStyle: {
                  color: selectedBreakdown && selectedBreakdown !== item.name ? tok.inactiveBar : tok.action,
                  opacity: selectedBreakdown && selectedBreakdown !== item.name ? 0.46 : 1,
                },
              })),
              barWidth: 18,
              itemStyle: { borderRadius: [7, 7, 0, 0] },
            },
          ],
    });
    chart.off("click");
    chart.on("click", (params) => {
      const name = typeof params.name === "string" ? params.name : "";
      if (name) onSelectBreakdown(name === selectedBreakdown ? "" : name);
    });
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [chartData, onSelectBreakdown, selectedBreakdown, topic, theme]);

  if (!chartData.length) {
    return (
      <div className="gdp-linked-chart-empty" role="status">
        표시할 차트 데이터가 없습니다. 백엔드 연결 또는 필터 조건을 확인해 주세요.
      </div>
    );
  }

  return (
    <div className="gdp-linked-chart-body">
      <div className="gdp-linked-chart-canvas" ref={ref} role="img" aria-label="현재 필터와 연동된 차트" />
      <div className="gdp-chart-values" aria-label="차트 데이터 선택">
        {chartData.map((item) => (
          <button
            key={item.name}
            className={selectedBreakdown === item.name ? "is-active" : ""}
            type="button"
            onClick={() => onSelectBreakdown(selectedBreakdown === item.name ? "" : item.name)}
          >
            <span>{item.name}</span>
            <strong>{item.value.toLocaleString("ko-KR")}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}
