package kr.go.geumcheon.dataplatform.publicdata;

public record StoreSummary(
        String id,
        String name,
        String category,
        String address,
        double latitude,
        double longitude,
        String source,
        String spatialScope
) {
    public StoreSummary(
            String id,
            String name,
            String category,
            String address,
            double latitude,
            double longitude,
            String source
    ) {
        this(id, name, category, address, latitude, longitude, source, SpatialScope.GEUMCHEON.name());
    }
}
