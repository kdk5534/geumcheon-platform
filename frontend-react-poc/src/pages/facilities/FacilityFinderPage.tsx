import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePublicData } from "../../data/PublicDataContext";
import type { FacilitySummary, MapMode } from "../overview/overviewTypes";
import { FacilityDetailDrawer } from "../overview/components/FacilityDetailDrawer";
import { VworldMap } from "../overview/components/VworldMap";

const categoryAliases: Record<string, string[]> = {
  복지: ["복지", "돌봄", "의료", "보건", "병원", "약국", "어르신", "장애", "어린이집"],
  CCTV: ["CCTV", "방범", "교통단속"],
  안전: ["CCTV", "안전", "방범", "재난", "보호", "스쿨존", "쉼터", "대피", "민방위"],
  생활: ["공공", "문화", "의료", "행정", "복지", "교통", "시설", "전기차충전소", "주차장", "공공 Wi-Fi", "자전거"],
};
const visibleMarkerLimit = 500;

function categoryMatches(facilityCategory: string, requestedCategory: string) {
  if (!requestedCategory || requestedCategory === "전체") return true;
  const normalizedFacility = facilityCategory.toLocaleLowerCase("ko-KR");
  const aliases = categoryAliases[requestedCategory] || [requestedCategory];
  return aliases.some((alias) => normalizedFacility.includes(alias.toLocaleLowerCase("ko-KR")));
}

