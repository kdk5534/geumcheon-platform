package kr.go.geumcheon.dataplatform.search;

import kr.go.geumcheon.dataplatform.api.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/public/search")
public class UnifiedSearchController {

    private static final List<SearchResultItem> SCREENS = List.of(
            new SearchResultItem("SCREEN", "home", "종합 현황", "금천구 핵심 현황", "#/home"),
            new SearchResultItem("SCREEN", "population", "인구·생활", "인구, 연령, 가구 구성", "#/population"),
            new SearchResultItem("SCREEN", "commercial", "상권·경제", "업종 분포와 변화", "#/commercial"),
            new SearchResultItem("SCREEN", "welfare", "복지·건강", "돌봄, 의료, 긴급지원", "#/welfare"),
            new SearchResultItem("SCREEN", "safety", "안전·환경", "대기질과 안전시설", "#/realtime"),
            new SearchResultItem("SCREEN", "catalog", "데이터 카탈로그", "출처와 다운로드", "#/datasets")
    );

    private final UnifiedSearchStore store;

    public UnifiedSearchController(UnifiedSearchStore store) {
        this.store = store;
    }

    @GetMapping
    public ApiResponse<SearchResponse> search(
            @RequestParam String q,
            @RequestParam(defaultValue = "ko") String lang,
            @RequestParam(defaultValue = "20") int limit
    ) {
        String query = q == null ? "" : q.trim();
        if (query.isEmpty() || query.length() > 80) {
            throw new IllegalArgumentException("Search query must contain between 1 and 80 characters.");
        }
        int normalizedLimit = Math.max(1, Math.min(50, limit));
        String normalized = query.toLowerCase(Locale.ROOT);
        List<SearchResultItem> items = new ArrayList<>(SCREENS.stream()
                .filter(item -> (item.title() + " " + item.detail()).toLowerCase(Locale.ROOT).contains(normalized))
                .toList());
        items.addAll(store.search(query, normalizedLimit));
        return ApiResponse.ok(new SearchResponse("ko", items.stream().limit(normalizedLimit).toList()), "db");
    }

    public record SearchResponse(String language, List<SearchResultItem> items) {
    }
}
