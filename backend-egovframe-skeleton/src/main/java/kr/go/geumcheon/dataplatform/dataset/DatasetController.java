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
                return ApiResponse.ok(defaultDatasets(), sourceMode());
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

    private List<DatasetSummary> defaultDatasets() {
        return List.of(
                new DatasetSummary("stores", "상가업소 정보", "상권", "소상공인시장진흥공단", "수시", "API 가능", true),
                new DatasetSummary("air-quality", "미세먼지/초미세먼지", "실시간", "서울 열린데이터광장", "시간", "API 가능", true),
                new DatasetSummary("facilities", "생활시설 통합", "생활", "금천구 열린데이터광장", "수시", "CSV/API", false),
                new DatasetSummary("population", "인구 통계", "인구", "서울 열린데이터광장", "월", "CSV/API", true)
        );
    }
}
