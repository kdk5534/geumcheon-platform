package kr.go.geumcheon.dataplatform.api;

public record ApiMeta(
        String status,
        String observedAt,
        String collectedAt,
        String source,
        PaginationMeta pagination
) {
}
