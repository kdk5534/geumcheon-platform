package kr.go.geumcheon.dataplatform.map;

import kr.go.geumcheon.dataplatform.api.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/boundaries")
public class BoundaryController {

    private final BoundaryStore store;

    public BoundaryController(BoundaryStore store) {
        this.store = store;
    }

    @GetMapping
    public ApiResponse<BoundaryFeatureCollection> boundaries(
            @RequestParam(defaultValue = "DONG") String type,
            @RequestParam(required = false) String baseYear
    ) {
        return ApiResponse.ok(store.find(type, baseYear), "db");
    }
}
