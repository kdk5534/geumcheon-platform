package kr.go.geumcheon.dataplatform.api;

import kr.go.geumcheon.dataplatform.dataset.DatasetOperationalStatusSummary;
import kr.go.geumcheon.dataplatform.publicdata.PublicDataRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PublicApiMetaFactoryTest {

    @Test
    void exposesSourceTimesAndPaginationWithoutTreatingStaleDataAsMissing() {
        PublicDataRepository repository = mock(PublicDataRepository.class);
        when(repository.listDatasetOperationalStatuses()).thenReturn(List.of(status()));
        PaginationMeta pagination = PaginationMeta.of(1, 10, 23);

        ApiMeta meta = PublicApiMetaFactory.forDataset(
                repository, "air-quality", "2026-06-20T19:00:00Z", pagination
        );

        assertThat(meta.source()).isEqualTo("에어코리아");
        assertThat(meta.observedAt()).isEqualTo("2026-06-20T19:00:00Z");
        assertThat(meta.collectedAt()).isEqualTo("2026-06-20T20:00:00Z");
        assertThat(meta.pagination().totalElements()).isEqualTo(23);
        assertThat(meta.pagination().hasNext()).isTrue();
    }

    @Test
    void classifiesFreshnessUsingDatasetSla() {
        assertThat(PublicApiMetaFactory.freshnessStatus(
                status(), Instant.parse("2026-06-21T00:01:00Z")
        )).isEqualTo("STALE");
    }

    private DatasetOperationalStatusSummary status() {
        return new DatasetOperationalStatusSummary(
                "air-quality", "대기질", "환경", "에어코리아",
                "SUCCESS", "2026-06-20T20:00:00Z", 23, 23, "NONE",
                "AVAILABLE", "2026-06-20T20:00:00Z", 23, 23
        );
    }
}
