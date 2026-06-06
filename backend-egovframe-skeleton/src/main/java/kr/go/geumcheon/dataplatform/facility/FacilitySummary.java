package kr.go.geumcheon.dataplatform.facility;

public record FacilitySummary(
        String id,
        String category,
        String name,
        String address,
        String phone,
        Double latitude,
        Double longitude,
        String source
) {
}
