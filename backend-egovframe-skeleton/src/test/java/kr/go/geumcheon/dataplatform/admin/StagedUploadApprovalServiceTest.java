package kr.go.geumcheon.dataplatform.admin;

import kr.go.geumcheon.dataplatform.dataset.DatasetRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StagedUploadApprovalServiceTest {

    @TempDir
    Path tempDir;

    @Test
    void approveAppliesStoredOriginalAfterRevalidation() throws Exception {
        StagedUploadStore stagedUploadStore = mock(StagedUploadStore.class);
        AdminUploadStore uploadStore = mock(AdminUploadStore.class);
        DatasetRegistry datasetRegistry = new DatasetRegistry();
        StagedUploadApprovalService service = new StagedUploadApprovalService(
                stagedUploadStore, uploadStore, datasetRegistry, mock(ExcelUploadParser.class));

        StagedUploadMaterial material = material("""
                id,category,name,address,phone,latitude,longitude,source
                FAC-001,hospital,Geumcheon Health Center,Siheung-daero 73-gil 70,02-2627-2422,37.4568,126.8954,Sample
                """, facilityMappings());
        ChangeRequestSummary request = changeRequest(material);
        UploadLogSummary expected = successLog("facilities");

        when(stagedUploadStore.requirePendingForRequest("change-1")).thenReturn(material);
        when(stagedUploadStore.markApplying("stage-1")).thenReturn(summary(material, "APPLYING"));
        when(stagedUploadStore.markApplied("stage-1")).thenReturn(summary(material, "APPLIED"));
        when(uploadStore.recordUpload(any(), eq(datasetRegistry.find("facilities").toAdminDatasetSummary()), eq(8), any(), any()))
                .thenReturn(expected);

        UploadLogSummary actual = service.apply(request);

        assertThat(actual).isEqualTo(expected);
        verify(stagedUploadStore).markApplying("stage-1");
        verify(stagedUploadStore).markApplied("stage-1");
        verify(uploadStore).recordUpload(any(), eq(datasetRegistry.find("facilities").toAdminDatasetSummary()), eq(8), any(), any());
    }

    @Test
    void approveFailureMarksStageFailedAndDoesNotApplyRows() throws Exception {
        StagedUploadStore stagedUploadStore = mock(StagedUploadStore.class);
        AdminUploadStore uploadStore = mock(AdminUploadStore.class);
        DatasetRegistry datasetRegistry = new DatasetRegistry();
        StagedUploadApprovalService service = new StagedUploadApprovalService(
                stagedUploadStore, uploadStore, datasetRegistry, mock(ExcelUploadParser.class));

        StagedUploadMaterial material = material("""
                id,category,name,address,phone,latitude,longitude,source
                FAC-001,hospital,Geumcheon Health Center,Siheung-daero 73-gil 70,02-2627-2422,37.4568,126.8954,Sample
                """, Map.of("id", "id"));
        when(stagedUploadStore.requirePendingForRequest("change-1")).thenReturn(material);
        when(stagedUploadStore.markApplying("stage-1")).thenReturn(summary(material, "APPLYING"));

        assertThatThrownBy(() -> service.apply(changeRequest(material)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("검증 실패");

        verify(stagedUploadStore).markFailed(eq("stage-1"), any());
        verify(stagedUploadStore, never()).markApplied("stage-1");
        verify(uploadStore, never()).recordUpload(any(), any(), anyInt(), any(), any());
    }

    private StagedUploadMaterial material(String csv, Map<String, String> mappings) throws Exception {
        byte[] content = csv.getBytes(StandardCharsets.UTF_8);
        Path file = tempDir.resolve(UUID.randomUUID() + ".csv");
        Files.write(file, content);
        return new StagedUploadMaterial(
                "stage-1", "change-1", "facilities", "facilities.csv", false,
                file, content.length, CsvUploadDraft.sha256(content), 1, 8,
                List.of("id", "category", "name", "address", "phone", "latitude", "longitude", "source"),
                mappings, "PENDING_REVIEW", "operator", Instant.now(), Instant.now().plusSeconds(3600));
    }

    private Map<String, String> facilityMappings() {
        return Map.of(
                "id", "id",
                "category", "category",
                "name", "name",
                "address", "address",
                "phone", "phone",
                "latitude", "latitude",
                "longitude", "longitude",
                "source", "source"
        );
    }

    private ChangeRequestSummary changeRequest(StagedUploadMaterial material) {
        return new ChangeRequestSummary(
                material.changeRequestId(), "DATA_UPLOAD", "STAGED_UPLOAD", material.stagedUploadId(),
                "시설 데이터 공개 반영", "description", Map.of(), "PENDING_REVIEW",
                "operator", Instant.now(), null, null, null, Instant.now());
    }

    private StagedUploadSummary summary(StagedUploadMaterial material, String status) {
        return new StagedUploadSummary(
                material.stagedUploadId(), material.datasetKey(), material.fileName(), material.fileSize(),
                material.rowCount(), material.columnCount(), status, material.changeRequestId(),
                material.stagedBy(), material.stagedAt(), material.expiresAt());
    }

    private UploadLogSummary successLog(String datasetKey) {
        return new UploadLogSummary(
                UUID.randomUUID().toString(), datasetKey, datasetKey, datasetKey + ".csv",
                "SUCCESS", 1, 8, 1, 0, Instant.now(), "ok");
    }
}
