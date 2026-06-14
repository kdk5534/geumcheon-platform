// 이용안내 페이지: 금천 데이터플랫폼 소개·데이터 출처·관련 사이트

const CSS_ID = 'css-about';

function injectCss() {
  if (document.getElementById(CSS_ID)) return;
  const link = document.createElement('link');
  link.id = CSS_ID;
  link.rel = 'stylesheet';
  link.href = './css/pages/about.css';
  document.head.appendChild(link);
}

const DATA_SOURCES = [
  { org: '행정안전부', dataset: '주민등록 인구통계', cycle: '월간', link: 'https://jumin.mois.go.kr' },
  { org: '서울시', dataset: '서울 열린데이터 광장', cycle: '실시간/일간', link: 'https://data.seoul.go.kr' },
  { org: '공공데이터포털', dataset: '사업체 기본통계', cycle: '연간', link: 'https://data.go.kr' },
  { org: '국토교통부', dataset: '도로명주소 및 시설물', cycle: '분기', link: 'https://www.molit.go.kr' },
  { org: '환경부', dataset: '대기오염도 현황', cycle: '실시간', link: 'https://www.airkorea.or.kr' },
  { org: '경찰청', dataset: '범죄 통계', cycle: '연간', link: 'https://www.police.go.kr' },
  { org: '소방청', dataset: '화재·구조 통계', cycle: '연간', link: 'https://www.nfa.go.kr' },
  { org: '금천구청', dataset: '구정 통계·복지 현황', cycle: '수시', link: 'https://www.geumcheon.go.kr' },
];

const RELATED_LINKS = [
  { label: '금천구청 공식 홈페이지', url: 'https://www.geumcheon.go.kr', icon: '🏛️', desc: '금천구 공식 행정 포털' },
  { label: '서울 열린데이터광장', url: 'https://data.seoul.go.kr', icon: '📊', desc: '서울시 공공데이터 개방 플랫폼' },
  { label: '공공데이터포털', url: 'https://data.go.kr', icon: '🗂️', desc: '대한민국 국가 공공데이터 포털' },
  { label: '에어코리아', url: 'https://www.airkorea.or.kr', icon: '🌿', desc: '실시간 대기질 정보 서비스' },
];

const FEATURES = [
  { icon: '📡', title: '실시간 도시현황', desc: '재난·교통·환경·안전 상황을 지도와 차트로 실시간 모니터링합니다.' },
  { icon: '📈', title: '분야별 지표 대시보드', desc: '인구·경제·복지·보건·환경·교통·안전 7개 분야의 핵심 지표를 한눈에 확인합니다.' },
  { icon: '🗺️', title: '생활지도', desc: '금천구 3개 행정동의 시설·교통·안전 정보를 지도 위에서 탐색합니다.' },
  { icon: '🏪', title: '상권분석', desc: '업종별·지역별 상권 현황과 트렌드를 차트와 테이블로 분석합니다.' },
  { icon: '👥', title: '인구분석', desc: '행정동별 연령 구조·인구 피라미드·인구 변동 추이를 시각화합니다.' },
  { icon: '🗂️', title: '데이터 카탈로그', desc: '금천구 공공데이터셋을 검색·필터·다운로드할 수 있는 데이터 목록입니다.' },
];

