package kr.go.geumcheon.dataplatform.dataset;

import kr.go.geumcheon.dataplatform.api.ApiResponse;
import kr.go.geumcheon.dataplatform.publicdata.JdbcPublicDataRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/public/datasets")
public class DatasetController {

    private final JdbcPublicDataRepository repository;
    private final String runtimeMode;

    public DatasetController(
            JdbcPublicDataRepository repository,
            @Value("${geumcheon.runtime.mode:db}") String runtimeMode
    ) {
        this.repository = repository;
        this.runtimeMode = runtimeMode;
    }

    @GetMapping
    public ApiResponse<List<DatasetSummary>> listDatasets() {
        try {
            return ApiResponse.ok(repository.listDatasets(), sourceMode());
        } catch (RuntimeException error) {
            if (isMockMode()) {
                return ApiResponse.ok(DatasetRegistry.publicSummaries(), sourceMode());
            }
            throw error;
        }
    }

    private boolean isMockMode() {
        return "mock".equalsIgnoreCase(runtimeMode);
    }

    private String sourceMode() {
        return isMockMode() ? "mock" : "db";
    }
}
