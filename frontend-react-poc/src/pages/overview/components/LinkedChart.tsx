import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { OverviewModel, OverviewTopic } from "../overviewTypes";

echarts.use([BarChart, PieChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

interface Props {
  model: OverviewModel;
  topic: OverviewTopic;
  selectedBreakdown: string;
  onSelectBreakdown: (name: string) => void;
}

export function LinkedChart({ model, topic, selectedBreakdown, onSelectBreakdown }: Props) {
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
    chart.setOption({
      color: isCommercial ? ["#ef6b5b", "#3159d8", "#00a88f", "#d49324"] : ["#3159d8"],
      tooltip: { trigger: isCommercial ? "item" : "axis" },
      grid: isCommercial ? undefined : { left: 12, right: 14, top: 16, bottom: 22, containLabel: true },
      legend: isCommercial ? { bottom: 0, textStyle: { color: "#607487" } } : undefined,
      xAxis: isCommercial
        ? undefined
        : {
            type: "category",
            data: chartData.map((item) => item.name),
            axisLabel: { color: "#607487", interval: 0, fontSize: 10 },
            axisLine: { lineStyle: { color: "#dbe4ee" } },
          },
      yAxis: isCommercial
        ? undefined
        : {
            type: "value",
            axisLabel: { color: "#8497a8", fontSize: 10 },
            splitLine: { lineStyle: { color: "#edf2f7" } },
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
              label: { color: "#607487", fontSize: 11 },
            },
          ]
        : [
            {
              type: "bar",
              data: chartData.map((item) => ({
                value: item.value,
                itemStyle: {
                  color: selectedBreakdown && selectedBreakdown !== item.name ? "#b8c6d6" : "#3159d8",
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
  }, [chartData, onSelectBreakdown, selectedBreakdown, topic]);

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
