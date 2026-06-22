package kr.go.geumcheon.dataplatform.dataset;

import kr.go.geumcheon.dataplatform.api.ApiResponse;
import kr.go.geumcheon.dataplatform.publicdata.PublicDataRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DatasetControllerTest {

    @Test
    void contractsExposeOnlyPubliclyVisibleDatasets() {
        DatasetController controller = new DatasetController(
                mock(PublicDataRepository.class),
                new DatasetRegistry(),
                "mock"
        );

        ApiResponse<List<DatasetContractSummary>> response = controller.listDatasetContracts();

        assertThat(response.success()).isTrue();
        assertThat(response.sourceMode()).isEqualTo("policy-registry");
        assertThat(response.data()).extracting(DatasetContractSummary::datasetKey)
                .contains("facilities", "stores", "air-quality", "public-wifi",
                        "heat-shelters", "school-zones", "ev-chargers");
        assertThat(response.data()).allSatisfy(contract ->
                assertThat(contract.dataOwnerRole()).isNotBlank()
        );
    }

    @Test
    void operationalStatusSeparatesLatestAttemptFromLastSuccessfulSnapshot() {
        PublicDataRepository repository = mock(PublicDataRepository.class);
        when(repository.listDatasetOperationalStatuses()).thenReturn(List.of(
                new DatasetOperationalStatusSummary(
                        "parking-lots", "전국주차장정보", "생활", "공공데이터포털",
                        "FAILED", "2026-06-20T03:00:00Z", 25, 0, "QUALITY_GATE",
                        "AVAILABLE", "2026-06-19T03:00:00Z", 131, 131
                ),
                new DatasetOperationalStatusSummary(
                        "heat-shelters", "무더위쉼터", "생활", "미확정",
                        "NO_ATTEMPT", null, 0, 0, "NONE",
                        "NO_SUCCESS", null, 0, 0
                )
        ));
        DatasetController controller = new DatasetController(repository, new DatasetRegistry(), "db");

        ApiResponse<List<DatasetOperationalStatusSummary>> response = controller.listDatasetStatuses();

        assertThat(response.success()).isTrue();
        assertThat(response.data()).filteredOn(status -> "parking-lots".equals(status.datasetKey())).singleElement().satisfies(status -> {
            assertThat(status.attemptStatus()).isEqualTo("FAILED");
            assertThat(status.failureType()).isEqualTo("QUALITY_GATE");
            assertThat(status.dataStatus()).isEqualTo("AVAILABLE");
            assertThat(status.lastSuccessSavedRecordCount()).isEqualTo(131);
        });
        assertThat(response.data()).filteredOn(status -> "heat-shelters".equals(status.datasetKey()))
                .singleElement().satisfies(status -> assertThat(status.dataStatus()).isEqualTo("NO_SUCCESS"));
    }

    @Test
    void operationalStatusAppliesSlaAndRetentionWithoutDiscardingLastSuccessCounts() {
        PublicDataRepository repository = mock(PublicDataRepository.class);
        when(repository.listDatasetOperationalStatuses()).thenReturn(List.of(
                new DatasetOperationalStatusSummary(
                        "air-quality", "대기질", "환경", "에어코리아",
                        "SUCCESS", "2026-06-21T00:00:00Z", 23, 23, "NONE",
                        "AVAILABLE", "2026-06-20T20:00:00Z", 23, 23
                )
        ));
        DatasetController controller = new DatasetController(
                repository,
                new DatasetRegistry(),
                "db",
                Clock.fixed(Instant.parse("2026-06-21T00:01:00Z"), ZoneOffset.UTC)
        );

        DatasetOperationalStatusSummary status = controller.listDatasetStatuses().data().get(0);

        assertThat(status.dataStatus()).isEqualTo("STALE");
        assertThat(status.lastSuccessSavedRecordCount()).isEqualTo(23);
    }
}
