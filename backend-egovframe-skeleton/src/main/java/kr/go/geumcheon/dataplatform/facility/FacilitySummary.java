package kr.go.geumcheon.dataplatform.facility;

public record FacilitySummary(
        String id,
        String category,
        String name,
        String address,
        String phone,
        Double latitude,
        Double longitude,
        String source,
        String spatialScope,
        String dataReferenceDate
) {
    public FacilitySummary(
            String id,
            String category,
            String name,
            String address,
            String phone,
            Double latitude,
            Double longitude,
            String source,
            String spatialScope
    ) {
        this(id, category, name, address, phone, latitude, longitude, source, spatialScope, null);
    }

    public FacilitySummary(
            String id,
            String category,
            String name,
            String address,
            String phone,
            Double latitude,
            Double longitude,
            String source
    ) {
        this(id, category, name, address, phone, latitude, longitude, source, "GEUMCHEON", null);
    }
}
