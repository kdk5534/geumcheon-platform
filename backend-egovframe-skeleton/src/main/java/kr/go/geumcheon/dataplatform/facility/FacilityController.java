package kr.go.geumcheon.dataplatform.facility;

import kr.go.geumcheon.dataplatform.api.ApiResponse;
import kr.go.geumcheon.dataplatform.api.PaginationMeta;
import kr.go.geumcheon.dataplatform.api.PublicApiMetaFactory;
import kr.go.geumcheon.dataplatform.publicdata.MapQuery;
import kr.go.geumcheon.dataplatform.publicdata.PublicDataRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/public/facilities")
public class FacilityController {

    private final PublicDataRepository repository;
    private final String runtimeMode;

    public FacilityController(
            PublicDataRepository repository,
            @Value("${geumcheon.runtime.mode:db}") String runtimeMode
    ) {
        this.repository = repository;
        this.runtimeMode = runtimeMode;
    }

    /**
     * 시설 목록 조회.
     * bbox 파라미터(minLat/minLng/maxLat/maxLng)가 모두 있으면 PostGIS 공간 필터를 적용한다.
     * category가 없거나 "전체"이면 카테고리 필터를 적용하지 않는다.
     */
    @GetMapping
    public ApiResponse<List<FacilitySummary>> listFacilities(
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
        List<FacilitySummary> rows = repository.listFacilities(query);
        long total = repository.countFacilities(query);
        return ApiResponse.ok(
                rows,
                sourceMode(),
                PublicApiMetaFactory.forDataset(
                        repository,
                        datasetKeyForCategory(category),
                        null,
                        PaginationMeta.of(query.page(), query.size(), total)
                )
        );
    }

    private String sourceMode() {
        return "mock".equalsIgnoreCase(runtimeMode) ? "mock" : "db";
    }

    private String datasetKeyForCategory(String category) {
        if (category == null || category.isBlank() || "전체".equals(category)) return "facilities";
        return switch (category.toUpperCase()) {
            case "WIFI" -> "public-wifi";
            case "BIKE" -> "bike-stations";
            case "CCTV" -> "cctv-stations";
            case "PARKING" -> "parking-lots";
            case "PARKING_SPACE_REFERENCE" -> "parking-spaces";
            case "SHELTER" -> "heat-shelters";
            case "SCHOOL_ZONE" -> "school-zones";
            case "EV_CHARGER" -> "ev-chargers";
            case "WELFARE" -> "welfare-facilities";
            case "CIVIL_DEFENSE_SHELTER" -> "civil-defense-shelters";
            case "HOSPITAL" -> "hospitals";
            case "PHARMACY" -> "pharmacies";
            case "CHILDCARE" -> "childcare-centers";
            // Phase 1 신규
            case "LIBRARY" -> "libraries";
            case "PARK" -> "parks";
            case "TRADITIONAL_MARKET" -> "traditional-markets";
            case "KNOWLEDGE_INDUSTRY_CENTER" -> "knowledge-industry-center";
            default -> "facilities";
        };
    }
}
