package kr.go.geumcheon.dataplatform.admin;

import kr.go.geumcheon.dataplatform.dataset.DatasetDefinition;
import kr.go.geumcheon.dataplatform.dataset.DatasetRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class StagedUploadApprovalService {

    private static final Logger log = LoggerFactory.getLogger(StagedUploadApprovalService.class);

    private final StagedUploadStore stagedUploadStore;
    private final AdminUploadStore uploadStore;
    private final DatasetRegistry datasetRegistry;
    private final ExcelUploadParser excelUploadParser;
    private final CsvParser csvParser;
    private final UploadValidator uploadValidator;

    public StagedUploadApprovalService(
            StagedUploadStore stagedUploadStore,
            AdminUploadStore uploadStore,
            DatasetRegistry datasetRegistry,
            ExcelUploadParser excelUploadParser
    ) {
        this.stagedUploadStore = stagedUploadStore;
        this.uploadStore = uploadStore;
        this.datasetRegistry = datasetRegistry;
        this.excelUploadParser = excelUploadParser;
        this.csvParser = new CsvParser();
        this.uploadValidator = new UploadValidator();
    }

    public UploadLogSummary apply(ChangeRequestSummary request) {
        if (request == null || !"DATA_UPLOAD".equals(request.requestType())
                || !"STAGED_UPLOAD".equals(request.targetType())) {
            throw new IllegalArgumentException("승인 반영 대상 업로드 변경 요청이 아닙니다.");
        }
        StagedUploadMaterial material = stagedUploadStore.requirePendingForRequest(request.requestId());
        DatasetDefinition dataset = datasetRegistry.find(material.datasetKey());
        if (dataset == null || !dataset.supportsUploadCommit()) {
            throw new IllegalArgumentException("승인 반영을 지원하지 않는 데이터셋입니다.");
        }

        stagedUploadStore.markApplying(material.stagedUploadId());
        try {
            UploadLogSummary summary = applyMaterial(dataset, material);
            stagedUploadStore.markApplied(material.stagedUploadId());
            return summary;
        } catch (RuntimeException error) {
            stagedUploadStore.markFailed(material.stagedUploadId(), error.getMessage());
            log.warn("Staged upload apply failed for request {}", request.requestId(), error);
            throw error;
        }
    }

    public void reject(ChangeRequestSummary request) {
        if (request != null && "DATA_UPLOAD".equals(request.requestType())
                && "STAGED_UPLOAD".equals(request.targetType())) {
            StagedUploadMaterial material = stagedUploadStore.requirePendingForRequest(request.requestId());
            stagedUploadStore.markRejected(material.stagedUploadId());
        }
    }

    private UploadLogSummary applyMaterial(DatasetDefinition dataset, StagedUploadMaterial material) {
        byte[] content = readContent(material);
        ParsedUploadContent parsed = parse(material, content);
        CsvUploadDraft draft = new CsvUploadDraft(
                material.stagedUploadId(),
                material.datasetKey(),
                material.fileName(),
                material.excelFile(),
                material.contentPath(),
                material.fileSize(),
                material.fileHash(),
                material.headers(),
                material.rowCount(),
                material.columnCount(),
                material.stagedAt() == null ? Instant.now() : material.stagedAt()
        );
        UploadCommitRequest commit = new UploadCommitRequest(
                material.datasetKey(),
                material.stagedUploadId(),
                material.fileName(),
                material.rowCount(),
                material.columnCount(),
                material.columnMappings()
        );

        List<String> errors = new ArrayList<>();
        errors.addAll(uploadValidator.validateCommitMapping(dataset, commit));
        errors.addAll(uploadValidator.validateMappingKeys(material.headers(), material.columnMappings()));
        errors.addAll(uploadValidator.validateCommitCounts(draft, commit));
        if (!material.headers().equals(parsed.headers())
                || material.rowCount() != parsed.dataRows().size()
                || material.columnCount() != parsed.headers().size()) {
            errors.add("승인 대기 원본의 파싱 결과가 제출 당시 검증 정보와 다릅니다.");
        }
        if (!errors.isEmpty()) {
            throw new IllegalArgumentException("승인 대기 업로드 검증 실패: " + String.join(" / ", errors));
        }

        return uploadStore.recordUpload(
                commit,
                dataset.toAdminDatasetSummary(),
                mappingCount(commit),
                draft,
                parsed.dataRows()
        );
    }

    private byte[] readContent(StagedUploadMaterial material) {
        try {
            byte[] content = Files.readAllBytes(material.contentPath());
            String actualHash = CsvUploadDraft.sha256(content);
            if (!actualHash.equals(material.fileHash())) {
                throw new IllegalArgumentException("승인 대기 원본 파일 해시가 저장된 검증 정보와 다릅니다.");
            }
            if (content.length != material.fileSize()) {
                throw new IllegalArgumentException("승인 대기 원본 파일 크기가 저장된 검증 정보와 다릅니다.");
            }
            return content;
        } catch (java.io.IOException error) {
            throw new IllegalArgumentException("승인 대기 원본 파일을 읽을 수 없습니다.", error);
        }
    }

    private ParsedUploadContent parse(StagedUploadMaterial material, byte[] content) {
        List<String> warnings = new ArrayList<>();
        List<List<String>> rows = material.excelFile()
                ? collectExcelRows(content, warnings)
                : csvParser.parse(csvParser.decode(content));
        List<String> headers = rows.isEmpty() ? List.of() : List.copyOf(rows.get(0));
        List<List<String>> dataRows = rows.size() <= 1
                ? List.of()
                : rows.subList(1, rows.size()).stream().map(List::copyOf).toList();
        return new ParsedUploadContent(headers, dataRows);
    }

    private List<List<String>> collectExcelRows(byte[] content, List<String> warnings) {
        ExcelUploadParser.ParsedExcel parsedExcel = excelUploadParser.parse(content);
        warnings.addAll(parsedExcel.warnings());
        return parsedExcel.rows();
    }

    private int mappingCount(UploadCommitRequest request) {
        if (request.columnMappings() == null) {
            return 0;
        }
        return (int) request.columnMappings().values().stream()
                .filter(value -> value != null && !value.isBlank())
                .count();
    }

    private record ParsedUploadContent(
            List<String> headers,
            List<List<String>> dataRows
    ) {
    }
}
