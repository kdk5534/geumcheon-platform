// 행정동별 주민등록인구 요약 DTO (인구 분석 화면용)
package kr.go.geumcheon.dataplatform.publicdata;

import java.util.List;

public record PopulationSummary(
        String areaName,
        long total,
        long male,
        long female,
        List<AgeBand> byAge,
        String observedAt
) {
    public PopulationSummary(String areaName, long total, long male, long female, List<AgeBand> byAge) {
        this(areaName, total, male, female, byAge, null);
    }

    public record AgeBand(String ageBand, long male, long female) {}
}
