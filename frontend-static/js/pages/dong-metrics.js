export function averageDistrictScore(district) {
  const values = Object.values(district?.scores || {})
    .filter((value) => Number.isFinite(value));

  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + Number(value), 0) / values.length;
}

export function rankDistricts(districts = []) {
  return [...districts]
    .map((district) => ({
      ...district,
      avgScore: averageDistrictScore(district),
    }))
    .sort((left, right) => right.avgScore - left.avgScore);
}

export function averageScoreAcrossDistricts(districts = []) {
  if (districts.length === 0) return 0;
  return districts.reduce((sum, district) => sum + averageDistrictScore(district), 0)
    / districts.length;
}

function populationCounts(population) {
  return (population?.byAge || []).reduce((counts, row) => {
    const count = Number(row.male || 0) + Number(row.female || 0);
    return {
      total: counts.total + count,
      elderly: counts.elderly + (["60~69세", "70세 이상"].includes(row.ageBand) ? count : 0),
    };
  }, { total: 0, elderly: 0 });
}

export function getPopulationElderlyRatio(population) {
  if (!population) return "";
  const { total, elderly } = populationCounts(population);
  return total > 0 ? (elderly / total * 100).toFixed(1) : "";
}

export function getElderlyRatio(population = []) {
  const counts = population.reduce((total, district) => {
    const current = populationCounts(district);
    return {
      total: total.total + current.total,
      elderly: total.elderly + current.elderly,
    };
  }, { total: 0, elderly: 0 });
  return counts.total > 0 ? (counts.elderly / counts.total * 100).toFixed(1) : "";
}

export function getDistrictAverages(districts = [], metrics = ["생활", "교통", "안전"]) {
  return Object.fromEntries(metrics.map((metric) => {
    const values = districts
      .map((district) => Number(district.scores?.[metric]))
      .filter(Number.isFinite);
    const average = values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
    return [metric, average];
  }));
}

export function formatDelta(value, average, label, unit = "점") {
  const delta = Number(value) - Number(average);
  const direction = delta > 0 ? "높음" : delta < 0 ? "낮음" : "같음";
  const absolute = Math.abs(delta);
  const formatted = unit === "명" ? Math.round(absolute).toLocaleString() : absolute.toFixed(1);
  return `${label}보다 ${formatted}${unit} ${direction}`;
}

export function buildDistrictComparisonRows(district, averages, metrics = ["생활", "교통", "안전"]) {
  if (!district) return [];
  return metrics.map((metric) => {
    const value = Number(district.scores?.[metric] || 0);
    const average = Number(averages?.[metric] || 0);
    return {
      metric,
      value,
      average,
      delta: value - average,
      summary: formatDelta(value, average, "구 평균"),
    };
  });
}