export function FacilityFinderPage() {
  const [params, setParams] = useSearchParams();
  const { model } = usePublicData();
  const [mapMode, setMapMode] = useState<MapMode>(params.get("map") === "list" ? "list" : "map");
  const [selectedFacility, setSelectedFacility] = useState<FacilitySummary | null>(null);
  const [query, setQuery] = useState("");
  const listItemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const category = params.get("category") || "";
  const district = params.get("district") || "";
  const emptyTitle = category ? `${category} 조건에 표시할 시설이 없습니다.` : "표시할 시설이 없습니다.";
  const emptyDescription = category
    ? "신뢰 가능한 원천 데이터가 없는 항목은 다른 시설로 대체하지 않습니다. 검색어·행정동을 해제하거나 데이터 카탈로그에서 수집 상태를 확인해 주세요."
    : "검색어를 지우거나 카테고리를 전체로 바꾸면 지도를 다시 표시합니다.";

  const categories = useMemo(
    () => [
      "전체",
      ...Object.keys(categoryAliases),
      ...Array.from(new Set(model.facilities.map((facility) => facility.category).filter(Boolean))).sort(),
    ].filter((item, index, array) => array.indexOf(item) === index),
    [model.facilities],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko-KR");
    return model.facilities.filter((facility) => {
      const haystack = `${facility.name} ${facility.category} ${facility.address}`.toLocaleLowerCase("ko-KR");
      const matchesCategory = categoryMatches(facility.category, category);
      const matchesDistrict = !district || haystack.includes(district.toLocaleLowerCase("ko-KR"));
      const matchesQuery =
        !normalized || haystack.includes(normalized);
      return matchesCategory && matchesDistrict && matchesQuery;
    });
  }, [category, district, model.facilities, query]);

  const categorySummary = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach((facility) => counts.set(facility.category, (counts.get(facility.category) || 0) + 1));
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filtered]);

  const geocodedCount = filtered.filter((facility) => facility.lat && facility.lng).length;
  const estimatedCount = filtered.filter((facility) => facility.coordinateSource === "estimated").length;
  const visibleMarkerCount = Math.min(geocodedCount, visibleMarkerLimit);

  useEffect(() => {
    if (selectedFacility && !filtered.some((facility) => facility.id === selectedFacility.id)) {
      setSelectedFacility(null);
    }
  }, [filtered, selectedFacility]);

  const updateCategory = (next: string) => {
    const nextParams = new URLSearchParams(params);
    if (!next || next === "전체") nextParams.delete("category");
    else nextParams.set("category", next);
    setParams(nextParams, { replace: true });
  };

  const clearDistrict = () => {
    const nextParams = new URLSearchParams(params);
    nextParams.delete("district");
    setParams(nextParams, { replace: true });
  };

  const updateMapMode = (next: MapMode) => {
    const nextParams = new URLSearchParams(params);
    if (next === "list") nextParams.set("map", "list");
    else nextParams.delete("map");
    setMapMode(next);
    setParams(nextParams, { replace: true });
  };

  const handleMapUnavailable = useCallback(() => {
    updateMapMode("list");
  }, [params]);

  const selectFacility = useCallback((facility: FacilitySummary) => {
    setSelectedFacility(facility);
    window.setTimeout(() => {
      listItemRefs.current.get(facility.id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 40);
  }, []);

  return (
    <section className="gdp-finder-page" aria-labelledby="facility-finder-title">
      <header className="gdp-finder-head">
        <div>
          <span>FACILITY FINDER</span>
          <h1 id="facility-finder-title">시설 찾기</h1>
          <p>
            지도와 목록을 전환하며 같은 시설 데이터를 확인합니다.
            {district ? ` 현재 행정동 조건은 ${district}입니다.` : " 지도 연결이 어려워도 목록으로 동일 과업을 완료할 수 있습니다."}
          </p>
        </div>
        <div className="gdp-finder-summary">
          <strong>{filtered.length.toLocaleString("ko-KR")}</strong>
          <span>표시 시설 행</span>
        </div>
      </header>

      <section className="gdp-finder-toolbar" aria-label="시설 검색 조건">
        <label>
          시설 검색
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="시설명, 주소, 분류 검색" />
        </label>
        <label>
          카테고리
          <select value={category || "전체"} onChange={(event) => updateCategory(event.target.value)}>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <div className="gdp-finder-segmented" role="group" aria-label="시설 표시 방식">
          <button className={mapMode === "map" ? "is-active" : ""} type="button" onClick={() => updateMapMode("map")}>
            지도
          </button>
          <button className={mapMode === "list" ? "is-active" : ""} type="button" onClick={() => updateMapMode("list")}>
            목록
          </button>
        </div>
      </section>

      <section className="gdp-finder-status" aria-label="시설 데이터 상태">
        <div>
          <span>공개 범위</span>
          <strong>금천구 GEUMCHEON</strong>
        </div>
        <div>
          <span>지도 표시</span>
          <strong>
            {visibleMarkerCount.toLocaleString("ko-KR")} / {geocodedCount.toLocaleString("ko-KR")}개
          </strong>
        </div>
        <div>
          <span>현재 필터</span>
          <strong>{[category || "전체 시설", district].filter(Boolean).join(" · ")}</strong>
        </div>
      </section>

      {district ? (
        <div className="gdp-finder-chipbar" aria-label="활성 행정동 필터">
          <span>활성 필터</span>
          <button type="button" onClick={clearDistrict}>
            {district} 해제
          </button>
        </div>
      ) : null}

      {filtered.length ? (
        <section className="gdp-finder-mix" aria-label="시설 분류 구성">
          <header>
            <span>CATEGORY MIX</span>
            <strong>현재 결과의 분류 구성</strong>
          </header>
          <div>
            {categorySummary.map((item) => (
              <button
                key={item.name}
                type="button"
                aria-pressed={category === item.name}
                onClick={() => updateCategory(item.name)}
              >
                <span>{item.name}</span>
                <strong>{item.count.toLocaleString("ko-KR")}행</strong>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {estimatedCount ? (
        <p className="gdp-finder-notice" role="status">
          {estimatedCount.toLocaleString("ko-KR")}개 시설은 원천 좌표가 없어 주소·행정동 기반의 지도 표시용 위치로 보여줍니다.
          정확한 위치 확인은 상세 주소와 출처를 함께 확인해 주세요.
        </p>
      ) : null}

      {geocodedCount > visibleMarkerLimit ? (
        <p className="gdp-finder-notice" role="status">
          화면 성능을 위해 지도에는 좌표 보유 시설 중 최대 {visibleMarkerLimit.toLocaleString("ko-KR")}개를 표시합니다.
          전체 {filtered.length.toLocaleString("ko-KR")}개 결과는 검색과 목록 전환으로 확인할 수 있습니다.
        </p>
      ) : null}

      <div className="gdp-finder-layout">
        <article className="gdp-finder-map">
          {!filtered.length ? (
            <div className="gdp-finder-empty-map" role="status">
              <strong>{emptyTitle}</strong>
              <span>{emptyDescription}</span>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  updateCategory("전체");
                  if (district) clearDistrict();
                }}
              >
                전체 시설 보기
              </button>
            </div>
          ) : mapMode === "map" ? (
            <VworldMap
              facilities={filtered}
              onUnavailable={handleMapUnavailable}
              onSelectFacility={selectFacility}
              selectedFacilityId={selectedFacility?.id}
            />
          ) : (
            <div className="gdp-map-list" aria-label="시설 목록">
              {filtered.map((facility) => (
                <button
                  key={facility.id}
                  className={selectedFacility?.id === facility.id ? "is-selected" : ""}
                  type="button"
                  aria-pressed={selectedFacility?.id === facility.id}
                  onClick={() => selectFacility(facility)}
                >
                  <i />
                  <div>
                    <strong>{facility.name}</strong>
                    <span>
                      {facility.address}
                      {facility.coordinateSource === "estimated" ? " · 표시용 위치" : ""}
                    </span>
                  </div>
                  <small>{facility.category}</small>
                </button>
              ))}
            </div>
          )}
        </article>

        <aside className="gdp-finder-list" aria-label="시설 빠른 목록">
          <header>
            <span>LIST</span>
            <strong>시설 목록</strong>
          </header>
          {filtered.slice(0, 24).map((facility) => (
            <button
              key={facility.id}
              ref={(node) => {
                if (node) listItemRefs.current.set(facility.id, node);
                else listItemRefs.current.delete(facility.id);
              }}
              className={selectedFacility?.id === facility.id ? "is-selected" : ""}
              type="button"
              aria-pressed={selectedFacility?.id === facility.id}
              onClick={() => selectFacility(facility)}
            >
              <span>{facility.category}</span>
              <strong>{facility.name}</strong>
              <small>
                {facility.address}
                {facility.coordinateSource === "estimated" ? " · 표시용 위치" : ""}
              </small>
            </button>
          ))}
        </aside>
      </div>

      {selectedFacility ? <FacilityDetailDrawer facility={selectedFacility} onClose={() => setSelectedFacility(null)} /> : null}
    </section>
  );
}
