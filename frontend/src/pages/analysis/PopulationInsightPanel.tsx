// 인구 페이지 전용 인사이트 패널 — KPI·피라미드·성별 도넛·동별 막대 위젯
import { Link } from "react-router-dom";
import type { OverviewModel } from "../overview/overviewTypes";
import { PopulationPyramid } from "../../components/charts/PopulationPyramid";
import { SeriesChart } from "../../components/charts/SeriesChart";
import type { SeriesDatum } from "../../components/charts/SeriesChart";
import { ChartFrame } from "../../components/charts/ChartFrame";
import { KPICard } from "../../components/ui/KPICard";
import { Grid, Section } from "../../components/ui/Section";
import "./PopulationInsightPanel.css";

interface Props {
  model: OverviewModel;
  district: string;
  onSelectDong: (name: string) => void;
}

function fmt(n: number) {
  return n.toLocaleString("ko-KR");
}

export function PopulationInsightPanel({ model, district, onSelectDong }: Props) {
  const pop = model.population;

  // 페이지 레벨 가드 — 총인구 0이면 렌더 안 함 (ThematicAnalysisPage가 기본 경로 사용)
  if (pop.total === 0) return null;

  const genderData: SeriesDatum[] = pop.hasGender
    ? [
        { name: "남성", value: pop.male },
        { name: "여성", value: pop.female },
      ]
    : [];

  const sexRatio = pop.hasGender && pop.female > 0
    ? (pop.male / pop.female).toFixed(2)
    : null;

  // 유소년(0~9세) 비율 — 밴드 이름 일치 기반
  const youth = pop.hasAgeBands
    ? pop.byAge.find((b) => b.ageBand.startsWith("0"))
    : null;
  const youthTotal = youth ? youth.male + youth.female : 0;
  const youthPct = youthTotal && pop.total ? ((youthTotal / pop.total) * 100).toFixed(1) : null;

  // 70세 이상 비율 — 밴드 이름으로 탐색 (정직: 65+ 아님)
  const elderly = pop.hasAgeBands
    ? pop.byAge.find((b) => b.ageBand.startsWith("70"))
    : null;
  const elderlyTotal = elderly ? elderly.male + elderly.female : 0;
  const elderlyPct = elderlyTotal && pop.total ? ((elderlyTotal / pop.total) * 100).toFixed(1) : null;

  const baseDate = pop.observedAt ?? "기준일 확인 중";

  return (
    <div className="gdp-pop-panel">
      {/* KPI 행 */}
      <Section title="주요 수치" aria-label="인구 주요 수치">
        <Grid cols={2}>
          <KPICard
            label="금천구 총인구"
            value={fmt(pop.total)}
            unit="명"
            sub={`기준: ${baseDate}`}
            accent="cobalt"
            aria-label={`금천구 총인구 ${fmt(pop.total)}명`}
          />
          {pop.hasGender && (
            <KPICard
              label="성비 (남÷여)"
              value={sexRatio ?? "—"}
              sub="1.00 = 동수"
              aria-label={`성비 ${sexRatio}`}
            />
          )}
          {pop.hasGender && (
            <KPICard
              label="남성"
              value={fmt(pop.male)}
              unit="명"
              accent="cobalt"
              small
              aria-label={`남성 인구 ${fmt(pop.male)}명`}
            />
          )}
          {pop.hasGender && (
            <KPICard
              label="여성"
              value={fmt(pop.female)}
              unit="명"
              accent="mint"
              small
              aria-label={`여성 인구 ${fmt(pop.female)}명`}
            />
          )}
          {youthPct !== null && (
            <KPICard
              label="유소년 비율 (0~9세)"
              value={youthPct}
              unit="%"
              sub={`${fmt(youthTotal)}명`}
              small
              aria-label={`유소년 비율 ${youthPct}%`}
            />
          )}
          {elderlyPct !== null && (
            <KPICard
              label="70세 이상 비율"
              value={elderlyPct}
              unit="%"
              sub={`${fmt(elderlyTotal)}명 · 65+ 경계는 밴드 미지원`}
              small
              aria-label={`70세 이상 비율 ${elderlyPct}%`}
            />
          )}
        </Grid>
      </Section>

      {/* 인구 피라미드 */}
      {pop.hasAgeBands && (
        <Section title="연령·성별 구조" aria-label="연령·성별 인구 피라미드">
          <ChartFrame
            title="연령대별 인구 피라미드"
            caption={`기준: ${baseDate} · 행안부 주민등록 인구 · 밴드 10세 단위`}
            height={300}
          >
            <PopulationPyramid data={pop.byAge} height={300} />
          </ChartFrame>
        </Section>
      )}

      {/* 성별 도넛 */}
      {pop.hasGender && (
        <Section title="성별 구성" aria-label="성별 인구 구성">
          <ChartFrame
            title="성별 구성 비율"
            caption="남성(cobalt) · 여성(mint) · 점수화·평가 없음"
            height={220}
          >
            <SeriesChart
              data={genderData}
              kind="pie"
              height={220}
              ariaLabel="성별 인구 구성 도넛 차트"
            />
          </ChartFrame>
        </Section>
      )}

      {/* 행정동별 막대 랭킹 */}
      {model.populationSeries.length > 0 && (
        <Section title="행정동별 인구 현황" aria-label="행정동별 인구 막대 차트">
          <ChartFrame
            title="행정동별 총인구 (클릭하면 필터 적용)"
            caption={`기준: ${baseDate} · 원값만 표시 · 평가 없음`}
            height={220}
          >
            <SeriesChart
              data={model.populationSeries}
              kind="bar"
              selectedName={district}
              onSelect={onSelectDong}
              height={220}
              ariaLabel="행정동별 인구 막대 차트"
            />
          </ChartFrame>
          {district && (
            <p className="gdp-pop-panel__district-note">
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
        <div className="gdp-pop-panel__provenance">
          <p>
            <span>출처</span> 행정안전부 주민등록 인구 통계 · 월별 갱신
          </p>
          <p>
            <span>해석</span> 인구를 점수화·평가하지 않습니다. 원값과 기준일만 표시합니다.
          </p>
          <Link to="/datasets?q=인구">데이터 카탈로그에서 확인</Link>
        </div>
      </Section>
    </div>
  );
}
