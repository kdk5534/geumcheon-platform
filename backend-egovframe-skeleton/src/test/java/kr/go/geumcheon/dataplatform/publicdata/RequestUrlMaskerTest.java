package kr.go.geumcheon.dataplatform.publicdata;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RequestUrlMaskerTest {

    @Test
    void masksDataGoKrServiceKey() {
        String masked = RequestUrlMasker.mask(
                "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius?ServiceKey=abc123&cx=126.8954&cy=37.4568"
        );

        assertThat(masked).contains("ServiceKey=[redacted]");
        assertThat(masked).doesNotContain("abc123");
    }

    @Test
    void masksSeoulOpenApiKey() {
        String masked = RequestUrlMasker.mask(
                "https://openAPI.seoul.go.kr:8088/secret-key/json/ListAirQualityByDistrictService/1/25/"
        );

        assertThat(masked).contains("https://openAPI.seoul.go.kr:8088/[redacted]/json/");
        assertThat(masked).doesNotContain("secret-key");
    }
}
