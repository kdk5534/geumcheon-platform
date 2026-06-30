package kr.go.geumcheon.dataplatform.search;

import java.util.List;

public interface UnifiedSearchStore {
    List<SearchResultItem> search(String query, int limit);
}
