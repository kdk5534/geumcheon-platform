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
                "부분 구현·실키 검증 필요",
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
                "한국환경공단 에어코리아",
                "시간",
                "실키 검증 완료",
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
                "https://www.data.go.kr/data/15073861/openapi.do",
                "AREA",
                "DATA_GO_KR_API_KEY",
                "대기환경"
        ));
        items.put("bike-stations", new DatasetDefinition(
                "bike-stations",
                "공공자전거 따릉이 대여소",
                "생활",
                "서울 열린데이터광장",
                "반기",
                "공식 HTTPS 파일 자동수집",
                false,
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
                "",
                "생활지도"
        ));
        items.put("cctv-stations", new DatasetDefinition(
                "cctv-stations",
                "금천구 CCTV 위치",
                "안전",
                "행정안전부 지방행정인허가시스템",
                "매일",
                "CSV 관리자 업로드",
                false,
                "CSV",
                true,
                true,
                true,
                List.of("id", "latitude", "longitude"),
                List.of(
                        new DatasetFieldDefinition("id", "관리번호"),
                        new DatasetFieldDefinition("purpose", "설치목적구분"),
                        new DatasetFieldDefinition("roadAddress", "소재지도로명주소"),
                        new DatasetFieldDefinition("lotAddress", "소재지지번주소"),
                        new DatasetFieldDefinition("phone", "관리기관전화번호"),
                        new DatasetFieldDefinition("latitude", "위도"),
                        new DatasetFieldDefinition("longitude", "경도"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                "https://www.data.go.kr/data/15013094/standard.do",
                "POINT",
                "",
                "생활지도"
        ));
        items.put("parking-lots", new DatasetDefinition(
                "parking-lots",
                "전국주차장정보표준데이터(금천구)",
                "교통",
                "공공데이터포털 전국주차장정보표준데이터",
                "매일",
                "실키 검증 완료",
                true,
                "API",
                false,
                false,
                true,
                List.of("prkplceNm", "latitude", "longitude"),
                List.of(
                        new DatasetFieldDefinition("prkplceNm", "주차장명"),
                        new DatasetFieldDefinition("prkplceType", "종류"),
                        new DatasetFieldDefinition("prkcmprt", "총 주차면"),
                        new DatasetFieldDefinition("rdnmadr", "주소"),
                        new DatasetFieldDefinition("latitude", "위도"),
                        new DatasetFieldDefinition("longitude", "경도"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                "https://www.data.go.kr/data/15012896/standard.do",
                "POINT",
                "DATA_GO_KR_API_KEY",
                "생활지도"
        ));
        items.put("parking-spaces", new DatasetDefinition(
                "parking-spaces",
                "서울 주차 공간 참고자료",
                "교통",
                "서울 열린데이터광장 구 주차 원천",
                "갱신 중단",
                "참고자료 보존",
                false,
                "REFERENCE",
                false,
                false,
                true,
                List.of("sourceOriginalId", "latitude", "longitude"),
                List.of(
                        new DatasetFieldDefinition("sourceOriginalId", "구 원천 주차장 ID"),
                        new DatasetFieldDefinition("name", "주차장명"),
                        new DatasetFieldDefinition("address", "주소"),
                        new DatasetFieldDefinition("latitude", "주차 공간 위도"),
                        new DatasetFieldDefinition("longitude", "주차 공간 경도"),
                        new DatasetFieldDefinition("spatialScope", "공간 범위")
                ),
                "https://data.seoul.go.kr/",
                "POINT",
                "",
                "데이터 카탈로그"
        ));
        items.put("population", new DatasetDefinition(
                "population",
                "행정동별 주민등록인구",
                "인구",
                "행정안전부",
                "월",
                "부분 구현·실키 검증 필요",
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
                "매일", "격리 중계 연결", true, "API", false, false, true,
                List.of("name", "latitude", "longitude"),
                List.of(
                        new DatasetFieldDefinition("name", "AP 설치장소명"),
                        new DatasetFieldDefinition("address", "설치위치"),
                        new DatasetFieldDefinition("latitude", "위도"),
                        new DatasetFieldDefinition("longitude", "경도"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                "https://data.geumcheon.go.kr/openinf/openapiview.jsp?infId=OA-20906",
                "POINT", "WIFI_RELAY_TOKEN", "생활지도"
        ));
        items.put("heat-shelters", new DatasetDefinition(
                "heat-shelters", "무더위쉼터", "안전·복지", "서울특별시·서울안전누리",
                "비정기(자료변경시)", "공식 원천 확인·연계 자격 대기", true, "API", false, false, true,
                List.of("name", "latitude", "longitude"),
                List.of(
                        new DatasetFieldDefinition("name", "시설명"),
                        new DatasetFieldDefinition("address", "주소"),
                        new DatasetFieldDefinition("latitude", "위도"),
                        new DatasetFieldDefinition("longitude", "경도"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                "https://data.seoul.go.kr/dataList/OA-21065/S/1/datasetView.do",
                "POINT", "SAFETY_DATA_API_KEY", "생활지도"
        ));
        items.put("school-zones", new DatasetDefinition(
                "school-zones", "어린이 보호구역", "안전", "공공데이터포털 전국어린이보호구역표준데이터",
                "반기", "공식 대표 위치 API", true, "API", false, false, true,
                List.of("name", "latitude", "longitude"),
                List.of(
                        new DatasetFieldDefinition("name", "구역명"),
                        new DatasetFieldDefinition("address", "주소"),
                        new DatasetFieldDefinition("latitude", "위도"),
                        new DatasetFieldDefinition("longitude", "경도"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                "https://www.data.go.kr/data/15012891/standard.do",
                "POINT", "DATA_GO_KR_API_KEY", "생활지도"
        ));
        items.put("ev-chargers", new DatasetDefinition(
                "ev-chargers", "전기차 충전소", "교통", "금천구·서울 열린데이터광장",
                "비정기(자료변경시)", "공식 위치·충전 규격 XLSX", false, "API", false, false, true,
                List.of("name", "latitude", "longitude"),
                List.of(
                        new DatasetFieldDefinition("name", "충전소명"),
                        new DatasetFieldDefinition("address", "주소"),
                        new DatasetFieldDefinition("latitude", "위도"),
                        new DatasetFieldDefinition("longitude", "경도"),
                        new DatasetFieldDefinition("chargerType", "충전기 규격"),
                        new DatasetFieldDefinition("capacity", "충전용량"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                "https://data.seoul.go.kr/dataList/OA-13233/F/1/datasetView.do",
                "POINT", "", "생활지도"
        ));
        items.put("welfare-facilities", new DatasetDefinition(
                "welfare-facilities", "사회복지시설", "복지", "금천구 열린데이터광장",
                "월", "격리 중계 연결·이용조건 검토", true, "API", false, false, true,
                List.of("name", "address"),
                List.of(
                        new DatasetFieldDefinition("sourceOriginalId", "시설코드"),
                        new DatasetFieldDefinition("name", "시설명"),
                        new DatasetFieldDefinition("facilityType", "시설유형"),
                        new DatasetFieldDefinition("address", "시설주소"),
                        new DatasetFieldDefinition("phone", "전화번호"),
                        new DatasetFieldDefinition("capacity", "정원"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                "https://data.geumcheon.go.kr/openinf/openapiview.jsp?infId=OA-20394",
                "POINT", "LIVING_FACILITY_RELAY_TOKEN", "생활지도"
        ));
        items.put("civil-defense-shelters", new DatasetDefinition(
                "civil-defense-shelters", "민방위 대피시설", "안전", "금천구 열린데이터광장",
                "월", "격리 중계 연결·이용조건 검토", true, "API", false, false, true,
                List.of("name", "address"),
                List.of(
                        new DatasetFieldDefinition("sourceOriginalId", "관리번호"),
                        new DatasetFieldDefinition("name", "시설명"),
                        new DatasetFieldDefinition("address", "도로명·지번주소"),
                        new DatasetFieldDefinition("businessStatus", "운영상태"),
                        new DatasetFieldDefinition("updatedAt", "최종수정일"),
                        new DatasetFieldDefinition("latitude", "위도"),
                        new DatasetFieldDefinition("longitude", "경도"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                "https://data.geumcheon.go.kr/openinf/openapiview.jsp?infId=OA-20044",
                "POINT", "LIVING_FACILITY_RELAY_TOKEN", "생활지도"
        ));
        items.put("hospitals", new DatasetDefinition(
                "hospitals", "병원", "보건", "금천구 열린데이터광장",
                "주", "격리 중계 연결·이용조건 검토", true, "API", false, false, true,
                List.of("name", "address"),
                List.of(
                        new DatasetFieldDefinition("sourceOriginalId", "관리번호"),
                        new DatasetFieldDefinition("name", "병원명"),
                        new DatasetFieldDefinition("address", "도로명·지번주소"),
                        new DatasetFieldDefinition("phone", "전화번호"),
                        new DatasetFieldDefinition("businessStatus", "운영상태"),
                        new DatasetFieldDefinition("medicalType", "의료기관 종별"),
                        new DatasetFieldDefinition("medicalSubjects", "진료과목"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                "https://data.geumcheon.go.kr/openinf/openapiview.jsp?infId=OA-16176",
                "POINT", "LIVING_FACILITY_RELAY_TOKEN", "생활지도"
        ));
        items.put("pharmacies", new DatasetDefinition(
                "pharmacies", "약국", "보건", "금천구 열린데이터광장",
                "주", "격리 중계 연결·이용조건 검토", true, "API", false, false, true,
                List.of("name", "address"),
                List.of(
                        new DatasetFieldDefinition("sourceOriginalId", "관리번호"),
                        new DatasetFieldDefinition("name", "약국명"),
                        new DatasetFieldDefinition("address", "도로명·지번주소"),
                        new DatasetFieldDefinition("phone", "전화번호"),
                        new DatasetFieldDefinition("businessStatus", "운영상태"),
                        new DatasetFieldDefinition("updatedAt", "최종수정일"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                "https://data.geumcheon.go.kr/openinf/openapiview.jsp?infId=OA-16327",
                "POINT", "LIVING_FACILITY_RELAY_TOKEN", "생활지도"
        ));
        items.put("childcare-centers", new DatasetDefinition(
                "childcare-centers", "어린이집", "보육", "금천구 열린데이터광장",
                "월", "격리 중계 연결·이용조건 검토", true, "API", false, false, true,
                List.of("name", "address", "latitude", "longitude"),
                List.of(
                        new DatasetFieldDefinition("sourceOriginalId", "어린이집코드"),
                        new DatasetFieldDefinition("name", "어린이집명"),
                        new DatasetFieldDefinition("childcareType", "어린이집유형"),
                        new DatasetFieldDefinition("businessStatus", "운영현황"),
                        new DatasetFieldDefinition("address", "상세주소"),
                        new DatasetFieldDefinition("phone", "전화번호"),
                        new DatasetFieldDefinition("capacity", "정원"),
                        new DatasetFieldDefinition("currentChildren", "현원"),
                        new DatasetFieldDefinition("latitude", "위도"),
                        new DatasetFieldDefinition("longitude", "경도"),
                        new DatasetFieldDefinition("referenceDate", "데이터기준일"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                "https://data.geumcheon.go.kr/openinf/openapiview.jsp?infId=OA-20318",
                "POINT", "LIVING_FACILITY_RELAY_TOKEN", "생활지도"
        ));
        // Phase 1 — 산업·상권(G밸리 특화) 신규
        items.put("knowledge-industry-center", new DatasetDefinition(
                "knowledge-industry-center", "지식산업센터", "산업", "공공데이터포털 금천구 지식산업센터 정보",
                "비정기(자료변경시)", "번들 CSV 자동적재", false, "API", false, false, true,
                List.of("name", "latitude", "longitude"),
                List.of(
                        new DatasetFieldDefinition("name", "시설명"),
                        new DatasetFieldDefinition("location", "G밸리 입지"),
                        new DatasetFieldDefinition("address", "도로명주소"),
                        new DatasetFieldDefinition("latitude", "위도"),
                        new DatasetFieldDefinition("longitude", "경도"),
                        new DatasetFieldDefinition("status", "운영상태"),
                        new DatasetFieldDefinition("completionDate", "준공일"),
                        new DatasetFieldDefinition("buildingArea", "건축연면적(㎡)"),
                        new DatasetFieldDefinition("source", "출처")
                ),
                "https://www.data.go.kr/data/15034153/fileData.do",
                "POINT", "", "생활지도"
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
