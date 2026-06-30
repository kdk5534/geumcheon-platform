// 안전 페이지 전용 인사이트 패널 — CCTV·스쿨존·민방위 시설 + 대기질 위젯
import { Link } from "react-router-dom";
import type { OverviewModel } from "../overview/overviewTypes";
import { SeriesChart } from "../../components/charts/SeriesChart";
import type { SeriesDatum } from "../../components/charts/SeriesChart";
import { ChartFrame } from "../../components/charts/ChartFrame";
import { PollutantChart } from "../../components/charts/PollutantChart";
import { KPICard } from "../../components/ui/KPICard";
import { Grid, Section } from "../../components/ui/Section";
import { aggregateByDong } from "../../data/aggregateByDong";
import { useDongBoundaries } from "../../data/dongBoundaries";
import "./SafetyInsightPanel.css";

interface Props {
  model: OverviewModel;
  district: string;
  onSelectDong: (name: string) => void;
}

const SAFETY_CATEGORIES = ["CCTV", "스쿨존", "민방위대피소"];

function fmt(n: number) {
  return n.toLocaleString("ko-KR");
}

export function SafetyInsightPanel({ model, district, onSelectDong }: Props) {
  // 훅은 조건부 반환보다 앞에 위치해야 한다 (Rules of Hooks)
  const fc = useDongBoundaries();

  const safetyFacilities = model.facilities.filter((f) =>
    SAFETY_CATEGORIES.includes(f.category)
  );

  // 페이지 레벨 가드 — 시설도 없고 대기질도 없으면 렌더 안 함
  if (safetyFacilities.length === 0 && !model.airQuality.hasData) return null;

  const safetySeries: SeriesDatum[] = SAFETY_CATEGORIES.map((cat) => ({
    name: cat,
    value: safetyFacilities.filter((f) => f.category === cat).length,
  })).filter((d) => d.value > 0);

  const dongMap = fc ? aggregateByDong(safetyFacilities, fc) : null;
  const dongSeries: SeriesDatum[] = dongMap
    ? [...dongMap.entries()]
        .map(([name, value]) => ({ name, value }))
        .filter((d) => d.value > 0)
    : [];

  const cctvCount = safetyFacilities.filter((f) => f.category === "CCTV").length;
  const schoolZoneCount = safetyFacilities.filter((f) => f.category === "스쿨존").length;
  const civilDefenseCount = safetyFacilities.filter((f) => f.category === "민방위대피소").length;

  const airQuality = model.airQuality;
  const measuredAt = airQuality.measuredAt ?? "기준일 확인 중";

  return (
    <div className="gdp-safety-insight">
      {/* KPI 행 */}
      <Section title="주요 수치" aria-label="안전 주요 수치">
        <Grid cols={2}>
          <KPICard
            label="안전시설 총계"
            value={fmt(safetyFacilities.length)}
            unit="건"
            sub="CCTV·스쿨존·민방위대피소"
            accent="amber"
            aria-label={`안전시설 총계 ${fmt(safetyFacilities.length)}건`}
          />
          {cctvCount > 0 && (
            <KPICard
              label="CCTV"
              value={fmt(cctvCount)}
              unit="건"
              accent="amber"
              small
              aria-label={`CCTV ${fmt(cctvCount)}건`}
            />
          )}
          {schoolZoneCount > 0 && (
            <KPICard
              label="스쿨존"
              value={fmt(schoolZoneCount)}
              unit="건"
              small
              aria-label={`스쿨존 ${fmt(schoolZoneCount)}건`}
            />
          )}
          {civilDefenseCount > 0 && (
            <KPICard
              label="민방위대피소"
              value={fmt(civilDefenseCount)}
              unit="건"
              small
              aria-label={`민방위대피소 ${fmt(civilDefenseCount)}건`}
            />
          )}
          {airQuality.hasData && (
            <KPICard
              label="대기질 등급 (관측값)"
              value={airQuality.grade}
              sub={`기준: ${measuredAt} · 위험 판정 아님`}
              small
              aria-label={`대기질 등급 ${airQuality.grade}`}
            />
          )}
        </Grid>
      </Section>

      {/* 카테고리별 시설 수 */}
      {safetySeries.length > 0 && (
        <Section title="카테고리별 시설 수" aria-label="안전시설 카테고리별 막대 차트">
          <ChartFrame
            title="안전시설 유형별 분포"
            caption="CCTV·스쿨존·민방위대피소 · 0건 카테고리 제외 · 평가 없음"
            height={180}
          >
            <SeriesChart
              data={safetySeries}
              kind="bar"
              height={180}
              ariaLabel="안전시설 카테고리별 막대 차트"
            />
          </ChartFrame>
        </Section>
      )}

      {/* 행정동별 분포 */}
      {dongSeries.length > 0 && (
        <Section title="행정동별 시설 분포" aria-label="행정동별 안전시설 막대 차트">
          <ChartFrame
            title="행정동별 안전시설 수 (클릭하면 필터 적용)"
            caption="점수화·평가 없음 · 원값만 표시"
            height={220}
          >
            <SeriesChart
              data={dongSeries}
              kind="bar"
              selectedName={district}
              onSelect={onSelectDong}
              height={220}
              ariaLabel="행정동별 안전시설 분포 막대 차트"
            />
          </ChartFrame>
          {district && (
            <p className="gdp-safety-insight__district-note">
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

      {/* 대기질 오염물질 */}
      {airQuality.hasData && (
        <Section title="대기질 오염물질" aria-label="대기질 오염물질 차트">
          <ChartFrame
            title="오염물질 항목별 측정값"
            caption={`기준: ${measuredAt} · 환경부 에어코리아 · 위험 판정 아님 — 관측값만 표시`}
            height={200}
          >
            <PollutantChart detail={airQuality} height={200} />
          </ChartFrame>
        </Section>
      )}

      {/* 데이터 출처·맥락 */}
      <Section aria-label="데이터 출처">
        <div className="gdp-safety-insight__provenance">
          <p>
            <span>출처</span> 서울시 공공데이터 CCTV·스쿨존·민방위대피소 · 환경부 에어코리아 대기질
          </p>
          <p>
            <span>해석</span> 위험도·취약도 판단 없음. 시설 위치와 분류 중심으로 표시합니다.
          </p>
          <Link to="/datasets?q=안전">데이터 카탈로그에서 확인</Link>
        </div>
      </Section>
    </div>
  );
}
