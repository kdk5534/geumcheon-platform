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
        items.put("bike-stations", new DatasetDefinition(
                "bike-stations",
                "공공자전거 따릉이 대여소",
                "생활",
                "서울 열린데이터광장",
                "실시간",
                "API 가능",
                true,
                "API",
                false,
                false,
                true,
                List.of("stationName", "latitude", "longitude"),
                List.of(
                        new DatasetFieldDefinition("stationId", "대여소 ID"),
                        new DatasetFieldDefinition("stationName", "대여소명"),
                        new DatasetFieldDefinition("rackTotCnt", "거치대 수"),
                        new DatasetFieldDefinition("parkingBikeTotCnt", "현재 자전거 수"),
                        new DatasetFieldDefinition("latitude", "위도"),
                        new DatasetFieldDefinition("longitude", "경도"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                "https://data.seoul.go.kr/dataList/OA-13252/A/1/datasetView.do",
                "POINT",
                "SEOUL_OPEN_API_KEY",
                "생활지도"
        ));
        items.put("cctv-stations", new DatasetDefinition(
                "cctv-stations",
                "금천구 CCTV 위치",
                "안전",
                "서울 열린데이터광장",
                "수시",
                "API 가능",
                true,
                "API",
                false,
                false,
                true,
                List.of("name", "latitude", "longitude"),
                List.of(
                        new DatasetFieldDefinition("name", "명칭"),
                        new DatasetFieldDefinition("address", "상세주소"),
                        new DatasetFieldDefinition("latitude", "위도"),
                        new DatasetFieldDefinition("longitude", "경도"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                "https://data.seoul.go.kr/dataList/OA-12253/S/1/datasetView.do",
                "POINT",
                "SEOUL_OPEN_API_KEY",
                "생활지도"
        ));
        items.put("parking-lots", new DatasetDefinition(
                "parking-lots",
                "서울 공영주차장",
                "교통",
                "서울 열린데이터광장",
                "수시",
                "API 가능",
                true,
                "API",
                false,
                false,
                true,
                List.of("pkltNm", "latitude", "longitude"),
                List.of(
                        new DatasetFieldDefinition("pkltNm", "주차장명"),
                        new DatasetFieldDefinition("pkltKndNm", "종류"),
                        new DatasetFieldDefinition("tpkct", "총 주차면"),
                        new DatasetFieldDefinition("addr", "주소"),
                        new DatasetFieldDefinition("latitude", "위도"),
                        new DatasetFieldDefinition("longitude", "경도"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                "https://data.seoul.go.kr/dataList/OA-13122/S/1/datasetView.do",
                "POINT",
                "SEOUL_OPEN_API_KEY",
                "생활지도"
        ));
        items.put("population", new DatasetDefinition(
                "population",
                "행정동별 주민등록인구",
                "인구",
                "행정안전부",
                "월",
                "API 가능",
                true,
                "API",
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
                "https://www.data.go.kr/data/15108072/openapi.do",
                "AREA",
                "DATA_GO_KR_API_KEY",
                "인구 대시보드"
        ));
        // ── P4 신규 POINT 시설 데이터셋 ──────────────────────────────────────────
        items.put("public-wifi", new DatasetDefinition(
                "public-wifi", "공공 와이파이", "생활", "서울 열린데이터광장",
                "수시", "API 가능", true, "API", false, false, true,
                List.of("name", "latitude", "longitude"),
                List.of(
                        new DatasetFieldDefinition("name", "AP 설치장소명"),
                        new DatasetFieldDefinition("address", "설치위치"),
                        new DatasetFieldDefinition("latitude", "위도"),
                        new DatasetFieldDefinition("longitude", "경도"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                "https://data.seoul.go.kr/dataList/OA-1218/S/1/datasetView.do",
                "POINT", "SEOUL_OPEN_API_KEY", "생활지도"
        ));
        items.put("heat-shelters", new DatasetDefinition(
                "heat-shelters", "무더위·한파 쉼터", "안전·복지", "서울 열린데이터광장",
                "연", "API 가능", true, "API", false, false, true,
                List.of("name", "latitude", "longitude"),
                List.of(
                        new DatasetFieldDefinition("name", "시설명"),
                        new DatasetFieldDefinition("address", "주소"),
                        new DatasetFieldDefinition("latitude", "위도"),
                        new DatasetFieldDefinition("longitude", "경도"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                "https://data.seoul.go.kr",
                "POINT", "SEOUL_OPEN_API_KEY", "생활지도"
        ));
        items.put("school-zones", new DatasetDefinition(
                "school-zones", "어린이 보호구역", "안전", "서울 열린데이터광장",
                "수시", "API 가능", true, "API", false, false, true,
                List.of("name", "latitude", "longitude"),
                List.of(
                        new DatasetFieldDefinition("name", "구역명"),
                        new DatasetFieldDefinition("address", "주소"),
                        new DatasetFieldDefinition("latitude", "위도"),
                        new DatasetFieldDefinition("longitude", "경도"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                "https://data.seoul.go.kr",
                "POINT", "SEOUL_OPEN_API_KEY", "생활지도"
        ));
        items.put("ev-chargers", new DatasetDefinition(
                "ev-chargers", "전기차 충전소", "교통", "서울 열린데이터광장",
                "수시", "API 가능", true, "API", false, false, true,
                List.of("name", "latitude", "longitude"),
                List.of(
                        new DatasetFieldDefinition("name", "충전소명"),
                        new DatasetFieldDefinition("address", "주소"),
                        new DatasetFieldDefinition("latitude", "위도"),
                        new DatasetFieldDefinition("longitude", "경도"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                "https://data.seoul.go.kr",
                "POINT", "SEOUL_OPEN_API_KEY", "생활지도"
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
