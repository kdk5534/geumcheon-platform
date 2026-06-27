package kr.go.geumcheon.dataplatform.map;

import java.util.List;
import java.util.Map;

public record BoundaryFeatureCollection(
        String type,
        String boundaryType,
        String baseYear,
        String coordinateSystem,
        List<Feature> features
) {
    public BoundaryFeatureCollection(String boundaryType, String baseYear, List<Feature> features) {
        this("FeatureCollection", boundaryType, baseYear, "EPSG:4326", features);
    }

    public record Feature(
            String type,
            String id,
            Map<String, Object> properties,
            Map<String, Object> geometry
    ) {
        public Feature(String id, Map<String, Object> properties, Map<String, Object> geometry) {
            this("Feature", id, properties, geometry);
        }
    }
}
