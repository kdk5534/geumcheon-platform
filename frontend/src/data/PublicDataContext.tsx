// 전역 공개 데이터를 한 번만 로드해 모든 페이지에 공유하는 React Context
import { createContext, useContext, useEffect, useState } from "react";
import { adaptOverviewModel } from "./overviewAdapter";
import { loadPublicData } from "./publicApi";
import type { PublicDataBundle } from "./publicApi";
import { overviewModel } from "../pages/overview/overviewModel";
import type { OverviewModel } from "../pages/overview/overviewTypes";

export type LoadState = "loading" | "ready" | "fallback" | "error";

interface PublicDataState {
  bundle: PublicDataBundle;
  model: OverviewModel;
  loadState: LoadState;
}

const emptyBundle: PublicDataBundle = {
  source: "empty",
  population: [],
  facilities: [],
  stores: [],
  airQuality: [],
  apiSources: [],
  meta: {},
};

const defaultState: PublicDataState = {
  bundle: emptyBundle,
  model: overviewModel,
  loadState: "loading",
};

export const PublicDataContext = createContext<PublicDataState>(defaultState);

export function PublicDataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PublicDataState>(defaultState);

  useEffect(() => {
    const controller = new AbortController();
    loadPublicData(controller.signal)
      .then((bundle) => {
        if (controller.signal.aborted) return;
        setState({
          bundle,
          model: adaptOverviewModel(bundle),
          loadState: bundle.source === "backend" ? "ready" : "fallback",
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setState((prev) => ({ ...prev, loadState: "error" }));
      });
    return () => controller.abort();
  }, []);

  return <PublicDataContext.Provider value={state}>{children}</PublicDataContext.Provider>;
}

export function usePublicData() {
  return useContext(PublicDataContext);
}
