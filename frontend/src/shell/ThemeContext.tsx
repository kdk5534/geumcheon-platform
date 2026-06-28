// 테마 Context — 앱 전체에 현재 테마(light|dark)를 공유하는 Context·훅
import { createContext, useContext } from "react";

export type Theme = "light" | "dark";

/**
 * 현재 테마값(light|dark)을 담는 Context.
 * AppShell의 로컬 state를 값으로 주입한다.
 * Provider는 AppShell이 제공하므로 별도 ThemeProvider 불필요.
 */
export const ThemeContext = createContext<Theme>("light");

/** 현재 테마를 구독하는 훅 — 차트·지도 컴포넌트에서 theme 변화를 감지할 때 사용 */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}
