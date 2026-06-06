package kr.go.geumcheon.dataplatform.admin;

import kr.go.geumcheon.dataplatform.api.ApiResponse;
import kr.go.geumcheon.dataplatform.publicdata.CollectionRunResult;
import kr.go.geumcheon.dataplatform.publicdata.PublicDataCollectorService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/public-data")
public class PublicDataAdminController {

    private final PublicDataCollectorService collectorService;

    public PublicDataAdminController(PublicDataCollectorService collectorService) {
        this.collectorService = collectorService;
    }

    @PostMapping("/sync")
    public ApiResponse<List<CollectionRunResult>> sync(@RequestParam(required = false) String datasetKey) {
        if (datasetKey == null || datasetKey.isBlank()) {
            return ApiResponse.ok(collectorService.syncAll("manual"));
        }
        return ApiResponse.ok(List.of(collectorService.syncDataset(datasetKey, "manual")));
    }
}
