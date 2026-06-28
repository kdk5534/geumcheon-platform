import type { FacilitySummary } from "../overviewTypes";

interface Props {
  facility: FacilitySummary;
  onClose: () => void;
}

export function FacilityDetailDrawer({ facility, onClose }: Props) {
  const hasCoordinates = facility.lat != null && facility.lng != null;
  const isEstimated = facility.coordinateSource === "estimated";
  const mapSearchUrl = `https://map.kakao.com/link/search/${encodeURIComponent(
    facility.address || facility.name || "금천구",
  )}`;
  const evidenceUrl = `#/datasets?q=${encodeURIComponent(facility.category || facility.name || "시설")}`;

  return (
    <aside className="gdp-facility-drawer" aria-labelledby="gdp-facility-title">
      <div className="gdp-facility-drawer-head">
        <div>
          <span>{facility.category || "시설"}</span>
          <h3 id="gdp-facility-title">{facility.name}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="시설 상세 닫기">
          ×
        </button>
      </div>

      <dl className="gdp-facility-dl">
        <div>
          <dt>주소</dt>
          <dd>{facility.address || "주소 정보 없음"}</dd>
        </div>
        <div>
          <dt>좌표</dt>
          <dd>
            {hasCoordinates
              ? `${facility.lat!.toFixed(5)}, ${facility.lng!.toFixed(5)}`
              : "좌표 없음 · 목록 과업 가능"}
          </dd>
        </div>
        <div>
          <dt>좌표 상태</dt>
          <dd>{isEstimated ? "원천 좌표 없음 · 주소/행정동 기반 표시용 위치" : "원천 좌표 기반 표시"}</dd>
        </div>
        <div>
          <dt>공개 범위</dt>
          <dd>금천구 GEUMCHEON</dd>
        </div>
        <div>
          <dt>표시 원칙</dt>
          <dd>평가/순위가 아닌 원자료 위치와 출처 확인 중심</dd>
        </div>
      </dl>

      <div className="gdp-facility-actions">
        <a href={mapSearchUrl} target="_blank" rel="noopener noreferrer">
          길찾기
        </a>
        <a href={evidenceUrl}>데이터 근거</a>
      </div>
    </aside>
  );
}
