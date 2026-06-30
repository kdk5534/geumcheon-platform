package kr.go.geumcheon.dataplatform.publicdata;

import java.util.List;

public record SpatialScopeCountSummary(
        long count,
        List<String> scopes
) {
}

