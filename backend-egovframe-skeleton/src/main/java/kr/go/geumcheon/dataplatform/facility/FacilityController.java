package kr.go.geumcheon.dataplatform.facility;

import kr.go.geumcheon.dataplatform.api.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/public/facilities")
public class FacilityController {

    @GetMapping
    public ApiResponse<List<FacilitySummary>> listFacilities() {
        return ApiResponse.ok(List.of(
                new FacilitySummary("FAC-001", "병원", "금천구 보건소", "서울특별시 금천구 시흥대로73길 70", "02-2627-2422", 37.4568, 126.8954, "Mock"),
                new FacilitySummary("FAC-002", "도서관", "금천구립가산도서관", "서울특별시 금천구 가산로5길 43", "02-865-6817", 37.4723, 126.8917, "Mock"),
                new FacilitySummary("FAC-003", "주차장", "금천구청 공영주차장", "서울특별시 금천구 시흥대로73길 70", "02-0000-0000", 37.4556, 126.8941, "Mock")
        ));
    }
}
