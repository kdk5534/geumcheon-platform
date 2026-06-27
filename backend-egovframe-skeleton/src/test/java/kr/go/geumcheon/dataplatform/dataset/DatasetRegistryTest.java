package kr.go.geumcheon.dataplatform.dataset;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DatasetRegistryTest {

    private final DatasetRegistry registry = new DatasetRegistry();

    @Test
    void collectorDatasetsExposeHonestOperationalReadiness() {
        List<String> partial = List.of(
                "stores", "population"
        );

        assertThat(partial)
                .allSatisfy(key -> assertThat(registry.getRequired(key).apiStatus())
                        .isEqualTo("부분 구현·실키 검증 필요"));
        assertThat(registry.getRequired("heat-shelters").apiStatus()).contains("연계 자격 대기");
        assertThat(registry.getRequired("school-zones").apiStatus()).isEqualTo("공식 대표 위치 API");
        assertThat(registry.getRequired("ev-chargers").apiStatus()).isEqualTo("공식 위치·충전 규격 XLSX");
        assertThat(List.of("heat-shelters", "school-zones", "ev-chargers"))
                .allSatisfy(key -> assertThat(registry.getRequired(key).publicVisible()).isTrue());
        assertThat(registry.getRequired("cctv-stations").apiStatus()).isEqualTo("CSV 관리자 업로드");
        assertThat(registry.getRequired("cctv-stations").authKeyRequired()).isFalse();
        assertThat(registry.getRequired("cctv-stations").supportsUploadCommit()).isTrue();
        assertThat(List.of("air-quality", "parking-lots"))
                .allSatisfy(key -> assertThat(registry.getRequired(key).apiStatus()).isEqualTo("실키 검증 완료"));
        assertThat(registry.getRequired("parking-spaces").apiStatus()).isEqualTo("참고자료 보존");
        assertThat(registry.getRequired("bike-stations").apiStatus()).isEqualTo("공식 HTTPS 파일 자동수집");
        assertThat(registry.getRequired("bike-stations").authKeyRequired()).isFalse();
        assertThat(registry.getRequired("bike-stations").refreshCycle()).isEqualTo("반기");
        assertThat(registry.getRequired("public-wifi").apiStatus()).isEqualTo("격리 중계 연결");
        assertThat(registry.getRequired("public-wifi").envVarName()).isEqualTo("WIFI_RELAY_TOKEN");
        assertThat(registry.getRequired("public-wifi").refreshCycle()).isEqualTo("매일");
        assertThat(registry.getRequired("parking-spaces").publicVisible()).isTrue();
        assertThat(List.of(
                "welfare-facilities", "civil-defense-shelters", "hospitals",
                "pharmacies", "childcare-centers"
        )).allSatisfy(key -> {
            assertThat(registry.getRequired(key).apiStatus()).contains("격리 중계 연결");
            assertThat(registry.getRequired(key).envVarName()).isEqualTo("LIVING_FACILITY_RELAY_TOKEN");
            assertThat(registry.getRequired(key).publicVisible()).isTrue();
        });
    }

    @Test
    void geumcheonSourcesUseOfficialDatasetDetailUrls() {
        assertThat(registry.getRequired("cctv-stations").sourceUrl()).contains("15013094/standard.do");
        assertThat(registry.getRequired("parking-lots").sourceUrl()).contains("15012896/standard.do");
        assertThat(registry.getRequired("public-wifi").sourceUrl()).contains("OA-20906");
        assertThat(registry.getRequired("heat-shelters").sourceUrl()).contains("OA-21065");
        assertThat(registry.getRequired("school-zones").sourceUrl()).contains("15012891/standard.do");
        assertThat(registry.getRequired("ev-chargers").sourceUrl()).contains("OA-13233");
        assertThat(registry.getRequired("welfare-facilities").sourceUrl()).contains("OA-20394");
        assertThat(registry.getRequired("civil-defense-shelters").sourceUrl()).contains("OA-20044");
        assertThat(registry.getRequired("hospitals").sourceUrl()).contains("OA-16176");
        assertThat(registry.getRequired("pharmacies").sourceUrl()).contains("OA-16327");
        assertThat(registry.getRequired("childcare-centers").sourceUrl()).contains("OA-20318");
        // Phase 1 신규
        assertThat(registry.getRequired("traditional-markets").sourceUrl()).contains("15012894");
        assertThat(registry.getRequired("knowledge-industry-center").sourceUrl()).contains("15117154");
    }

    @Test
    void traditionalMarketIsCommercialDistrictStandardDataWithCoords() {
        var def = registry.getRequired("traditional-markets");
        assertThat(def.datasetName()).isEqualTo("전통시장");
        assertThat(def.domain()).isEqualTo("상권");
        assertThat(def.authKeyRequired()).isTrue();
        assertThat(def.envVarName()).isEqualTo("DATA_GO_KR_API_KEY");
        assertThat(def.spatialType()).isEqualTo("POINT");
        assertThat(def.publicVisible()).isTrue();
        assertThat(def.apiStatus()).contains("표준데이터 API");
        assertThat(def.requiredFields()).contains("latitude", "longitude");
    }

    @Test
    void knowledgeIndustryCenterIsG밸리SpecializedIndustrialDataset() {
        var def = registry.getRequired("knowledge-industry-center");
        assertThat(def.datasetName()).isEqualTo("지식산업센터");
        assertThat(def.domain()).isEqualTo("산업");
        assertThat(def.authKeyRequired()).isTrue();
        assertThat(def.envVarName()).isEqualTo("DATA_GO_KR_API_KEY");
        assertThat(def.spatialType()).isEqualTo("POINT");
        assertThat(def.publicVisible()).isTrue();
        assertThat(def.apiStatus()).contains("odcloud");
    }
}
