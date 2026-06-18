package kr.go.geumcheon.dataplatform.admin;

import kr.go.geumcheon.dataplatform.api.ApiResponse;
import kr.go.geumcheon.dataplatform.dataset.DatasetDefinition;
import kr.go.geumcheon.dataplatform.dataset.DatasetRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/admin")
public class AdminUploadController {

    private static final Logger log = LoggerFactory.getLogger(AdminUploadController.class);
    private static final int DEFAULT_LOG_LIMIT = 20;
    private static final int MAX_LOG_LIMIT = 100;
    /** 동시 업로드 처리 수를 제한해 대용량 파일이 메모리를 고갈시키는 것을 방지한다. */
    private static final java.util.concurrent.Semaphore UPLOAD_SEMAPHORE = new java.util.concurrent.Semaphore(3);

    private final AdminUploadStore uploadStore;
    private final ExcelUploadParser excelUploadParser;
    private final CsvParser csvParser;
    private final UploadValidator uploadValidator;
    private final UploadDraftManager uploadDraftManager;
    private final DatasetRegistry datasetRegistry;

    @Autowired
    public AdminUploadController(
            AdminUploadStore uploadStore,
            ExcelUploadParser excelUploadParser,
            DatasetRegistry datasetRegistry,
            @Value("${geumcheon.upload.preview-ttl-minutes:15}") long previewTtlMinutes,
            @Value("${geumcheon.upload.max-preview-drafts:5}") int maxPreviewDrafts
    ) {
        this(
                uploadStore,
                excelUploadParser,
                datasetRegistry,
                new CsvParser(),
                new UploadValidator(),
                new UploadDraftManager(Duration.ofMinutes(Math.max(1L, previewTtlMinutes)), Math.max(1, maxPreviewDrafts))
        );
    }

    AdminUploadController(
            AdminUploadStore uploadStore,
            ExcelUploadParser excelUploadParser,
            DatasetRegistry datasetRegistry,
            CsvParser csvParser,
            UploadValidator uploadValidator,
            UploadDraftManager uploadDraftManager
    ) {
        this.uploadStore = uploadStore;
        this.excelUploadParser = excelUploadParser;
        this.datasetRegistry = datasetRegistry;
        this.csvParser = csvParser;
        this.uploadValidator = uploadValidator;
        this.uploadDraftManager = uploadDraftManager;
    }

    @GetMapping("/datasets")
    public ApiResponse<List<AdminDatasetSummary>> listAdminDatasets() {
        return ApiResponse.ok(datasetRegistry.listAdminDatasetSummaries());
    }

    @PostMapping(value = "/uploads/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<CsvUploadPreview>> previewUpload(
            @RequestParam("datasetKey") String datasetKey,
            @RequestParam("file") MultipartFile file
    ) {
        if (file == null || file.isEmpty()) {
            return fail(HttpStatus.BAD_REQUEST, "Upload file is empty.");
        }
        if (!isCsvFile(file) && !isExcelFile(file)) {
            return fail(HttpStatus.BAD_REQUEST, "Only CSV or Excel files are supported for preview.");
        }
        if (datasetKey == null || datasetKey.isBlank()) {
            return fail(HttpStatus.BAD_REQUEST, "datasetKey is required.");
        }

        DatasetDefinition dataset = findDataset(datasetKey);
        if (dataset == null) {
            return fail(HttpStatus.NOT_FOUND, "Unknown datasetKey: " + datasetKey);
        }
        uploadDraftManager.cleanup();

        if (!UPLOAD_SEMAPHORE.tryAcquire()) {
            return fail(HttpStatus.TOO_MANY_REQUESTS, "Upload server is busy. Please try again in a moment.");
        }
        try {
            byte[] content = file.getInputStream().readAllBytes();
            ParsedUploadContent parsedContent = parseUploadContent(file.getOriginalFilename(), content);
            List<List<String>> sampleRows = parsedContent.dataRows().stream().limit(5).toList();
            List<String> warnings = new ArrayList<>(parsedContent.warnings());
            warnings.addAll(uploadValidator.validatePreview(dataset, parsedContent.headers(), parsedContent.dataRows().size()));
            CsvUploadDraft draft = uploadDraftManager.store(
                    datasetKey,
                    file.getOriginalFilename(),
                    isExcelFile(file),
                    content,
                    parsedContent.headers(),
                    parsedContent.dataRows().size(),
                    parsedContent.headers().size()
            );

            return ResponseEntity.ok(ApiResponse.ok(new CsvUploadPreview(
                    datasetKey,
                    draft.uploadId(),
                    file.getOriginalFilename(),
                    file.getSize(),
                    draft.rowCount(),
                    draft.columnCount(),
                    draft.headers(),
                    sampleRows,
                    warnings
            )));
        } catch (IOException | RuntimeException error) {
            log.warn("Upload preview failed for datasetKey {}", datasetKey, error);
            return fail(HttpStatus.BAD_REQUEST, "Upload preview failed. Please check the file format and try again.");
        } finally {
            UPLOAD_SEMAPHORE.release();
        }
    }

