// 복지 페이지 전용 인사이트 패널 — 복지·의료·돌봄 시설 카테고리별·행정동별 위젯
import { Link } from "react-router-dom";
import type { OverviewModel } from "../overview/overviewTypes";
import { SeriesChart } from "../../components/charts/SeriesChart";
import type { SeriesDatum } from "../../components/charts/SeriesChart";
import { ChartFrame } from "../../components/charts/ChartFrame";
import { KPICard } from "../../components/ui/KPICard";
import { Grid, Section } from "../../components/ui/Section";
import { aggregateByDong } from "../../data/aggregateByDong";
import { useDongBoundaries } from "../../data/dongBoundaries";
import "./WelfareInsightPanel.css";

interface Props {
  model: OverviewModel;
  district: string;
  onSelectDong: (name: string) => void;
}

const WELFARE_CATEGORIES = ["복지", "병원", "약국", "어린이집", "의료", "보건"];

export function WelfareInsightPanel({ model, district, onSelectDong }: Props) {
  const fc = useDongBoundaries();

  const welfareFacilities = model.facilities.filter(f =>
    WELFARE_CATEGORIES.some(cat => f.category.includes(cat))
  );

  // 페이지 레벨 가드 — 복지 시설이 하나도 없으면 렌더 안 함
  if (welfareFacilities.length === 0) return null;

  const countOf = (cat: string) =>
    welfareFacilities.filter(f => f.category.includes(cat)).length;

  const welfareCount = countOf("복지");
  const hospitalCount = countOf("병원");
  const pharmacyCount = countOf("약국");
  const childcareCount = countOf("어린이집");

  // 카테고리별 차트 데이터
  const categorySeries: SeriesDatum[] = [
    { name: "복지", value: welfareCount },
    { name: "병원", value: hospitalCount },
    { name: "약국", value: pharmacyCount },
    { name: "어린이집", value: childcareCount },
  ].filter(d => d.value > 0);

  // 행정동별 집계
  const dongMap = fc ? aggregateByDong(welfareFacilities, fc) : null;
  const dongSeries: SeriesDatum[] = dongMap
    ? [...dongMap.entries()].map(([name, value]) => ({ name, value })).filter(d => d.value > 0)
    : [];

  return (
    <div className="gdp-welfare-insight">
      {/* KPI 행 */}
      <Section title="주요 수치" aria-label="복지 시설 주요 수치">
        <Grid cols={2}>
          <KPICard
            label="복지·의료·돌봄 시설 총계"
            value={welfareFacilities.length.toLocaleString("ko-KR")}
            unit="건"
            accent="mint"
            aria-label={`복지·의료·돌봄 시설 총계 ${welfareFacilities.length}건`}
          />
          {welfareCount > 0 && (
            <KPICard
              label="복지"
              value={welfareCount.toLocaleString("ko-KR")}
              unit="건"
              accent="mint"
              aria-label={`복지 시설 ${welfareCount}건`}
            />
          )}
          {hospitalCount > 0 && (
            <KPICard
              label="병원"
              value={hospitalCount.toLocaleString("ko-KR")}
              unit="건"
              small
              aria-label={`병원 ${hospitalCount}건`}
            />
          )}
          {pharmacyCount > 0 && (
            <KPICard
              label="약국"
              value={pharmacyCount.toLocaleString("ko-KR")}
              unit="건"
              small
              aria-label={`약국 ${pharmacyCount}건`}
            />
          )}
          {childcareCount > 0 && (
            <KPICard
              label="어린이집"
              value={childcareCount.toLocaleString("ko-KR")}
              unit="건"
              small
              aria-label={`어린이집 ${childcareCount}건`}
            />
          )}
        </Grid>
      </Section>

      {/* 카테고리별 차트 */}
      {categorySeries.length > 0 && (
        <Section title="카테고리별 분포" aria-label="복지 시설 카테고리별 분포">
          <ChartFrame
            title="카테고리별 시설 수"
            caption="복지·병원·약국·어린이집 · 원값만 표시 · 평가 없음"
            height={220}
          >
            <SeriesChart
              data={categorySeries}
              kind="bar"
              height={220}
              ariaLabel="복지 시설 카테고리별 막대 차트"
            />
          </ChartFrame>
        </Section>
      )}

      {/* 행정동별 분포 차트 */}
      {dongSeries.length > 0 && (
        <Section title="행정동별 분포" aria-label="복지 시설 행정동별 분포">
          <ChartFrame
            title="행정동별 복지·의료·돌봄 시설 수 (클릭하면 필터 적용)"
            caption="좌표 보유 시설만 집계 · 원값만 표시 · 평가 없음"
            height={220}
          >
            <SeriesChart
              data={dongSeries}
              kind="bar"
              selectedName={district}
              onSelect={onSelectDong}
              height={220}
              ariaLabel="행정동별 복지 시설 막대 차트"
            />
          </ChartFrame>
          {district && (
            <p className="gdp-welfare-insight__district-note">
              현재 필터: <strong>{district}</strong>
              <button
                type="button"
                onClick={() => onSelectDong("")}
                aria-label="행정동 필터 해제"
              >
                해제
              </button>
            </p>
          )}
        </Section>
      )}

      {/* 데이터 출처·맥락 */}
      <Section aria-label="데이터 출처">
        <div className="gdp-welfare-insight__provenance">
          <p>
            <span>출처</span> 서울시 공공데이터 · 행정안전부 · 국민건강보험공단
          </p>
          <p>
            <span>해석</span> 원값과 위치만 표시합니다. 복지 수준 평가 없음.
          </p>
          <Link to="/datasets?q=복지">데이터 카탈로그에서 확인</Link>
        </div>
      </Section>
    </div>
  );
}
