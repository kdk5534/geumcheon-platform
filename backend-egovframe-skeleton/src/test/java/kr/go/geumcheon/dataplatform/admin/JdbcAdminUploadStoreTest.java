package kr.go.geumcheon.dataplatform.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import kr.go.geumcheon.dataplatform.dataset.DatasetRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JdbcAdminUploadStoreTest {

    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @TempDir
    Path tempDir;

    @Test
    void recordUploadSavesStoreRows() throws Exception {
        JdbcAdminUploadStore store = new JdbcAdminUploadStore(jdbcTemplate, objectMapper, tempDir.toString());
        UUID datasetId = UUID.randomUUID();
        when(jdbcTemplate.queryForObject(contains("RETURNING dataset_id"), eq(UUID.class), any(), any(), any(), any(), any(), any()))
                .thenReturn(datasetId);

        UploadLogSummary summary = store.recordUpload(
                new UploadCommitRequest("stores", "upload-1", "stores.csv", 1, 8, storeMappings()),
                DatasetRegistry.find("stores").toAdminSummary(),
                8,
                draft(
                        "stores",
                        "stores.csv",
                        List.of("id", "name", "category", "address", "phone", "latitude", "longitude", "source"),
                        "id,name,category,address,phone,latitude,longitude,source\nSTORE-1,Cafe,Cafe,Addr,02-0000-0000,37.1,126.9,Sample"
                ),
                List.of(List.of("STORE-1", "Cafe", "Cafe", "Addr", "02-0000-0000", "37.1", "126.9", "Sample"))
        );

        ArgumentCaptor<List> batchCaptor = ArgumentCaptor.forClass(List.class);
        verify(jdbcTemplate).update("DELETE FROM store_business WHERE dataset_id = ?", datasetId);
        verify(jdbcTemplate).batchUpdate(contains("INSERT INTO store_business"), batchCaptor.capture());
        assertThat(batchCaptor.getValue()).hasSize(1);
        assertThat(summary.savedRowCount()).isEqualTo(1);
        assertThat(summary.skippedRowCount()).isZero();
    }

    @Test
    void recordUploadSavesPopulationRows() throws Exception {
        JdbcAdminUploadStore store = new JdbcAdminUploadStore(jdbcTemplate, objectMapper, tempDir.toString());
        UUID datasetId = UUID.randomUUID();
        UUID indicatorId = UUID.randomUUID();
        when(jdbcTemplate.queryForObject(contains("RETURNING dataset_id"), eq(UUID.class), any(), any(), any(), any(), any(), any()))
                .thenReturn(datasetId);
        when(jdbcTemplate.queryForObject(contains("RETURNING indicator_id"), eq(UUID.class), any(), any(), any(), any(), any(), any()))
                .thenReturn(indicatorId);

        UploadLogSummary summary = store.recordUpload(
                new UploadCommitRequest("population", "upload-1", "population.csv", 1, 6, populationMappings()),
                DatasetRegistry.find("population").toAdminSummary(),
                6,
                draft(
                        "population",
                        "population.csv",
                        List.of("areaName", "baseDate", "populationTotal", "male", "female", "source"),
                        "areaName,baseDate,populationTotal,male,female,source\n가산동,2026-05-01,24000,12100,11900,Sample"
                ),
                List.of(List.of("가산동", "2026-05-01", "24000", "12100", "11900", "Sample"))
        );

        ArgumentCaptor<List> batchCaptor = ArgumentCaptor.forClass(List.class);
        verify(jdbcTemplate).update("DELETE FROM indicator_value WHERE indicator_id = ?", indicatorId);
        verify(jdbcTemplate).batchUpdate(contains("INSERT INTO indicator_value"), batchCaptor.capture());
        assertThat(batchCaptor.getValue()).hasSize(1);
        assertThat(summary.savedRowCount()).isEqualTo(1);
        assertThat(summary.skippedRowCount()).isZero();
        verify(jdbcTemplate, times(1)).queryForObject(contains("RETURNING indicator_id"), eq(UUID.class), any(), any(), any(), any(), any(), any());
    }

    private CsvUploadDraft draft(String datasetKey, String fileName, List<String> headers, String contentText) throws Exception {
        byte[] content = contentText.getBytes(StandardCharsets.UTF_8);
        Path path = Files.createTempFile(tempDir, "draft-", ".csv");
        Files.write(path, content);
        return new CsvUploadDraft(
                UUID.randomUUID().toString(),
                datasetKey,
                fileName,
                false,
                path,
                content.length,
                CsvUploadDraft.sha256(content),
                headers,
                1,
                headers.size(),
                Instant.now()
        );
    }

    private Map<String, String> storeMappings() {
        return Map.of(
                "id", "id",
                "name", "name",
                "category", "category",
                "address", "address",
                "phone", "phone",
                "latitude", "latitude",
                "longitude", "longitude",
                "source", "source"
        );
    }

    private Map<String, String> populationMappings() {
        return Map.of(
                "areaName", "areaName",
                "baseDate", "baseDate",
                "populationTotal", "populationTotal",
                "male", "male",
                "female", "female",
                "source", "source"
        );
    }
}