    @PostMapping("/uploads/commit")
    public ResponseEntity<ApiResponse<UploadLogSummary>> commitUpload(@RequestBody UploadCommitRequest request) {
        if (request == null) {
            return fail(HttpStatus.BAD_REQUEST, "Upload commit request is empty.");
        }
        if (request.datasetKey() == null || request.datasetKey().isBlank()) {
            return fail(HttpStatus.BAD_REQUEST, "datasetKey is required.");
        }

        DatasetDefinition dataset = findDataset(request.datasetKey());
        if (dataset == null) {
            return fail(HttpStatus.NOT_FOUND, "Unknown datasetKey: " + request.datasetKey());
        }
        if (!dataset.supportsUploadCommit()) {
            return fail(HttpStatus.BAD_REQUEST, "CSV upload commit is not supported for datasetKey: " + dataset.datasetKey());
        }

        List<String> validationErrors = uploadValidator.validateCommitMapping(dataset, request);
        if (!validationErrors.isEmpty()) {
            return fail(HttpStatus.BAD_REQUEST, "Upload mapping validation failed: " + String.join(" / ", validationErrors));
        }

        CsvUploadDraft draft = request.uploadId() == null ? null : uploadDraftManager.find(request.uploadId());
        if (draft == null) {
            return fail(HttpStatus.NOT_FOUND, "Upload preview data was not found. Please select the file again.");
        }
        if (uploadDraftManager.isExpired(draft)) {
            uploadDraftManager.discard(request.uploadId());
            return fail(HttpStatus.NOT_FOUND, "Upload preview expired. Please preview the file again.");
        }
        if (!request.datasetKey().equals(draft.datasetKey())) {
            return fail(HttpStatus.BAD_REQUEST, "Upload preview dataset does not match the selected dataset.");
        }

        // 매핑 키가 실제 CSV 헤더에 존재하는지 검사한다. 불일치 시 전 행이 누락되어 데이터가 전체 삭제된다.
        List<String> keyErrors = uploadValidator.validateMappingKeys(draft.headers(), request.columnMappings());
        if (!keyErrors.isEmpty()) {
            return fail(HttpStatus.BAD_REQUEST, "Upload mapping keys validation failed: " + String.join(" / ", keyErrors));
        }

        List<String> countErrors = uploadValidator.validateCommitCounts(draft, request);
        if (!countErrors.isEmpty()) {
            return fail(HttpStatus.BAD_REQUEST, "Upload preview validation failed: " + String.join(" / ", countErrors));
        }

        ParsedUploadContent parsedContent;
        try {
            parsedContent = parseDraftContent(draft);
        } catch (RuntimeException error) {
            log.warn("Upload commit draft parse failed for datasetKey {}", request.datasetKey(), error);
            return fail(HttpStatus.BAD_REQUEST, "Upload preview data is invalid. Please preview the file again.");
        }

        UploadLogSummary summary;
        try {
            summary = uploadStore.recordUpload(
                    request,
                    dataset.toAdminDatasetSummary(),
                    mappingCount(request),
                    draft,
                    parsedContent.dataRows()
            );
        } catch (IllegalStateException error) {
            log.warn("Upload commit aborted for datasetKey {}: {}", request.datasetKey(), error.getMessage());
            return fail(HttpStatus.BAD_REQUEST, error.getMessage());
        }
        uploadDraftManager.discard(request.uploadId());
        return ResponseEntity.ok(ApiResponse.ok(summary));
    }

