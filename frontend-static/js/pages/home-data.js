async function loadJson(path, signal) {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error(`${path} 로드 실패: ${response.status}`);
  return response.json();
}

export function loadHomeGeoJson({ signal } = {}) {
  return loadJson("./assets/data/geumcheon-dong.geojson", signal);
}

export async function loadHomePopularDatasets({ signal, limit = 4 } = {}) {
  const data = await loadJson("./assets/data/datasets.json", signal);
  return [...(Array.isArray(data.datasets) ? data.datasets : [])]
    .sort((a, b) => Number(b.views || 0) - Number(a.views || 0))
    .slice(0, limit);
}

export async function loadHomeRealtimeSummary({ signal } = {}) {
  const data = await loadJson("./assets/data/realtime.json", signal);
  return data?.summary && typeof data.summary === "object" ? data.summary : {};
}
