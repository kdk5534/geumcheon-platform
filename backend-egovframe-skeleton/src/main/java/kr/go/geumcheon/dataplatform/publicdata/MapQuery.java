// 지도/목록 API 공통 필터 파라미터: bbox·카테고리·페이징
package kr.go.geumcheon.dataplatform.publicdata;

/**
 * 시설·상점 목록 API에 공통으로 쓰이는 공간 필터 + 페이징 파라미터.
 * hasBbox()가 true일 때만 PostGIS ST_MakeEnvelope 절이 추가된다.
 */
public record MapQuery(
        Double minLat,
        Double minLng,
        Double maxLat,
        Double maxLng,
        String category,
        int page,
        int size
) {
    public static final int DEFAULT_SIZE = 200;
    public static final int MAX_SIZE = 500;

    // 범위 강제: size 1~MAX_SIZE, page 0 이상
    public MapQuery {
        if (size <= 0) size = DEFAULT_SIZE;
        if (size > MAX_SIZE) size = MAX_SIZE;
        if (page < 0) page = 0;
    }

    public static MapQuery defaults() {
        return new MapQuery(null, null, null, null, null, 0, DEFAULT_SIZE);
    }

    /** 네 모서리 좌표가 모두 있을 때만 bbox 절을 추가한다. */
    public boolean hasBbox() {
        return minLat != null && minLng != null && maxLat != null && maxLng != null;
    }
}