    @GetMapping("/collection-logs")
    public ApiResponse<List<UploadLogSummary>> collectionLogs(@RequestParam(value = "limit", required = false) Integer limit) {
        return ApiResponse.ok(uploadStore.recentLogs(normalizeLogLimit(limit)));
    }

    private DatasetDefinition findDataset(String datasetKey) {
        return datasetRegistry.find(datasetKey);
    }

    private int mappingCount(UploadCommitRequest request) {
        if (request.columnMappings() == null) {
            return 0;
        }
        return (int) request.columnMappings().values().stream()
                .filter(value -> value != null && !value.isBlank())
                .count();
    }

    private ParsedUploadContent parseDraftContent(CsvUploadDraft draft) {
        ParsedUploadContent parsed = parseUploadContent(draft.fileName(), draft.excelFile(), draft.readContent());
        if (!draft.headers().equals(parsed.headers())
                || draft.rowCount() != parsed.dataRows().size()
                || draft.columnCount() != parsed.headers().size()) {
            throw new IllegalStateException("Upload preview metadata does not match stored file content.");
        }
        return parsed;
    }

    private ParsedUploadContent parseUploadContent(String fileName, byte[] content) {
        return parseUploadContent(fileName, isExcelFile(fileName), content);
    }

    private ParsedUploadContent parseUploadContent(String fileName, boolean excelFile, byte[] content) {
        List<String> warnings = new ArrayList<>();
        List<List<String>> rows = excelFile
                ? collectExcelRows(content, warnings)
                : csvParser.parse(csvParser.decode(content));
        List<String> headers = rows.isEmpty() ? List.of() : List.copyOf(rows.get(0));
        List<List<String>> dataRows = rows.size() <= 1
                ? List.of()
                : rows.subList(1, rows.size()).stream().map(List::copyOf).toList();
        return new ParsedUploadContent(headers, dataRows, warnings);
    }

    private List<List<String>> collectExcelRows(byte[] content, List<String> warnings) {
        ExcelUploadParser.ParsedExcel parsedExcel = excelUploadParser.parse(content);
        warnings.addAll(parsedExcel.warnings());
        return parsedExcel.rows();
    }

    private int normalizeLogLimit(Integer requestedLimit) {
        if (requestedLimit == null) {
            return DEFAULT_LOG_LIMIT;
        }
        return Math.max(1, Math.min(MAX_LOG_LIMIT, requestedLimit));
    }

    private boolean isCsvFile(MultipartFile file) {
        String extension = fileExtension(file.getOriginalFilename());
        String contentType = normalizeContentType(file.getContentType());
        return "csv".equals(extension) || "text/csv".equals(contentType) || "application/csv".equals(contentType);
    }

    private boolean isExcelFile(MultipartFile file) {
        return isExcelFile(file.getOriginalFilename(), file.getContentType());
    }

    private boolean isExcelFile(String fileName) {
        return isExcelFile(fileName, null);
    }

    private boolean isExcelFile(String fileName, String contentType) {
        String extension = fileExtension(fileName);
        String normalizedContentType = normalizeContentType(contentType);
        return "xlsx".equals(extension)
                || "xls".equals(extension)
                || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".equals(normalizedContentType)
                || "application/vnd.ms-excel".equals(normalizedContentType);
    }

    private String fileExtension(String fileName) {
        if (fileName == null) {
            return "";
        }
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == fileName.length() - 1) {
            return "";
        }
        return fileName.substring(dotIndex + 1).toLowerCase(Locale.ROOT);
    }

    private String normalizeContentType(String contentType) {
        return contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
    }

    private <T> ResponseEntity<ApiResponse<T>> fail(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(ApiResponse.fail(message));
    }

    private record ParsedUploadContent(
            List<String> headers,
            List<List<String>> dataRows,
            List<String> warnings
    ) {
    }
}
