package kr.go.geumcheon.dataplatform.admin;

import kr.go.geumcheon.dataplatform.dataset.DatasetDefinition;
import kr.go.geumcheon.dataplatform.dataset.DatasetRegistry;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class UploadValidatorTest {

    private final UploadValidator validator = new UploadValidator();
    private final DatasetRegistry datasetRegistry = new DatasetRegistry();

    @Test
    void validateCommitMappingReportsMissingDuplicateAndUnknownFields() {
        DatasetDefinition dataset = datasetRegistry.find("population");

        List<String> errors = validator.validateCommitMapping(dataset, new UploadCommitRequest(
                "population",
                "upload-1",
                "population.csv",
                1,
                6,
                Map.of(
                        "행정동", "areaName",
                        "기준월", "baseDate",
                        "남성", "male",
                        "여성", "male",
                        "비고", "memo"
                )
        ));

        assertThat(errors).anySatisfy(message -> assertThat(message).contains("missing required mappings").contains("populationTotal"));
        assertThat(errors).anySatisfy(message -> assertThat(message).contains("duplicated mappings").contains("male"));
        assertThat(errors).anySatisfy(message -> assertThat(message).contains("unknown mappings").contains("memo"));
    }

    @Test
    void validateCommitCountsUsesPreviewMetadata() {
        CsvUploadDraft draft = new CsvUploadDraft(
                "upload-1",
                "facilities",
                "sample.csv",
                false,
                null,
                0,
                null,
                List.of("id", "name"),
                1,
                2,
                Instant.now()
        );

        List<String> errors = validator.validateCommitCounts(draft, new UploadCommitRequest(
                "facilities",
                "upload-1",
                "sample.csv",
                2,
                3,
                Map.of("id", "id")
        ));

        assertThat(errors).containsExactly(
                "rowCount does not match preview data (expected 1, got 2)",
                "columnCount does not match preview data (expected 2, got 3)"
        );
    }
}
