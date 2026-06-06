package kr.go.geumcheon.dataplatform.admin;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class AdminUploadControllerTest {

    private final AdminUploadStore uploadStore = mock(AdminUploadStore.class);
    private final ExcelUploadParser excelUploadParser = mock(ExcelUploadParser.class);
    private final AdminUploadController controller = new AdminUploadController(uploadStore, excelUploadParser, 15, 5);

    @Test
    void previewUploadRejectsUnknownDatasetKey() {
        var response = controller.previewUpload("unknown-dataset", csvFile());

        assertThat(response.success()).isFalse();
        assertThat(response.message()).contains("Unknown datasetKey");
        verifyNoInteractions(uploadStore, excelUploadParser);
    }

    @Test
    void commitUploadRejectsUnsupportedDatasetKey() {
        var response = controller.commitUpload(new UploadCommitRequest(
                "stores",
                "preview-id",
                "sample.csv",
                1,
                8,
                Map.of("name", "name")
        ));

        assertThat(response.success()).isFalse();
        assertThat(response.message()).contains("not supported");
        verifyNoInteractions(uploadStore, excelUploadParser);
    }

    @Test
    void commitUploadRejectsPreviewCountMismatch() {
        var preview = controller.previewUpload("facilities", csvFile());

        assertThat(preview.success()).isTrue();

        var response = controller.commitUpload(new UploadCommitRequest(
                "facilities",
                preview.data().uploadId(),
                "sample.csv",
                2,
                7,
                Map.of(
                        "id", "id",
                        "category", "category",
                        "name", "name",
                        "address", "address",
                        "phone", "phone",
                        "latitude", "latitude",
                        "longitude", "longitude",
                        "source", "source"
                )
        ));

        assertThat(response.success()).isFalse();
        assertThat(response.message()).contains("rowCount does not match preview data");
        assertThat(response.message()).contains("columnCount does not match preview data");
        verifyNoInteractions(uploadStore, excelUploadParser);
    }

    @Test
    void commitUploadRejectsMissingRequiredMappings() {
        var preview = controller.previewUpload("facilities", csvFile());

        assertThat(preview.success()).isTrue();

        var response = controller.commitUpload(new UploadCommitRequest(
                "facilities",
                preview.data().uploadId(),
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

        assertThat(response.success()).isFalse();
        assertThat(response.message()).contains("missing required mappings");
        assertThat(response.message()).contains("longitude");
        verifyNoInteractions(uploadStore, excelUploadParser);
    }

    private MockMultipartFile csvFile() {
        String csv = """
                id,category,name,address,phone,latitude,longitude,source
                FAC-001,hospital,Geumcheon Health Center,Siheung-daero 73-gil 70,02-2627-2422,37.4568,126.8954,Sample
                """;
        return new MockMultipartFile(
                "file",
                "sample.csv",
                "text/csv",
                csv.getBytes(StandardCharsets.UTF_8)
        );
    }
}
