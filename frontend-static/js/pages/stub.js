// 미구현 페이지 placeholder: 각 라우트에 이름을 넘겨 "준비 중" 카드를 보여준다

import { escapeHtml } from "../core/dom.js";

/**
 * 지정한 이름의 stub 페이지 모듈을 반환한다.
 * @param {string} title — 페이지 이름 (예: "생활지도")
 * @param {string} description — 준비 중 설명
 */
export function createStub(title, description = "이 화면은 다음 단계에서 구현됩니다.") {
  return {
    mount(container) {
      container.innerHTML = `
        <div class="stub-page" role="main" aria-label="${escapeHtml(title)} 준비 중">
          <div style="font-size:48px" aria-hidden="true">🚧</div>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(description)}</p>
          <a class="page-back" href="#/home">← 홈으로 돌아가기</a>
        </div>
      `;
    },
    unmount() {}
  };
}
