package kr.go.geumcheon.dataplatform.admin;

import kr.go.geumcheon.dataplatform.api.ApiResponse;
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

    private final AdminUploadStore uploadStore;
    private final ConcurrentMap<String, CsvUploadDraft> uploadDrafts = new ConcurrentHashMap<>();

    public AdminUploadController(AdminUploadStore uploadStore) {
        this.uploadStore = uploadStore;
    }

    @GetMapping("/datasets")
    public ApiResponse<List<AdminDatasetSummary>> listAdminDatasets() {
        return ApiResponse.ok(datasetSummaries());
    }

    @PostMapping(value = "/uploads/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<CsvUploadPreview> previewUpload(
            @RequestParam String datasetKey,
            @RequestParam("file") MultipartFile file
    ) {
        if (file == null || file.isEmpty()) {
            return ApiResponse.fail("Upload file is empty.");
        }
        if (isExcelFile(file)) {
            return ApiResponse.fail("Excel upload is detected, but Excel parsing is not enabled yet. Please save it as CSV and upload again.");
        }
        if (!isCsvFile(file)) {
            return ApiResponse.fail("Only CSV files are supported for preview.");
        }

        try {
            byte[] content = file.getInputStream().readAllBytes();
            List<List<String>> rows = parseCsv(decodeCsv(content));
            List<String> headers = rows.isEmpty() ? List.of() : rows.get(0);
            List<List<String>> dataRows = rows.size() <= 1 ? List.of() : rows.subList(1, rows.size());
            List<List<String>> sampleRows = dataRows.stream().limit(5).toList();
            List<String> warnings = validatePreview(datasetKey, headers, dataRows.size());
            String uploadId = UUID.randomUUID().toString();
            uploadDrafts.put(uploadId, new CsvUploadDraft(
                    uploadId,
                    datasetKey,
                    file.getOriginalFilename(),
                    content,
                    List.copyOf(headers),
                    List.copyOf(dataRows)
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
            return ApiResponse.fail("CSV preview failed: " + error.getMessage());
        }
    }

    @PostMapping("/uploads/commit")
    public ApiResponse<UploadLogSummary> commitUpload(@RequestBody UploadCommitRequest request) {
        if (request == null) {
            return ApiResponse.fail("Upload commit request is empty.");
        }

        List<String> validationErrors = validateCommitMapping(request);
        if (!validationErrors.isEmpty()) {
            return ApiResponse.fail("Upload mapping validation failed: " + String.join(" / ", validationErrors));
        }

        AdminDatasetSummary dataset = findDataset(request.datasetKey());
        CsvUploadDraft draft = request.uploadId() == null ? null : uploadDrafts.get(request.uploadId());
        if ("facilities".equals(request.datasetKey()) && draft == null) {
            return ApiResponse.fail("CSV preview data was not found. Please select the CSV file again.");
        }
        if (draft != null && !request.datasetKey().equals(draft.datasetKey())) {
            return ApiResponse.fail("CSV preview dataset does not match the selected dataset.");
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

    private List<AdminDatasetSummary> datasetSummaries() {
        return List.of(
                new AdminDatasetSummary("facilities", "생활시설 통합", "생활", "금천구 열린데이터광장", "수시", "CSV", true),
                new AdminDatasetSummary("stores", "상가업소 정보", "상권", "소상공인시장진흥공단", "수시", "API/CSV", true),
                new AdminDatasetSummary("air-quality", "대기 현황", "실시간", "서울 열린데이터광장", "시간", "API", false),
                new AdminDatasetSummary("population", "인구 통계", "인구", "서울 열린데이터광장", "월", "CSV", true)
        );
    }

    private AdminDatasetSummary findDataset(String datasetKey) {
        return datasetSummaries().stream()
                .filter(dataset -> dataset.datasetKey().equals(datasetKey))
                .findFirst()
                .orElse(new AdminDatasetSummary(datasetKey, datasetKey, "기타", "Mock", "수시", "CSV", true));
    }

    private int mappingCount(UploadCommitRequest request) {
        if (request.columnMappings() == null) {
            return 0;
        }
        return (int) request.columnMappings().values().stream()
                .filter(value -> value != null && !value.isBlank())
                .count();
    }

    private List<String> validatePreview(String datasetKey, List<String> headers, int rowCount) {
        List<String> warnings = new ArrayList<>();
        if (headers.isEmpty()) {
            warnings.add("CSV header row is empty.");
        }
        if (rowCount == 0) {
            warnings.add("CSV data row is empty.");
        }
        List<String> missing = requiredFields(datasetKey).stream().filter(column -> !headers.contains(column)).toList();
        if (!missing.isEmpty()) {
            warnings.add("Missing recommended columns: " + String.join(", ", missing));
        }
        return warnings;
    }

    private List<String> validateCommitMapping(UploadCommitRequest request) {
        List<String> errors = new ArrayList<>();
        Map<String, String> mappings = request.columnMappings();
        if (request.datasetKey() == null || request.datasetKey().isBlank()) {
            errors.add("datasetKey is required");
        }
        if (mappings == null || mappings.isEmpty()) {
            errors.add("columnMappings is required");
            return errors;
        }

        Set<String> allowed = new LinkedHashSet<>(allowedFields(request.datasetKey()));
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

        List<String> missing = requiredFields(request.datasetKey()).stream()
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
