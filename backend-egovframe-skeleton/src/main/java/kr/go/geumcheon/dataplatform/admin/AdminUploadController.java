package kr.go.geumcheon.dataplatform.admin;

import kr.go.geumcheon.dataplatform.api.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@RestController
@RequestMapping("/api/admin")
public class AdminUploadController {

    private static final Logger log = LoggerFactory.getLogger(AdminUploadController.class);

    private final AdminUploadStore uploadStore;
    private final ExcelUploadParser excelUploadParser;
    private final Duration previewDraftTtl;
    private final int maxPreviewDrafts;
    private final ConcurrentMap<String, CsvUploadDraft> uploadDrafts = new ConcurrentHashMap<>();

    public AdminUploadController(
            AdminUploadStore uploadStore,
            ExcelUploadParser excelUploadParser,
            @Value("${geumcheon.upload.preview-ttl-minutes:15}") long previewTtlMinutes,
            @Value("${geumcheon.upload.max-preview-drafts:5}") int maxPreviewDrafts
    ) {
        this.uploadStore = uploadStore;
        this.excelUploadParser = excelUploadParser;
        this.previewDraftTtl = Duration.ofMinutes(Math.max(1L, previewTtlMinutes));
        this.maxPreviewDrafts = Math.max(1, maxPreviewDrafts);
    }

    @GetMapping("/datasets")
    public ApiResponse<List<AdminDatasetSummary>> listAdminDatasets() {
        return ApiResponse.ok(datasetSummaries());
    }

    @PostMapping(value = "/uploads/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<CsvUploadPreview> previewUpload(
            @RequestParam("datasetKey") String datasetKey,
            @RequestParam("file") MultipartFile file
    ) {
        if (file == null || file.isEmpty()) {
            return ApiResponse.fail("Upload file is empty.");
        }
        if (!isCsvFile(file) && !isExcelFile(file)) {
            return ApiResponse.fail("Only CSV or Excel files are supported for preview.");
        }
        if (datasetKey == null || datasetKey.isBlank()) {
            return ApiResponse.fail("datasetKey is required.");
        }

        AdminDatasetSummary dataset = findDataset(datasetKey);
        if (dataset == null) {
            return ApiResponse.fail("Unknown datasetKey: " + datasetKey);
        }
        cleanupUploadDrafts();

        try {
            byte[] content = file.getInputStream().readAllBytes();
            List<String> parserWarnings = new ArrayList<>();
            List<List<String>> rows = isExcelFile(file)
                    ? collectExcelRows(content, parserWarnings)
                    : parseCsv(decodeCsv(content));
            List<String> headers = rows.isEmpty() ? List.of() : rows.get(0);
            List<List<String>> dataRows = rows.size() <= 1 ? List.of() : rows.subList(1, rows.size());
            List<List<String>> sampleRows = dataRows.stream().limit(5).toList();
            List<String> warnings = new ArrayList<>(parserWarnings);
            warnings.addAll(validatePreview(dataset, headers, dataRows.size()));
            String uploadId = UUID.randomUUID().toString();
            storeUploadDraft(new CsvUploadDraft(
                    uploadId,
                    datasetKey,
                    file.getOriginalFilename(),
                    content,
                    List.copyOf(headers),
                    List.copyOf(dataRows),
                    Instant.now()
            ));

            return ApiResponse.ok(new CsvUploadPreview(
                    datasetKey,
                    uploadId,
                    file.getOriginalFilename(),
                    file.getSize(),
                    dataRows.size(),
                    headers.size(),
                    headers,
                    sampleRows,
                    warnings
            ));
        } catch (IOException | RuntimeException error) {
            log.warn("Upload preview failed for datasetKey {}", datasetKey, error);
            return ApiResponse.fail("Upload preview failed. Please check the file format and try again.");
        }
    }

    private List<List<String>> collectExcelRows(byte[] content, List<String> warnings) {
        ExcelUploadParser.ParsedExcel parsedExcel = excelUploadParser.parse(content);
        warnings.addAll(parsedExcel.warnings());
        return parsedExcel.rows();
    }

