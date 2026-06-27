package kr.go.geumcheon.dataplatform.admin;

import kr.go.geumcheon.dataplatform.dataset.DatasetRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AdminUploadControllerTest {

    private final AdminUploadStore uploadStore = mock(AdminUploadStore.class);
    private final ExcelUploadParser excelUploadParser = mock(ExcelUploadParser.class);
    private final DatasetRegistry datasetRegistry = new DatasetRegistry();

    @TempDir
    Path tempDir;

    @Test
    void previewUploadRejectsUnknownDatasetKey() {
        var response = controller().previewUpload("unknown-dataset", facilitiesCsvFile());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().success()).isFalse();
        assertThat(response.getBody().message()).contains("Unknown datasetKey");
        verifyNoInteractions(uploadStore, excelUploadParser);
    }

    @Test
    void previewDraftStoresOnlyMetadata() {
        AdminUploadController controller = controller();

        var preview = controller.previewUpload("facilities", facilitiesCsvFile());

        assertThat(preview.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(preview.getBody().data().sampleRows()).hasSize(1);
        assertThat(preview.getBody().data().rowCount()).isEqualTo(1);
        assertThat(preview.getBody().data().columnCount()).isEqualTo(8);
    }

    @Test
    void commitUploadAllowsStoresDataset() {
        AdminUploadController controller = controller();
        var preview = controller.previewUpload("stores", storesCsvFile());
        when(uploadStore.recordUpload(any(), eq(datasetRegistry.find("stores").toAdminDatasetSummary()), eq(8), any(), any()))
                .thenReturn(successLog("stores"));

        var response = controller.commitUpload(new UploadCommitRequest(
                "stores",
                preview.getBody().data().uploadId(),
                "stores.csv",
                1,
                8,
                Map.of(
                        "id", "id",
                        "name", "name",
                        "category", "category",
                        "address", "address",
                        "phone", "phone",
                        "latitude", "latitude",
                        "longitude", "longitude",
                        "source", "source"
                )
        ));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().success()).isTrue();
        verify(uploadStore).recordUpload(any(), eq(datasetRegistry.find("stores").toAdminDatasetSummary()), eq(8), any(), any());
    }

    @Test
    void commitUploadAllowsPopulationDataset() {
        AdminUploadController controller = controller();
        var preview = controller.previewUpload("population", populationCsvFile());
        when(uploadStore.recordUpload(any(), eq(datasetRegistry.find("population").toAdminDatasetSummary()), eq(6), any(), any()))
                .thenReturn(successLog("population"));

        var response = controller.commitUpload(new UploadCommitRequest(
                "population",
                preview.getBody().data().uploadId(),
                "population.csv",
                1,
                6,
                Map.of(
                        "areaName", "areaName",
                        "baseDate", "baseDate",
                        "populationTotal", "populationTotal",
                        "male", "male",
                        "female", "female",
                        "source", "source"
                )
        ));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().success()).isTrue();
        verify(uploadStore).recordUpload(any(), eq(datasetRegistry.find("population").toAdminDatasetSummary()), eq(6), any(), any());
    }

    @Test
    void commitUploadRejectsPreviewCountMismatch() {
        AdminUploadController controller = controller();
        var preview = controller.previewUpload("facilities", facilitiesCsvFile());

        var response = controller.commitUpload(new UploadCommitRequest(
                "facilities",
                preview.getBody().data().uploadId(),
                "sample.csv",
                2,
                7,
                facilityMappings()
        ));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().message()).contains("rowCount does not match preview data");
        assertThat(response.getBody().message()).contains("columnCount does not match preview data");
        verifyNoInteractions(uploadStore, excelUploadParser);
    }

    @Test
    void commitUploadRejectsMissingRequiredMappings() {
        AdminUploadController controller = controller();
        var preview = controller.previewUpload("facilities", facilitiesCsvFile());

        var response = controller.commitUpload(new UploadCommitRequest(
                "facilities",
                preview.getBody().data().uploadId(),
                "sample.csv",
                1,
                8,
                Map.of(
                        "id", "id",
                        "category", "category",
                        "name", "name",
                        "address", "address",
                        "phone", "phone",
                        "latitude", "latitude",
                        "source", "source"
                )
        ));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().message()).contains("missing required mappings");
        assertThat(response.getBody().message()).contains("longitude");
        verifyNoInteractions(uploadStore, excelUploadParser);
    }

    @Test
    void commitUploadRejectsMissingPreviewAsNotFound() {
        var response = controller().commitUpload(new UploadCommitRequest(
                "facilities",
                UUID.randomUUID().toString(),
                "sample.csv",
                1,
                8,
                facilityMappings()
        ));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().message()).contains("Upload preview data was not found");
        verifyNoInteractions(uploadStore, excelUploadParser);
    }

    @Test
    void collectionLogsClampsLimitToConfiguredMaximum() {
        AdminUploadController controller = controller();
        when(uploadStore.recentLogs(100)).thenReturn(List.of());

        var response = controller.collectionLogs(999);

        assertThat(response.success()).isTrue();
        verify(uploadStore).recentLogs(100);
    }

    @Test
    void operatorStagesUploadAndSubmitsChangeRequestWithoutPublishingRows() {
        StagedUploadStore stagedStore = mock(StagedUploadStore.class);
        GovernanceStore governanceStore = mock(GovernanceStore.class);
        UploadDraftManager drafts = new UploadDraftManager(Duration.ofMinutes(15), 5, tempDir);
        AdminUploadController controller = new AdminUploadController(
                uploadStore, excelUploadParser, datasetRegistry, new CsvParser(), new UploadValidator(), drafts,
                stagedStore, governanceStore);
        var preview = controller.previewUpload("facilities", facilitiesCsvFile()).getBody().data();
        UploadCommitRequest request = new UploadCommitRequest(
                "facilities", preview.uploadId(), preview.fileName(), preview.rowCount(), preview.columnCount(),
                facilityMappings());
        StagedUploadSummary staged = new StagedUploadSummary(
                "stage-1", "facilities", preview.fileName(), preview.fileSize(), preview.rowCount(),
                preview.columnCount(), "DRAFT", null, "operator", Instant.now(), Instant.now().plusSeconds(3600));
        ChangeRequestSummary change = new ChangeRequestSummary(
                "change-1", "DATA_UPLOAD", "STAGED_UPLOAD", "stage-1", "title", "description", Map.of(),
                "DRAFT", "operator", null, null, null, null, Instant.now());
        when(stagedStore.stage(eq("operator"), eq(request), any())).thenReturn(staged);
        when(governanceStore.create(eq("operator"), any())).thenReturn(change);
        when(governanceStore.submit("change-1", "operator")).thenReturn(change);
        when(stagedStore.linkChangeRequest("stage-1", "change-1")).thenReturn(new StagedUploadSummary(
                "stage-1", "facilities", preview.fileName(), preview.fileSize(), preview.rowCount(),
                preview.columnCount(), "PENDING_REVIEW", "change-1", "operator", staged.stagedAt(), staged.expiresAt()));

        var response = controller.stageUpload(request,
                new UsernamePasswordAuthenticationToken("operator", "n/a",
                        List.of(new SimpleGrantedAuthority("ROLE_OPERATOR"))));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().data().status()).isEqualTo("PENDING_REVIEW");
        verifyNoInteractions(uploadStore);
    }

    private AdminUploadController controller() {
        return new AdminUploadController(
                uploadStore,
                excelUploadParser,
                datasetRegistry,
                new CsvParser(),
                new UploadValidator(),
                new UploadDraftManager(Duration.ofMinutes(15), 5, tempDir)
        );
    }

    private UploadLogSummary successLog(String datasetKey) {
        return new UploadLogSummary(
                UUID.randomUUID().toString(),
                datasetKey,
                datasetKey,
                datasetKey + ".csv",
                "SUCCESS",
                1,
                1,
                1,
                0,
                Instant.now(),
                "ok"
        );
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

    private MockMultipartFile facilitiesCsvFile() {
        String csv = """
                id,category,name,address,phone,latitude,longitude,source
                FAC-001,hospital,Geumcheon Health Center,Siheung-daero 73-gil 70,02-2627-2422,37.4568,126.8954,Sample
                """;
        return csvFile("sample.csv", csv);
    }

    private MockMultipartFile storesCsvFile() {
        String csv = """
                id,name,category,address,phone,latitude,longitude,source
                STORE-001,Geumcheon Cafe,Cafe,Siheung-daero 20,02-0000-0000,37.4550,126.9000,Sample
                """;
        return csvFile("stores.csv", csv);
    }

    private MockMultipartFile populationCsvFile() {
        String csv = """
                areaName,baseDate,populationTotal,male,female,source
                가산동,2026-05-01,24000,12100,11900,Sample
                """;
        return csvFile("population.csv", csv);
    }

    private MockMultipartFile csvFile(String fileName, String csv) {
        return new MockMultipartFile(
                "file",
                fileName,
                "text/csv",
                csv.getBytes(StandardCharsets.UTF_8)
        );
    }
}
