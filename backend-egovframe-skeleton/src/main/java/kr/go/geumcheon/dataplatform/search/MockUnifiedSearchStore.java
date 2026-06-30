package kr.go.geumcheon.dataplatform.search;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Profile("mock")
public class MockUnifiedSearchStore implements UnifiedSearchStore {
    @Override
    public List<SearchResultItem> search(String query, int limit) {
        return List.of();
    }
}
