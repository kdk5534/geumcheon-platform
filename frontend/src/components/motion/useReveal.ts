// 스크롤 등장 애니메이션 훅 — IntersectionObserver 기반, 1회성, reduced-motion 존중
import { useEffect, useRef } from "react";

interface Options {
  /** 등장 임계치 (기본 0.12 = 12% 보이면 발동) */
  threshold?: number;
  /** 루트 마진 (기본 "0px 0px -32px 0px") */
  rootMargin?: string;
}

/**
 * 반환한 ref를 요소에 붙이면 뷰포트 진입 시 `is-revealed` 클래스가 추가된다.
 * CSS에서 `.is-revealed` 전/후 opacity·transform 트랜지션을 선언해 등장 효과를 구현한다.
 * `prefers-reduced-motion: reduce`면 즉시 revealed 처리한다.
 */
export function useReveal<T extends Element = HTMLElement>(options: Options = {}) {
  const { threshold = 0.12, rootMargin = "0px 0px -32px 0px" } = options;
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      el.classList.add("is-revealed");
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-revealed");
          observer.disconnect();
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return ref;
}
