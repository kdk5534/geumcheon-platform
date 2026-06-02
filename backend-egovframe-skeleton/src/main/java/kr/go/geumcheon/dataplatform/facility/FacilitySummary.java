package kr.go.geumcheon.dataplatform.facility;

public record FacilitySummary(
        String id,
        String category,
        String name,
        String address,
        String phone,
        double latitude,
        double longitude,
        String source
) {
}

