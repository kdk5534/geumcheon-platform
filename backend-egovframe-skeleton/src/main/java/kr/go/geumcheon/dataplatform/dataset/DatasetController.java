package kr.go.geumcheon.dataplatform.dataset;

import kr.go.geumcheon.dataplatform.api.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/public/datasets")
public class DatasetController {

    @GetMapping
    public ApiResponse<List<DatasetSummary>> listDatasets() {
        return ApiResponse.ok(List.of(
                new DatasetSummary("air-quality", "미세먼지/초미세먼지", "실시간", "서울 열린데이터광장", "시간", "API 가능", true),
                new DatasetSummary("stores", "상가업소 정보", "상권", "소상공인시장진흥공단", "수시", "API 가능", true),
                new DatasetSummary("facilities", "생활시설 통합", "생활", "금천구 열린데이터광장", "수시", "CSV/API", false)
        ));
    }
}
