package kr.go.geumcheon.dataplatform.search;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UnifiedSearchControllerTest {

    @Test
    void combinesScreensAndTypedRepositoryResultsInKorean() {
        UnifiedSearchStore store = (query, limit) -> List.of(
                new SearchResultItem("FACILITY", "1", "금천 복지관", "복지 · 금천구", "#/nearby?facility=1")
        );
        UnifiedSearchController controller = new UnifiedSearchController(store);

        UnifiedSearchController.SearchResponse response = controller.search("복지", "en", 20).data();

        assertThat(response.language()).isEqualTo("ko");
        assertThat(response.items()).extracting(SearchResultItem::type).contains("SCREEN", "FACILITY");
    }

    @Test
    void rejectsBlankQueries() {
        UnifiedSearchController controller = new UnifiedSearchController((query, limit) -> List.of());
        assertThatThrownBy(() -> controller.search(" ", "ko", 20))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
