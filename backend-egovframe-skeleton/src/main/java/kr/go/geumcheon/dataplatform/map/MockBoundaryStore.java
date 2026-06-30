package kr.go.geumcheon.dataplatform.map;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Profile("mock")
public class MockBoundaryStore implements BoundaryStore {
    @Override
    public BoundaryFeatureCollection find(String boundaryType, String baseYear) {
        String normalized = boundaryType == null ? "DONG" : boundaryType.toUpperCase(java.util.Locale.ROOT);
        if (!List.of("DISTRICT", "DONG").contains(normalized)) {
            throw new IllegalArgumentException("Boundary type must be DISTRICT or DONG.");
        }
        return new BoundaryFeatureCollection(normalized, baseYear, List.of());
    }
}
