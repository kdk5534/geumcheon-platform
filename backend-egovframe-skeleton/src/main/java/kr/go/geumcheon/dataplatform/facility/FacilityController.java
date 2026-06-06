package kr.go.geumcheon.dataplatform.facility;

import kr.go.geumcheon.dataplatform.api.ApiResponse;
import kr.go.geumcheon.dataplatform.publicdata.JdbcPublicDataRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/public/facilities")
public class FacilityController {

    private final JdbcPublicDataRepository repository;
    private final String runtimeMode;

    public FacilityController(
            JdbcPublicDataRepository repository,
            @Value("${geumcheon.runtime.mode:db}") String runtimeMode
    ) {
        this.repository = repository;
        this.runtimeMode = runtimeMode;
    }

    @GetMapping
    public ApiResponse<List<FacilitySummary>> listFacilities() {
        try {
            return ApiResponse.ok(repository.listFacilities(), sourceMode());
        } catch (RuntimeException error) {
            if (isMockMode()) {
                return ApiResponse.ok(defaultFacilities(), sourceMode());
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

    private List<FacilitySummary> defaultFacilities() {
        return List.of(
                new FacilitySummary("FAC-001", "병원", "금천구 보건소", "서울특별시 금천구 시흥대로 73길 70", "02-2627-2422", 37.4568, 126.8954, "Mock"),
                new FacilitySummary("FAC-002", "약국", "가산디지털약국", "서울특별시 금천구 가산로5길 43", "02-865-6817", 37.4723, 126.8917, "Mock"),
                new FacilitySummary("FAC-003", "주차", "금천구청 공영주차장", "서울특별시 금천구 시흥대로 73길 70", "02-0000-0000", 37.4556, 126.8941, "Mock")
        );
    }
}
