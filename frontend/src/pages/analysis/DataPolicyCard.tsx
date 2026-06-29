// 분석 페이지 데이터 기준·표시 정책을 압축한 접이식 컴포넌트
import { Link } from "react-router-dom";
import "./DataPolicyCard.css";

interface EvidenceItem {
  label: string;
  value: string;
  note: string;
}

interface Props {
  asOf: string;
  sourceMode: string;
  evidence: EvidenceItem[];
  datasetsLink?: string;
  lens?: Array<{ label: string; value: string; note: string }>;
}

export function DataPolicyCard({ asOf, sourceMode, evidence, datasetsLink, lens }: Props) {
  return (
    <details className="gdp-policy-card">
      <summary className="gdp-policy-card__summary">
        <span className="gdp-policy-card__label">데이터 기준·표시 정책</span>
        <span className="gdp-policy-card__meta">
          기준일 {asOf} · {sourceMode} · 순위·점수 없음
        </span>
        <span className="gdp-policy-card__chevron" aria-hidden="true">›</span>
      </summary>

      <div className="gdp-policy-card__body">
        {lens && lens.length > 0 && (
          <div className="gdp-policy-card__section">
            <p className="gdp-policy-card__section-title">분석 관점</p>
            <ul className="gdp-policy-card__list">
              {lens.map((item) => (
                <li key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.note}</small>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="gdp-policy-card__section">
          <p className="gdp-policy-card__section-title">데이터 근거</p>
          <ul className="gdp-policy-card__list">
            {evidence.map((item) => (
              <li key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.note}</small>
              </li>
            ))}
          </ul>
        </div>

        <div className="gdp-policy-card__principles">
          <span>공개 범위 금천구 GEUMCHEON</span>
          <span>표현 정책 순위·점수·우수/취약 없음</span>
          <span>수집 실패·좌표 누락 화면에서 숨기지 않음</span>
        </div>

        {datasetsLink && (
          <Link className="gdp-policy-card__link" to={datasetsLink}>
            관련 데이터셋 확인 →
          </Link>
        )}
      </div>
    </details>
  );
}
