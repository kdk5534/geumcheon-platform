package kr.go.geumcheon.dataplatform.facility;

import kr.go.geumcheon.dataplatform.api.ApiResponse;
import kr.go.geumcheon.dataplatform.publicdata.PublicDataRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
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

    @GetMapping
    public ApiResponse<List<FacilitySummary>> listFacilities() {
        return ApiResponse.ok(repository.listFacilities(), sourceMode());
    }

    private String sourceMode() {
        return "mock".equalsIgnoreCase(runtimeMode) ? "mock" : "db";
    }
}
