package kr.go.geumcheon.dataplatform.publicdata;

import kr.go.geumcheon.dataplatform.api.ApiResponse;
import kr.go.geumcheon.dataplatform.api.PaginationMeta;
import kr.go.geumcheon.dataplatform.api.PublicApiMetaFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/public")
public class PublicDataController {

    private final PublicDataCollectorService collectorService;
    private final PublicDataRepository repository;
    private final String runtimeMode;

    public PublicDataController(
            PublicDataCollectorService collectorService,
            PublicDataRepository repository,
            @Value("${geumcheon.runtime.mode:db}") String runtimeMode
    ) {
        this.collectorService = collectorService;
        this.repository = repository;
        this.runtimeMode = runtimeMode;
    }

    @GetMapping("/api-sources")
    public ApiResponse<List<ApiSourceSummary>> apiSources() {
        return ApiResponse.ok(collectorService.loadApiSources(), sourceMode());
    }

    @GetMapping("/api-logs")
    public ApiResponse<List<ApiLogSummary>> apiLogs() {
        return ApiResponse.ok(collectorService.loadApiLogs(), sourceMode());
    }

    /**
     * 상점 목록 조회.
     * bbox 파라미터(minLat/minLng/maxLat/maxLng)가 모두 있으면 PostGIS 공간 필터를 적용한다.
     */
    @GetMapping("/stores")
    public ApiResponse<List<StoreSummary>> stores(
            @RequestParam(required = false) Double minLat,
            @RequestParam(required = false) Double minLng,
            @RequestParam(required = false) Double maxLat,
            @RequestParam(required = false) Double maxLng,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "GEUMCHEON") String scope,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "200") int size
    ) {
        MapQuery query = new MapQuery(minLat, minLng, maxLat, maxLng, category, scope, page, size);
        List<StoreSummary> rows = repository.listStores(query);
        long total = repository.countStores(query);
        return ApiResponse.ok(
                rows,
                sourceMode(),
                PublicApiMetaFactory.forDataset(
                        repository, "stores", null, PaginationMeta.of(query.page(), query.size(), total)
                )
        );
    }

    @GetMapping("/stores/count")
    public ApiResponse<SpatialScopeCountSummary> storeCount(
            @RequestParam(defaultValue = "GEUMCHEON") String scope,
            @RequestParam(required = false) String category
    ) {
        MapQuery query = new MapQuery(null, null, null, null, category, scope, 0, 1);
        return ApiResponse.ok(
                new SpatialScopeCountSummary(repository.countStores(query), query.spatialScopes()),
                sourceMode()
        );
    }

    @GetMapping("/air-quality")
    public ApiResponse<List<AirQualitySummary>> airQuality() {
        List<AirQualitySummary> rows = repository.listAirQuality();
        String observedAt = rows.stream()
                .map(AirQualitySummary::measuredAt)
                .filter(value -> value != null && !value.isBlank())
                .max(String::compareTo)
                .orElse(null);
        return ApiResponse.ok(
                rows,
                sourceMode(),
                PublicApiMetaFactory.forDataset(
                        repository, "air-quality", observedAt, PaginationMeta.of(0, rows.size(), rows.size())
                )
        );
    }

    @GetMapping("/population")
    public ApiResponse<List<PopulationSummary>> population() {
        List<PopulationSummary> rows = repository.listPopulation();
        String observedAt = rows.stream()
                .map(PopulationSummary::observedAt)
                .filter(value -> value != null && !value.isBlank())
                .max(String::compareTo)
                .orElse(null);
        return ApiResponse.ok(
                rows,
                sourceMode(),
                PublicApiMetaFactory.forDataset(
                        repository, "population", observedAt, PaginationMeta.of(0, rows.size(), rows.size())
                )
        );
    }

    private String sourceMode() {
        return "mock".equalsIgnoreCase(runtimeMode) ? "mock" : "db";
    }
}