    @PostMapping("/uploads/commit")
    public ApiResponse<UploadLogSummary> commitUpload(@RequestBody UploadCommitRequest request) {
        if (request == null) {
            return ApiResponse.fail("Upload commit request is empty.");
        }
        if (request.datasetKey() == null || request.datasetKey().isBlank()) {
            return ApiResponse.fail("datasetKey is required.");
        }

        AdminDatasetSummary dataset = findDataset(request.datasetKey());
        if (dataset == null) {
            return ApiResponse.fail("Unknown datasetKey: " + request.datasetKey());
        }
        if (!dataset.supportsUploadCommit()) {
            return ApiResponse.fail("CSV upload commit is not supported for datasetKey: " + dataset.datasetKey());
        }

        List<String> validationErrors = validateCommitMapping(dataset, request);
        if (!validationErrors.isEmpty()) {
            return ApiResponse.fail("Upload mapping validation failed: " + String.join(" / ", validationErrors));
        }

        CsvUploadDraft draft = request.uploadId() == null ? null : uploadDrafts.get(request.uploadId());
        if (draft == null) {
            return ApiResponse.fail("Upload preview data was not found. Please select the file again.");
        }
        if (draft.isExpired(previewDraftTtl, Instant.now())) {
            uploadDrafts.remove(request.uploadId());
            return ApiResponse.fail("Upload preview expired. Please preview the file again.");
        }
        if (!request.datasetKey().equals(draft.datasetKey())) {
            return ApiResponse.fail("Upload preview dataset does not match the selected dataset.");
        }

        List<String> countErrors = validateCommitCounts(draft, request);
        if (!countErrors.isEmpty()) {
            return ApiResponse.fail("Upload preview validation failed: " + String.join(" / ", countErrors));
        }

        UploadLogSummary summary = uploadStore.recordUpload(request, dataset, mappingCount(request), draft);
        if (request.uploadId() != null) {
            uploadDrafts.remove(request.uploadId());
        }
        return ApiResponse.ok(summary);
    }

    @GetMapping("/collection-logs")
    public ApiResponse<List<UploadLogSummary>> collectionLogs() {
        return ApiResponse.ok(uploadStore.recentLogs());
    }

    private void storeUploadDraft(CsvUploadDraft draft) {
        synchronized (uploadDrafts) {
            cleanupExpiredUploadDraftsLocked();
            uploadDrafts.put(draft.uploadId(), draft);
            trimUploadDraftsLocked();
        }
    }

    private void cleanupUploadDrafts() {
        synchronized (uploadDrafts) {
            cleanupExpiredUploadDraftsLocked();
            trimUploadDraftsLocked();
        }
    }

    private void cleanupExpiredUploadDraftsLocked() {
        Instant now = Instant.now();
        uploadDrafts.entrySet().removeIf(entry -> entry.getValue().isExpired(previewDraftTtl, now));
    }

