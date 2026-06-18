package kr.go.geumcheon.dataplatform.publicdata;

import kr.go.geumcheon.dataplatform.api.ApiResponse;
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
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "200") int size
    ) {
        MapQuery query = new MapQuery(minLat, minLng, maxLat, maxLng, category, page, size);
        return ApiResponse.ok(repository.listStores(query), sourceMode());
    }

    @GetMapping("/air-quality")
    public ApiResponse<List<AirQualitySummary>> airQuality() {
        return ApiResponse.ok(repository.listAirQuality(), sourceMode());
    }

    @GetMapping("/population")
    public ApiResponse<List<PopulationSummary>> population() {
        return ApiResponse.ok(repository.listPopulation(), sourceMode());
    }

    private String sourceMode() {
        return "mock".equalsIgnoreCase(runtimeMode) ? "mock" : "db";
    }
}
