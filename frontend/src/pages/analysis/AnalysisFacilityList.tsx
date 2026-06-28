// 분석 페이지의 시설 스택·버튼 본문·빈 상태를 공통화한 로컬 컴포넌트들
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { FacilitySummary } from "../overview/overviewTypes";
import { VworldMap } from "../overview/components/VworldMap";

interface FacilityItemBodyProps {
  facility: FacilitySummary;
}

/** 시설 버튼·링크 공통 본문 — 분류/이름/주소 */
export function FacilityItemBody({ facility }: FacilityItemBodyProps) {
  return (
    <>
      <span>{facility.category}</span>
      <strong>{facility.name}</strong>
      <small>{facility.address}</small>
    </>
  );
}

interface FacilityStackProps {
  facilities: FacilitySummary[];
  showMap: boolean;
  linkedCoordinateCount: number;
  selectedFacilityId: string;
  onToggleFacility: (id: string) => void;
  onSelectFacility: (facility: FacilitySummary) => void;
  onMapUnavailable: () => void;
  listAriaLabel: string;
  footer?: ReactNode;
}

/** 미니맵(또는 폴백) + 시설 버튼 목록 + 선택적 말미 슬롯 */
export function FacilityStack({
  facilities,
  showMap,
  linkedCoordinateCount,
  selectedFacilityId,
  onToggleFacility,
  onSelectFacility,
  onMapUnavailable,
  listAriaLabel,
  footer,
}: FacilityStackProps) {
  return (
    <div className="gdp-analysis-facility-stack">
      {showMap && linkedCoordinateCount ? (
        <div className="gdp-analysis-mini-map">
          <VworldMap
            facilities={facilities}
            selectedFacilityId={selectedFacilityId}
            onSelectFacility={onSelectFacility}
            onUnavailable={onMapUnavailable}
          />
        </div>
      ) : (
        <div className="gdp-analysis-map-fallback" role="status">
          <strong>목록 기준으로 확인</strong>
          <span>좌표 또는 지도 연결 상태가 충분하지 않아 같은 데이터를 목록으로 제공합니다.</span>
        </div>
      )}
      <div className="gdp-analysis-facility-list" aria-label={listAriaLabel}>
        {facilities.map((facility) => (
          <button
            key={facility.id}
            className={selectedFacilityId === facility.id ? "is-selected" : ""}
            type="button"
            aria-pressed={selectedFacilityId === facility.id}
            onClick={() => onToggleFacility(facility.id)}
          >
            <FacilityItemBody facility={facility} />
          </button>
        ))}
      </div>
      {footer}
    </div>
  );
}

interface EmptyStateProps {
  title: ReactNode;
  description: string;
  checkItems: string;
  linkTo: string;
  linkLabel: string;
  note: string;
}

/** 조건에 맞는 시설 없음 — 빈 상태 패널 */
export function EmptyState({ title, description, checkItems, linkTo, linkLabel, note }: EmptyStateProps) {
  return (
    <div className="gdp-analysis-empty">
      <span>NO MATCHED RECORDS</span>
      <strong>{title}</strong>
      <p>{description}</p>
      <div>
        <small>확인할 것</small>
        <small>{checkItems}</small>
      </div>
      <Link to={linkTo}>{linkLabel}</Link>
      <small>{note}</small>
    </div>
  );
}
