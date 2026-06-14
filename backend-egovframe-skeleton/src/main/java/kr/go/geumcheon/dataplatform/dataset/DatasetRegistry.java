package kr.go.geumcheon.dataplatform.dataset;

import kr.go.geumcheon.dataplatform.admin.AdminDatasetSummary;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class DatasetRegistry {

    private final Map<String, DatasetDefinition> definitions;

    public DatasetRegistry() {
        Map<String, DatasetDefinition> items = new LinkedHashMap<>();
        items.put("facilities", new DatasetDefinition(
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
                true,
                List.of("id", "category", "name", "address", "latitude", "longitude"),
                List.of(
                        new DatasetFieldDefinition("id", "고유 ID"),
                        new DatasetFieldDefinition("category", "시설 분류"),
                        new DatasetFieldDefinition("name", "시설명"),
                        new DatasetFieldDefinition("address", "주소"),
                        new DatasetFieldDefinition("phone", "전화번호"),
                        new DatasetFieldDefinition("latitude", "위도"),
                        new DatasetFieldDefinition("longitude", "경도"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                null,
                null,
                null,
                "생활지도"
        ));
        items.put("stores", new DatasetDefinition(
                "stores",
                "상가업소 정보",
                "상권",
                "소상공인시장진흥공단",
                "수시",
                "API 가능",
                true,
                "API/CSV",
                true,
                true,
                true,
                List.of("name", "address"),
                List.of(
                        new DatasetFieldDefinition("id", "상가 ID"),
                        new DatasetFieldDefinition("name", "상호명"),
                        new DatasetFieldDefinition("category", "업종"),
                        new DatasetFieldDefinition("address", "주소"),
                        new DatasetFieldDefinition("phone", "전화번호"),
                        new DatasetFieldDefinition("latitude", "위도"),
                        new DatasetFieldDefinition("longitude", "경도"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                "https://www.data.go.kr/data/15012005/openapi.do",
                "POINT",
                "DATA_GO_KR_API_KEY",
                "상권분석"
        ));
        items.put("air-quality", new DatasetDefinition(
                "air-quality",
                "미세먼지/초미세먼지",
                "실시간",
                "서울 열린데이터광장",
                "시간",
                "API 가능",
                true,
                "API",
                false,
                false,
                true,
                List.of("stationName", "measuredAt"),
                List.of(
                        new DatasetFieldDefinition("stationName", "측정소"),
                        new DatasetFieldDefinition("measuredAt", "측정 일시"),
                        new DatasetFieldDefinition("pm10", "미세먼지"),
                        new DatasetFieldDefinition("pm25", "초미세먼지"),
                        new DatasetFieldDefinition("status", "상태"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                "https://data.seoul.go.kr/dataList/OA-1200/A/1/datasetView.do",
                "AREA",
                "SEOUL_OPEN_API_KEY",
                "대기환경"
        ));
        items.put("population", new DatasetDefinition(
                "population",
                "인구 통계",
                "인구",
                "서울 열린데이터광장",
                "월",
                "CSV/API",
                false,
                "CSV",
                true,
                true,
                true,
                List.of("areaName", "baseDate", "populationTotal"),
                List.of(
                        new DatasetFieldDefinition("areaName", "행정동"),
                        new DatasetFieldDefinition("baseDate", "기준일"),
                        new DatasetFieldDefinition("populationTotal", "총인구"),
                        new DatasetFieldDefinition("male", "남성"),
                        new DatasetFieldDefinition("female", "여성"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                null,
                null,
                null,
                "인구 대시보드"
        ));
        this.definitions = Collections.unmodifiableMap(items);
    }

    public List<DatasetDefinition> listAll() {
        return definitions.values().stream().toList();
    }

    public List<DatasetSummary> listDatasetSummaries() {
        return listAll().stream().map(DatasetDefinition::toDatasetSummary).toList();
    }

    public List<AdminDatasetSummary> listAdminDatasetSummaries() {
        return listAll().stream().map(DatasetDefinition::toAdminDatasetSummary).toList();
    }

    public DatasetDefinition find(String datasetKey) {
        if (datasetKey == null || datasetKey.isBlank()) {
            return null;
        }
        return definitions.get(datasetKey);
    }

    public DatasetDefinition getRequired(String datasetKey) {
        DatasetDefinition definition = find(datasetKey);
        if (definition == null) {
            throw new IllegalArgumentException("Unknown datasetKey: " + datasetKey);
        }
        return definition;
    }
}
