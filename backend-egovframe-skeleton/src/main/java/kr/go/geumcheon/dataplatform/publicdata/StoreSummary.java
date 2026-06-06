package kr.go.geumcheon.dataplatform.publicdata;

public record StoreSummary(
        String id,
        String name,
        String category,
        String address,
        double latitude,
        double longitude,
        String source
) {
}
