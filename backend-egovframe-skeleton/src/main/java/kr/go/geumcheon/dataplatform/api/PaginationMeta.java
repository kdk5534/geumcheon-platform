package kr.go.geumcheon.dataplatform.api;

public record PaginationMeta(
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean hasNext
) {
    public static PaginationMeta of(int page, int size, long totalElements) {
        int totalPages = size <= 0 ? 0 : (int) Math.ceil((double) totalElements / size);
        return new PaginationMeta(page, size, totalElements, totalPages, page + 1 < totalPages);
    }
}
