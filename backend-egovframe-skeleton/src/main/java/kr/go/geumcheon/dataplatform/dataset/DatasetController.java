package kr.go.geumcheon.dataplatform.dataset;

import kr.go.geumcheon.dataplatform.api.ApiResponse;
import kr.go.geumcheon.dataplatform.api.PublicApiMetaFactory;
import kr.go.geumcheon.dataplatform.publicdata.PublicDataRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.Clock;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/public/datasets")
public class DatasetController {

    private final PublicDataRepository repository;
    private final DatasetRegistry datasetRegistry;
    private final String runtimeMode;
    private final Clock clock;

    @Autowired
    public DatasetController(
            PublicDataRepository repository,
            DatasetRegistry datasetRegistry,
            @Value("${geumcheon.runtime.mode:db}") String runtimeMode
    ) {
        this(repository, datasetRegistry, runtimeMode, Clock.systemUTC());
    }

    DatasetController(
            PublicDataRepository repository,
            DatasetRegistry datasetRegistry,
            String runtimeMode,
            Clock clock
    ) {
        this.repository = repository;
        this.datasetRegistry = datasetRegistry;
        this.runtimeMode = runtimeMode;
        this.clock = clock;
    }

    @GetMapping
    public ApiResponse<List<DatasetSummary>> listDatasets() {
        return ApiResponse.ok(repository.listDatasets(), sourceMode());
    }

    @GetMapping("/status")
    public ApiResponse<List<DatasetOperationalStatusSummary>> listDatasetStatuses() {
        Set<String> publicKeys = datasetRegistry.listAll().stream()
                .filter(DatasetDefinition::publicVisible)
                .map(DatasetDefinition::datasetKey)
                .collect(Collectors.toSet());
        List<DatasetOperationalStatusSummary> statuses = repository.listDatasetOperationalStatuses().stream()
                .filter(status -> publicKeys.contains(status.datasetKey()))
                .map(this::applyFreshnessStatus)
                .toList();
        return ApiResponse.ok(statuses, sourceMode());
    }

    @GetMapping("/contracts")
    public ApiResponse<List<DatasetContractSummary>> listDatasetContracts() {
        LocalDate asOfDate = LocalDate.now(ZoneId.of("Asia/Seoul"));
        List<DatasetContractSummary> contracts = datasetRegistry.listAll().stream()
                .filter(DatasetDefinition::publicVisible)
                .map(definition -> DatasetContractSummary.from(
                        definition,
                        DatasetPolicyRegistry.getRequired(definition.datasetKey()),
                        asOfDate
                ))
                .toList();
        return ApiResponse.ok(contracts, "policy-registry");
    }

    private String sourceMode() {
        return "mock".equalsIgnoreCase(runtimeMode) ? "mock" : "db";
    }

    private DatasetOperationalStatusSummary applyFreshnessStatus(DatasetOperationalStatusSummary status) {
        if (status.collectedAt() == null || status.collectedAt().isBlank()
                || "NO_SUCCESS".equals(status.dataStatus())) {
            return status;
        }
        String dataStatus = PublicApiMetaFactory.freshnessStatus(status, clock.instant());
        return new DatasetOperationalStatusSummary(
                status.datasetKey(), status.datasetName(), status.domain(), status.sourceName(),
                status.attemptStatus(), status.attemptedAt(), status.attemptSourceRecordCount(),
                status.attemptSavedRecordCount(), status.failureType(), dataStatus, status.collectedAt(),
                status.lastSuccessSourceRecordCount(), status.lastSuccessSavedRecordCount()
        );
    }
}
