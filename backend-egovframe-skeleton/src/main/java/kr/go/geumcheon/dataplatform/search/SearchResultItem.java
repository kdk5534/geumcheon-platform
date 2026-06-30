package kr.go.geumcheon.dataplatform.search;

public record SearchResultItem(
        String type,
        String key,
        String title,
        String detail,
        String href
) {
}