export function mount(container) {
  injectCss();

  container.innerHTML = `
    <div class="about-hero">
      <div class="about-hero-inner">
        <img src="./assets/brand/emblem-30th.png" alt="금천구 개청 30주년" class="about-hero-emblem">
        <div class="about-hero-text">
          <h2 class="about-hero-title">금천 데이터플랫폼</h2>
          <p class="about-hero-subtitle">Geumcheon Data Platform</p>
          <p class="about-hero-desc">금천구민의 일상과 가장 가까운 도시 데이터를<br>한 화면에서 확인하고 분석할 수 있는<br>공공 빅데이터 통합 플랫폼입니다.</p>
        </div>
      </div>
      <div class="about-hero-stats">
        <div class="about-hero-stat">
          <strong class="about-hero-stat-val">7</strong>
          <span class="about-hero-stat-label">분야</span>
        </div>
        <div class="about-hero-stat">
          <strong class="about-hero-stat-val">24종</strong>
          <span class="about-hero-stat-label">데이터셋</span>
        </div>
        <div class="about-hero-stat">
          <strong class="about-hero-stat-val">8개</strong>
          <span class="about-hero-stat-label">수집 기관</span>
        </div>
        <div class="about-hero-stat">
          <strong class="about-hero-stat-val">247,483</strong>
          <span class="about-hero-stat-label">금천구 인구</span>
        </div>
        <div class="about-hero-stat">
          <strong class="about-hero-stat-val">실시간</strong>
          <span class="about-hero-stat-label">갱신 데이터</span>
        </div>
      </div>
    </div>

    <section class="about-section">
      <h3 class="about-section-title">플랫폼 소개</h3>
      <p class="about-desc">금천 데이터플랫폼은 서울특별시 금천구청 스마트도시과가 운영하는 공공 빅데이터 시각화 서비스입니다.
        금천구의 인구·경제·복지·환경·교통·안전 데이터를 수집·가공하여 구민과 정책 담당자에게 직관적인 인사이트를 제공합니다.
        본 플랫폼의 통계·수치는 공공데이터 및 시범 운영 Mock 데이터를 포함하며,
        실제 행정 결정에 참고할 경우 원본 출처 데이터를 반드시 확인하시기 바랍니다.</p>
    </section>

    <section class="about-section">
      <h3 class="about-section-title">주요 기능</h3>
      <div class="about-features-grid">
        ${FEATURES.map(f => `
          <div class="about-feature-card">
            <span class="about-feature-icon">${f.icon}</span>
            <strong class="about-feature-title">${f.title}</strong>
            <p class="about-feature-desc">${f.desc}</p>
          </div>
        `).join('')}
      </div>
    </section>

    <section class="about-section">
      <h3 class="about-section-title">데이터 출처</h3>
      <div class="about-table-wrap">
        <table class="about-table">
          <thead>
            <tr>
              <th>제공 기관</th>
              <th>데이터셋</th>
              <th>갱신 주기</th>
              <th>바로가기</th>
            </tr>
          </thead>
          <tbody>
            ${DATA_SOURCES.map(s => `
              <tr>
                <td>${s.org}</td>
                <td>${s.dataset}</td>
                <td>${s.cycle}</td>
                <td><a href="${s.link}" target="_blank" rel="noopener noreferrer" class="about-source-link">방문하기 ↗</a></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <section class="about-section">
      <h3 class="about-section-title">관련 사이트</h3>
      <div class="about-links-grid">
        ${RELATED_LINKS.map(l => `
          <a class="about-link-card" href="${l.url}" target="_blank" rel="noopener noreferrer">
            <span class="about-link-icon">${l.icon}</span>
            <strong class="about-link-label">${l.label}</strong>
            <p class="about-link-desc">${l.desc}</p>
            <span class="about-link-arrow">↗</span>
          </a>
        `).join('')}
      </div>
    </section>

    <section class="about-section about-contact">
      <h3 class="about-section-title">문의처</h3>
      <div class="about-contact-grid">
        <div class="about-contact-item">
          <span class="about-contact-label">담당부서</span>
          <span>서울특별시 금천구청 스마트도시과</span>
        </div>
        <div class="about-contact-item">
          <span class="about-contact-label">주소</span>
          <span>서울특별시 금천구 시흥대로73길 70</span>
        </div>
        <div class="about-contact-item">
          <span class="about-contact-label">대표전화</span>
          <span>02-2627-1000</span>
        </div>
        <div class="about-contact-item">
          <span class="about-contact-label">운영시간</span>
          <span>평일 09:00–18:00 (점심 12:00–13:00)</span>
        </div>
      </div>
    </section>
  `;
}

export function unmount() {}
