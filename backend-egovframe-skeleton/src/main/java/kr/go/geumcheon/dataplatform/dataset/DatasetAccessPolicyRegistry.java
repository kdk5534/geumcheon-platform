package kr.go.geumcheon.dataplatform.dataset;

import java.time.LocalDate;
import java.util.Map;

import static kr.go.geumcheon.dataplatform.dataset.DatasetAccessPolicy.AccessMode.REDISTRIBUTION_ALLOWED;
import static kr.go.geumcheon.dataplatform.dataset.DatasetAccessPolicy.AccessMode.SCREEN_ONLY;

public final class DatasetAccessPolicyRegistry {

    private static final LocalDate CHECKED_AT = LocalDate.of(2026, 6, 21);
    private static final Map<String, DatasetAccessPolicy> POLICIES = Map.ofEntries(
            Map.entry("cctv-stations", screenOnly("cctv-stations",
                    "공식 공개 원문 범위만 화면 공개", "https://www.data.go.kr/data/15013094/standard.do",
                    "공개 원천에 없는 촬영 방향·사각지대·내부 관리번호·장비 접근정보는 제공하지 않음"
            )),
            Map.entry("heat-shelters", redistributable("heat-shelters",
                    "공공누리 제1유형(출처표시)", "https://data.seoul.go.kr/dataList/OA-21065/S/1/datasetView.do",
                    "출처: 서울특별시·서울안전누리"
            )),
            Map.entry("school-zones", screenOnly("school-zones",
                    "이용조건 확인 전 조회 전용", "https://www.data.go.kr/data/15012891/standard.do",
                    "출처: 공공데이터포털 전국어린이보호구역표준데이터"
            )),
            Map.entry("ev-chargers", redistributable("ev-chargers",
                    "공공누리 제1유형(출처표시)", "https://data.seoul.go.kr/dataList/OA-13233/F/1/datasetView.do",
                    "출처: 금천구·서울 열린데이터광장; 기준일: 원천 파일 기준일"
            ))
    );

    private DatasetAccessPolicyRegistry() {
    }

    public static DatasetAccessPolicy get(String datasetKey) {
        return POLICIES.getOrDefault(datasetKey, screenOnly(datasetKey,
                "이용조건 확인 전 조회 전용", null, "파일 다운로드와 외부 API 재배포 금지"
        ));
    }

    private static DatasetAccessPolicy screenOnly(String key, String license, String url, String notice) {
        return new DatasetAccessPolicy(
                key, SCREEN_ONLY, false, false, license, url, CHECKED_AT, notice
        );
    }

    private static DatasetAccessPolicy redistributable(String key, String license, String url, String notice) {
        return new DatasetAccessPolicy(
                key, REDISTRIBUTION_ALLOWED, true, true, license, url, CHECKED_AT, notice
        );
    }
}
