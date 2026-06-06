package kr.go.geumcheon.dataplatform.publicdata;

public record AirQualitySummary(
        String districtCode,
        String districtName,
        String measuredAt,
        String grade,
        String pollutant,
        Double maxIndex,
        Double nitrogen,
        Double ozone,
        Double carbon,
        Double sulfurous,
        Double pm10,
        Double pm25,
        String source
) {
}
