// 상업 페이지 전용 인사이트 패널 — 업종별 건수·구성 위젯
import { Link } from "react-router-dom";
import type { OverviewModel } from "../overview/overviewTypes";
import { SeriesChart } from "../../components/charts/SeriesChart";
import type { SeriesDatum } from "../../components/charts/SeriesChart";
import { ChartFrame } from "../../components/charts/ChartFrame";
import { KPICard } from "../../components/ui/KPICard";
import { Grid, Section } from "../../components/ui/Section";
import "./CommercialInsightPanel.css";

interface Props {
  model: OverviewModel;
  district: string;
  onSelectDong: (name: string) => void;
}

function fmt(n: number) {
  return n.toLocaleString("ko-KR");
}

export function CommercialInsightPanel({ model, district, onSelectDong }: Props) {
  const series: SeriesDatum[] = model.storeCategorySeries;

  // 페이지 레벨 가드 — 업종 데이터가 없으면 렌더 안 함
  if (series.length === 0) return null;

  const commercialMetric = model.metrics.find((m) => m.key === "commercial");
  const totalValue =
    commercialMetric?.value ??
    fmt(series.reduce((acc, d) => acc + d.value, 0));

  const categoryCount = series.length;
  const top = series[0];
  const second = series.length > 1 ? series[1] : null;

  return (
    <div className="gdp-commerce-insight">
      {/* KPI 행 */}
      <Section title="주요 수치" aria-label="상업 주요 수치">
        <Grid cols={2}>
          <KPICard
            label="총 점포 수"
            value={totalValue}
            accent="coral"
            aria-label={`총 점포 수 ${totalValue}`}
          />
          <KPICard
            label="업종 종류"
            value={categoryCount}
            unit="종"
            accent="coral"
            aria-label={`업종 종류 ${categoryCount}종`}
          />
          {top && (
            <KPICard
              label="최다 업종"
              value={top.name}
              sub={`${fmt(top.value)}건`}
              small
              aria-label={`최다 업종 ${top.name} ${fmt(top.value)}건`}
            />
          )}
          {second && (
            <KPICard
              label="2위 업종"
              value={second.name}
              sub={`${fmt(second.value)}건`}
              small
              aria-label={`2위 업종 ${second.name} ${fmt(second.value)}건`}
            />
          )}
        </Grid>
      </Section>

      {/* 업종별 건수 막대 차트 */}
      {series.length > 0 && (
        <Section title="업종별 건수" aria-label="업종별 점포 건수 막대 차트">
          <ChartFrame
            title="업종별 점포 건수 (클릭하면 필터 적용)"
            caption="원값만 표시 · 우열 판단 없음"
            height={240}
          >
            <SeriesChart
              data={series}
              kind="bar"
              selectedName={district}
              onSelect={onSelectDong}
              height={240}
              ariaLabel="업종별 점포 건수 막대 차트"
            />
          </ChartFrame>
          {district && (
            <p className="gdp-commerce-insight__district-note">
              현재 필터: <strong>{district}</strong>
              <button
                type="button"
                onClick={() => onSelectDong("")}
                aria-label="필터 해제"
              >
                해제
              </button>
            </p>
          )}
        </Section>
      )}

      {/* 업종 구성 도넛 차트 */}
      {series.length > 0 && (
        <Section title="업종 구성" aria-label="업종 구성 도넛 차트">
          <ChartFrame
            title="업종 구성 비율"
            caption="구성 비중만 표시 · 창업 추천·우열 판단 없음"
            height={220}
          >
            <SeriesChart
              data={series}
              kind="pie"
              height={220}
              ariaLabel="업종 구성 도넛 차트"
            />
          </ChartFrame>
        </Section>
      )}

      {/* 데이터 출처·맥락 */}
      <Section aria-label="데이터 출처">
        <div className="gdp-commerce-insight__provenance">
          <p>
            <span>출처</span> 소상공인시장진흥공단 상가업소 데이터
          </p>
          <p>
            <span>해석</span> 원값과 구성 비중만 표시합니다. 창업 추천이나 지역 우열 판단을 포함하지 않습니다.
          </p>
          <Link to="/datasets?q=상가">데이터 카탈로그에서 확인</Link>
        </div>
      </Section>
    </div>
  );
}
