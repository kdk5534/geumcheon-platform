package kr.go.geumcheon.dataplatform.dataset;

import java.time.LocalDate;

public record DatasetAccessPolicy(
        String datasetKey,
        AccessMode accessMode,
        boolean fileDownloadAllowed,
        boolean externalApiRedistributionAllowed,
        String licenseName,
        String licenseUrl,
        LocalDate sourceCheckedAt,
        String attributionNotice
) {
    public DatasetAccessPolicy {
        if (datasetKey == null || datasetKey.isBlank()) throw new IllegalArgumentException("datasetKey is required");
        if (accessMode == null) throw new IllegalArgumentException("accessMode is required");
        if (sourceCheckedAt == null) throw new IllegalArgumentException("sourceCheckedAt is required");
    }

    public enum AccessMode {
        SCREEN_ONLY,
        REDISTRIBUTION_ALLOWED
    }
}
