package kr.go.geumcheon.dataplatform.admin;

import kr.go.geumcheon.dataplatform.dataset.DatasetDefinition;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class UploadValidator {

    public List<String> validatePreview(DatasetDefinition dataset, List<String> headers, int rowCount) {
        List<String> warnings = new ArrayList<>();
        if (headers.isEmpty()) {
            warnings.add("헤더 행이 비어 있습니다.");
        }
        if (rowCount == 0) {
            warnings.add("데이터 행이 비어 있습니다.");
        }
        List<String> missing = dataset.requiredFields().stream()
                .filter(column -> !headers.contains(column))
                .toList();
        if (!missing.isEmpty()) {
            warnings.add("권장 컬럼 누락: " + String.join(", ", missing));
        }
        return warnings;
    }

    public List<String> validateCommitMapping(DatasetDefinition dataset, UploadCommitRequest request) {
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

        Set<String> allowed = new LinkedHashSet<>(dataset.allowedFields());
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

        List<String> missing = dataset.requiredFields().stream()
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

    /**
     * columnMappings의 키(CSV 원본 헤더명)가 실제 파일 헤더에 존재하는지 검사한다.
     * 존재하지 않는 키가 있으면 매핑이 무효하고 전 행이 누락되어 데이터 소실로 이어진다.
     */
    public List<String> validateMappingKeys(List<String> csvHeaders, Map<String, String> mappings) {
        List<String> errors = new ArrayList<>();
        if (mappings == null || mappings.isEmpty() || csvHeaders == null) {
            return errors;
        }
        Set<String> headerSet = new LinkedHashSet<>(csvHeaders);
        List<String> unknownKeys = mappings.keySet().stream()
                .filter(key -> key != null && !key.isBlank() && !headerSet.contains(key))
                .toList();
        if (!unknownKeys.isEmpty()) {
            errors.add("column mappings reference headers not found in CSV: " + String.join(", ", unknownKeys));
        }
        return errors;
    }

    public List<String> validateCommitCounts(CsvUploadDraft draft, UploadCommitRequest request) {
        List<String> errors = new ArrayList<>();
        int previewRowCount = draft == null ? 0 : draft.rowCount();
        int previewColumnCount = draft == null ? 0 : draft.columnCount();

        if (request.rowCount() != previewRowCount) {
            errors.add("rowCount does not match preview data (expected " + previewRowCount + ", got " + request.rowCount() + ")");
        }
        if (request.columnCount() != previewColumnCount) {
            errors.add("columnCount does not match preview data (expected " + previewColumnCount + ", got " + request.columnCount() + ")");
        }
        return errors;
    }
}
