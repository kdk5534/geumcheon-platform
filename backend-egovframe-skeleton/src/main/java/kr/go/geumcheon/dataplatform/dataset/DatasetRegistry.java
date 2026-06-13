package kr.go.geumcheon.dataplatform.dataset;

import kr.go.geumcheon.dataplatform.admin.AdminDatasetSummary;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class DatasetRegistry {

    private static final Map<String, DatasetDefinition> DEFINITIONS = createDefinitions();

    private DatasetRegistry() {
    }

    public static DatasetDefinition find(String datasetKey) {
        if (datasetKey == null || datasetKey.isBlank()) {
            return null;
        }
        return DEFINITIONS.get(datasetKey);
    }

    public static List<DatasetSummary> publicSummaries() {
        return DEFINITIONS.values().stream()
                .map(DatasetDefinition::toPublicSummary)
                .toList();
    }

    public static List<AdminDatasetSummary> adminSummaries() {
        return DEFINITIONS.values().stream()
                .map(DatasetDefinition::toAdminSummary)
                .toList();
    }

    private static Map<String, DatasetDefinition> createDefinitions() {
        Map<String, DatasetDefinition> definitions = new LinkedHashMap<>();
        register(definitions, new DatasetDefinition(
                "stores",
                "상가업소 정보",
                "상권",
                "소상공인시장진흥공단",
                "수시",
                "API/CSV",
                true,
                "API/CSV",
                true,
                true,
                List.of("name", "address"),
                List.of("id", "category", "name", "address", "phone", "latitude", "longitude", "source")
        ));
        register(definitions, new DatasetDefinition(
                "air-quality",
                "대기 현황",
                "실시간",
                "서울 열린데이터광장",
                "시간",
                "API",
                true,
                "API",
                false,
                false,
                List.of("stationName", "measuredAt"),
                List.of("stationName", "measuredAt", "pm10", "pm25", "status", "source")
        ));
        register(definitions, new DatasetDefinition(
                "facilities",
                "생활시설 통합",
                "생활",
                "금천구 열린데이터광장",
                "수시",
                "CSV/API",
                false,
                "CSV",
                true,
                true,
                List.of("id", "category", "name", "address", "latitude", "longitude"),
                List.of("id", "category", "name", "address", "phone", "latitude", "longitude", "source")
        ));
        register(definitions, new DatasetDefinition(
                "population",
                "주민등록 인구",
                "인구",
                "행안부/서울 열린데이터광장",
                "월",
                "CSV/API",
                true,
                "CSV",
                true,
                true,
                List.of("areaName", "baseDate", "populationTotal"),
                List.of("areaName", "baseDate", "populationTotal", "male", "female", "source")
        ));
        return Map.copyOf(definitions);
    }

    private static void register(Map<String, DatasetDefinition> definitions, DatasetDefinition definition) {
        definitions.put(definition.datasetKey(), definition);
    }
}
