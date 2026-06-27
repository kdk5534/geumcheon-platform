import { useEffect, useMemo, useState } from "react";
import { adaptOverviewModel } from "../../data/overviewAdapter";
import { loadPublicData } from "../../data/publicApi";
import { overviewModel } from "../overview/overviewModel";
import type { OverviewModel } from "../overview/overviewTypes";

export function DistrictComparePage() {
  const [model, setModel] = useState<OverviewModel>(overviewModel);
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    loadPublicData(controller.signal)
      .then((bundle) => {
        if (!controller.signal.aborted) {
          const next = adaptOverviewModel(bundle);
          setModel(next);
          setLeft((current) => current || next.districts[0] || "");
          setRight((current) => current || next.districts[1] || next.districts[0] || "");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setModel(overviewModel);
      });
    return () => controller.abort();
  }, []);

  const populationMap = useMemo(() => new Map(model.populationSeries.map((item) => [item.name, item.value])), [model.populationSeries]);
  const leftValue = populationMap.get(left) || 0;
  const rightValue = populationMap.get(right) || 0;
  const diff = leftValue - rightValue;

  return (
    <section className="gdp-compare-page" aria-labelledby="compare-title">
      <header className="gdp-operational-hero">
        <div>
          <span>DISTRICT COMPARISON</span>
          <h1 id="compare-title">지역별 비교</h1>
          <p>사용자가 선택한 두 행정동만 좌우 동일 표로 비교합니다. 원값, 단위, 기준일, 수치 차이만 표시합니다.</p>
        </div>
      </header>

      <section className="gdp-compare-controls" aria-label="비교할 행정동 선택">
        <label>
          왼쪽 행정동
          <select value={left} onChange={(event) => setLeft(event.target.value)}>
            {model.districts.map((district) => <option key={district}>{district}</option>)}
          </select>
        </label>
        <label>
          오른쪽 행정동
          <select value={right} onChange={(event) => setRight(event.target.value)}>
            {model.districts.map((district) => <option key={district}>{district}</option>)}
          </select>
        </label>
      </section>

      <section className="gdp-compare-table" aria-label="두 행정동 비교표">
        <div>
          <span>항목</span>
          <strong>주민등록 인구</strong>
          <small>단위: 명 · 기준: {model.asOf}</small>
        </div>
        <div>
          <span>{left || "선택 없음"}</span>
          <strong>{leftValue ? leftValue.toLocaleString("ko-KR") : "—"}</strong>
          <small>원값</small>
        </div>
        <div>
          <span>{right || "선택 없음"}</span>
          <strong>{rightValue ? rightValue.toLocaleString("ko-KR") : "—"}</strong>
          <small>원값</small>
        </div>
        <div>
          <span>차이</span>
          <strong>{diff ? Math.abs(diff).toLocaleString("ko-KR") : "—"}</strong>
          <small>방향 판단 없이 수치 차이만 표시</small>
        </div>
      </section>
    </section>
  );
}
