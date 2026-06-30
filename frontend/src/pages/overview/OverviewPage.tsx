import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePublicData } from "../../data/PublicDataContext";
import { Button } from "../../components/ui";
import { copyShareUrl, downloadCsv } from "../../utils/export";
import { OverviewBriefStrip } from "./components/OverviewBriefStrip";
import { OverviewMapPanel } from "./components/OverviewMapPanel";
import { OverviewAnalysisPanel } from "./components/OverviewAnalysisPanel";
import { KpiGrid } from "./components/KpiGrid";
import { ProvenancePanel } from "./components/ProvenancePanel";
import { DataStatusBar } from "./components/DataStatusBar";
import { InsightRail } from "./components/InsightRail";
import type { MapMode, OverviewTopic } from "./overviewTypes";

const validTopics: OverviewTopic[] = ["population", "commercial", "welfare", "safety"];

export function OverviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { model, loadState } = usePublicData();
  const [actionMessage, setActionMessage] = useState("");
  const [dataStatusOpen, setDataStatusOpen] = useState(false);
  const topicParam = searchParams.get("topic") as OverviewTopic | null;
  const districtParam = searchParams.get("district") || "";
  const breakdownParam = searchParams.get("breakdown") || "";
  const mapParam = searchParams.get("map") === "list" ? "list" : "map";
  const [mapMode, setMapMode] = useState<MapMode>(mapParam);

  const topic = topicParam && validTopics.includes(topicParam) ? topicParam : "population";
  const district = model.districts.includes(districtParam) ? districtParam : "";

  const updateParams = (next: { topic?: OverviewTopic; district?: string; map?: MapMode; breakdown?: string }) => {
    const params = new URLSearchParams(searchParams);
    if (next.topic) params.set("topic", next.topic);
    if (next.district !== undefined) {
      if (next.district) params.set("district", next.district);
      else params.delete("district");
    }
    if (next.map) {
      if (next.map === "list") params.set("map", "list");
      else params.delete("map");
      setMapMode(next.map);
    }
    if (next.breakdown !== undefined) {
      if (next.breakdown) params.set("breakdown", next.breakdown);
      else params.delete("breakdown");
    }
    setSearchParams(params, { replace: true });
  };

  const activeLabel = useMemo(() => {
    const topicLabel = {
      population: "인구",
      commercial: "상권",
      welfare: "복지",
      safety: "안전",
    }[topic];
    return `${district || "금천구 전체"} · ${topicLabel}`;
  }, [district, topic]);

  const handleShare = async () => {
    const copied = await copyShareUrl();
    setActionMessage(copied ? "공유 URL을 복사했습니다." : "현재 주소를 복사하지 못했습니다.");
  };

  const handleCsv = () => {
    const rows = model.facilities.map((facility) => ({
      topic,
      district: district || "금천구 전체",
      breakdown: breakdownParam || "",
      category: facility.category,
      name: facility.name,
      address: facility.address,
      latitude: facility.lat,
      longitude: facility.lng,
      asOf: model.asOf,
      sourceMode: model.sourceMode,
    }));
    downloadCsv(`geumcheon-overview-${topic}.csv`, rows);
    setActionMessage("현재 필터 기준 CSV를 생성했습니다.");
  };

  const handlePrint = () => {
    setActionMessage("인쇄/PDF 대화상자를 엽니다.");
    window.setTimeout(() => window.print(), 80);
  };

  return (
    <section className="gdp-overview" aria-labelledby="overview-title">
      <header className="gdp-overview-head">
        <div>
          <p className="gdp-kicker">GEUMCHEON URBAN DATA LAB · {model.asOf}</p>
          <h1 id="overview-title">금천구 도시 데이터 종합 현황</h1>
          <p>
            관심 주제와 행정동을 선택하면 지도, 차트, 시설 목록, 데이터 근거가 같은 조건으로 갱신됩니다.
          </p>
        </div>
        <div className="gdp-hero-actions" aria-label="화면 작업">
          <Button variant="outline" size="sm" onClick={handleShare}>공유</Button>
          <Button variant="outline" size="sm" onClick={handleCsv}>CSV</Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>PDF</Button>
        </div>
      </header>

      <DataStatusBar
        model={model}
        loadState={loadState}
        topic={topic}
        district={district}
        breakdown={breakdownParam}
        expanded={dataStatusOpen}
        onToggle={() => setDataStatusOpen((current) => !current)}
      />

      {actionMessage ? (
        <div className="gdp-action-status" role="status" aria-live="polite">
          {actionMessage}
        </div>
      ) : null}

      <div className="gdp-command-grid">
        <OverviewMapPanel
          model={model}
          topic={topic}
          district={district}
          mapMode={mapMode}
          selectedBreakdown={breakdownParam}
          onMapModeChange={(next) => updateParams({ map: next })}
        />
        <OverviewAnalysisPanel
          model={model}
          topic={topic}
          district={district}
          activeLabel={activeLabel}
          selectedBreakdown={breakdownParam}
          onTopicChange={(next) => updateParams({ topic: next })}
          onDistrictChange={(next) => updateParams({ district: next })}
          onBreakdownChange={(next) => updateParams({ breakdown: next })}
        />
      </div>

      <KpiGrid metrics={model.metrics} />
      <ProvenancePanel model={model} />
      <OverviewBriefStrip model={model} />
      <InsightRail model={model} topic={topic} district={district} selectedBreakdown={breakdownParam} />
    </section>
  );
}