    private void trimUploadDraftsLocked() {
        int overflow = uploadDrafts.size() - maxPreviewDrafts;
        if (overflow <= 0) {
            return;
        }

        List<CsvUploadDraft> oldestDrafts = uploadDrafts.values().stream()
                .sorted(Comparator.comparing(CsvUploadDraft::createdAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .limit(overflow)
                .toList();
        for (CsvUploadDraft draft : oldestDrafts) {
            uploadDrafts.remove(draft.uploadId());
        }
    }

    private List<AdminDatasetSummary> datasetSummaries() {
        return List.of(
                new AdminDatasetSummary("facilities", "생활시설 통합", "생활", "금천구 열린데이터광장", "수시", "CSV", true, true),
                new AdminDatasetSummary("stores", "상가업소 정보", "상권", "소상공인시장진흥공단", "수시", "API/CSV", true, false),
                new AdminDatasetSummary("air-quality", "대기 현황", "실시간", "서울 열린데이터광장", "시간", "API", false, false),
                new AdminDatasetSummary("population", "인구 통계", "인구", "서울 열린데이터광장", "월", "CSV", true, false)
        );
    }

    private AdminDatasetSummary findDataset(String datasetKey) {
        return datasetSummaries().stream()
                .filter(dataset -> dataset.datasetKey().equals(datasetKey))
                .findFirst()
                .orElse(null);
    }

    private int mappingCount(UploadCommitRequest request) {
        if (request.columnMappings() == null) {
            return 0;
        }
        return (int) request.columnMappings().values().stream()
                .filter(value -> value != null && !value.isBlank())
                .count();
    }

    private List<String> validatePreview(AdminDatasetSummary dataset, List<String> headers, int rowCount) {
        List<String> warnings = new ArrayList<>();
        if (headers.isEmpty()) {
            warnings.add("헤더 행이 비어 있습니다.");
        }
        if (rowCount == 0) {
            warnings.add("데이터 행이 비어 있습니다.");
        }
        List<String> missing = requiredFields(dataset.datasetKey()).stream().filter(column -> !headers.contains(column)).toList();
        if (!missing.isEmpty()) {
            warnings.add("권장 컬럼 누락: " + String.join(", ", missing));
        }
        return warnings;
    }

    private List<String> validateCommitMapping(AdminDatasetSummary dataset, UploadCommitRequest request) {
        List<String> errors = new ArrayList<>();
        Map<String, String> mappings = request.columnMappings();
        if (request.datasetKey() == null || request.datasetKey().isBlank()) {
            errors.add("datasetKey is required");
        }
        if (dataset == null) {
            errors.add("Unknown datasetKey: " + request.datasetKey());
            return errors;
        }
        if (!dataset.supportsUploadCommit()) {
            errors.add("CSV upload commit is not supported for datasetKey: " + dataset.datasetKey());
            return errors;
        }
        if (mappings == null || mappings.isEmpty()) {
            errors.add("columnMappings is required");
            return errors;
        }

        Set<String> allowed = new LinkedHashSet<>(allowedFields(dataset.datasetKey()));
        Set<String> mapped = new LinkedHashSet<>();
        Set<String> duplicated = new LinkedHashSet<>();
        Set<String> unknown = new LinkedHashSet<>();

        mappings.values().stream()
                .filter(value -> value != null && !value.isBlank())
                .forEach(value -> {
                    if (!allowed.contains(value)) {
                        unknown.add(value);
                    } else if (!mapped.add(value)) {
                        duplicated.add(value);
                    }
                });

        List<String> missing = requiredFields(dataset.datasetKey()).stream()
                .filter(field -> !mapped.contains(field))
                .toList();

        if (!missing.isEmpty()) {
            errors.add("missing required mappings: " + String.join(", ", missing));
        }
        if (!duplicated.isEmpty()) {
            errors.add("duplicated mappings: " + String.join(", ", duplicated));
        }
        if (!unknown.isEmpty()) {
            errors.add("unknown mappings: " + String.join(", ", unknown));
        }

        return errors;
    }

    private List<String> validateCommitCounts(CsvUploadDraft draft, UploadCommitRequest request) {
        List<String> errors = new ArrayList<>();
        int previewRowCount = draft == null || draft.rows() == null ? 0 : draft.rows().size();
        int previewColumnCount = draft == null || draft.headers() == null ? 0 : draft.headers().size();

        if (request.rowCount() != previewRowCount) {
            errors.add("rowCount does not match preview data (expected " + previewRowCount + ", got " + request.rowCount() + ")");
        }
        if (request.columnCount() != previewColumnCount) {
            errors.add("columnCount does not match preview data (expected " + previewColumnCount + ", got " + request.columnCount() + ")");
        }
        return errors;
    }

    private List<String> requiredFields(String datasetKey) {
        return switch (datasetKey) {
            case "stores" -> List.of("name", "address");
            case "air-quality" -> List.of("stationName", "measuredAt");
            case "population" -> List.of("areaName", "baseDate", "populationTotal");
            default -> List.of("id", "category", "name", "address", "latitude", "longitude");
        };
    }

    private List<String> allowedFields(String datasetKey) {
        return switch (datasetKey) {
            case "air-quality" -> List.of("stationName", "measuredAt", "pm10", "pm25", "status", "source");
            case "population" -> List.of("areaName", "baseDate", "populationTotal", "male", "female", "source");
            default -> List.of("id", "category", "name", "address", "phone", "latitude", "longitude", "source");
        };
    }

    private boolean isCsvFile(MultipartFile file) {
        String extension = fileExtension(file);
        String contentType = normalizeContentType(file.getContentType());
        return "csv".equals(extension) || "text/csv".equals(contentType) || "application/csv".equals(contentType);
    }

    private boolean isExcelFile(MultipartFile file) {
        String extension = fileExtension(file);
        String contentType = normalizeContentType(file.getContentType());
        return "xlsx".equals(extension)
                || "xls".equals(extension)
                || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".equals(contentType)
                || "application/vnd.ms-excel".equals(contentType);
    }

    private String fileExtension(MultipartFile file) {
        String fileName = file.getOriginalFilename();
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

    private String decodeCsv(byte[] bytes) {
        String utf8Text = decodeText(bytes, StandardCharsets.UTF_8);
        if (!looksMisdecoded(utf8Text)) {
            return stripBom(utf8Text);
        }

        String koreanText = decodeText(bytes, Charset.forName("MS949"));
        return stripBom(looksMisdecoded(koreanText) ? utf8Text : koreanText);
    }

    private String decodeText(byte[] bytes, Charset charset) {
        try {
            return charset.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes))
                    .toString();
        } catch (CharacterCodingException error) {
            return new String(bytes, charset);
        }
    }

    private boolean looksMisdecoded(String text) {
        return text.indexOf('\uFFFD') >= 0;
    }

    private String stripBom(String text) {
        return text.startsWith("\uFEFF") ? text.substring(1) : text;
    }

    private List<List<String>> parseCsv(String text) {
        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false;

        for (int index = 0; index < text.length(); index += 1) {
            char current = text.charAt(index);
            char next = index + 1 < text.length() ? text.charAt(index + 1) : '\0';

            if (current == '"' && quoted && next == '"') {
                cell.append('"');
                index += 1;
            } else if (current == '"') {
                quoted = !quoted;
            } else if (current == ',' && !quoted) {
                row.add(cell.toString().trim());
                cell.setLength(0);
            } else if ((current == '\n' || current == '\r') && !quoted) {
                if (current == '\r' && next == '\n') {
                    index += 1;
                }
                row.add(cell.toString().trim());
                addRowIfNotEmpty(rows, row);
                row = new ArrayList<>();
                cell.setLength(0);
            } else {
                cell.append(current);
            }
        }

        if (!row.isEmpty() || cell.length() > 0) {
            row.add(cell.toString().trim());
            addRowIfNotEmpty(rows, row);
        }

        return rows;
    }

    private void addRowIfNotEmpty(List<List<String>> rows, List<String> row) {
        boolean hasValue = row.stream().anyMatch(value -> !value.isBlank());
        if (hasValue) {
            rows.add(row);
        }
    }
}
