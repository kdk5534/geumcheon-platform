package kr.go.geumcheon.dataplatform.map;

public interface BoundaryStore {
    BoundaryFeatureCollection find(String boundaryType, String baseYear);
}
