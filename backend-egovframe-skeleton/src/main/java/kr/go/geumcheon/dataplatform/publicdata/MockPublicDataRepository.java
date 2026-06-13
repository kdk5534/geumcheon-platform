package kr.go.geumcheon.dataplatform.publicdata;

import kr.go.geumcheon.dataplatform.dataset.DatasetSummary;
import kr.go.geumcheon.dataplatform.dataset.DatasetRegistry;
import kr.go.geumcheon.dataplatform.facility.FacilitySummary;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;

@Repository
@Profile("mock")
public class MockPublicDataRepository extends JdbcPublicDataRepository {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm");

    private final Map<String, UUID> datasetIdsByKey = new ConcurrentHashMap<>();
    private final Map<UUID, String> datasetKeysById = new ConcurrentHashMap<>();
    private final Map<String, UUID> indicatorIdsByKey = new ConcurrentHashMap<>();
    private final List<CollectionLogEntry> collectionLogs = new CopyOnWriteArrayList<>();

    public MockPublicDataRepository() {
        super(null, null);
        seedInitialLogs();
    }

    @Override
    public List<DatasetSummary> listDatasets() {
        return defaultDatasets();
    }

    @Override
    public List<FacilitySummary> listFacilities() {
        return defaultFacilities();
    }

    @Override
    public List<StoreSummary> listStores() {
        return defaultStores();
    }

    @Override
    public List<AirQualitySummary> listAirQuality() {
        return defaultAirQuality();
    }

    @Override
    public List<ApiSourceSummary> listApiSources(List<CollectorSpec> specs) {
        return specs.stream()
                .map(spec -> {
                    CollectionLogEntry latest = latestLog(spec.datasetKey(), "API");
                    String lastSynced = latest == null ? "-" : formatInstant(latest.finishedAt());
                    String note = latest == null
                            ? "Mock data is available in local mode."
                            : "Most recent mock sync saved " + latest.savedRecordCount() + " record(s).";
                    return new ApiSourceSummary(
                            spec.datasetKey(),
                            spec.datasetName(),
                            spec.domain(),
                            "mock",
                            spec.refreshCycle(),
                            spec.targetScreen(),
                            spec.envVarName(),
                            spec.sourceName(),
                            lastSynced,
                            note
                    );
                })
                .toList();
    }

    @Override
    public List<ApiLogSummary> recentApiLogs(List<CollectorSpec> specs) {
        Map<String, CollectorSpec> specMap = specs.stream().collect(Collectors.toMap(
                CollectorSpec::datasetKey,
                spec -> spec,
                (left, right) -> left,
                LinkedHashMap::new
        ));

        return collectionLogs.stream()
                .filter(entry -> "API".equalsIgnoreCase(entry.collectionType()))
                .sorted(Comparator.comparing(CollectionLogEntry::finishedAt).reversed())
                .limit(20)
                .map(entry -> toApiLogSummary(entry, specMap.get(entry.datasetKey())))
                .toList();
    }

    @Override
    public Map<String, DatasetRegistryEntry> loadDatasetRegistryEntries(List<CollectorSpec> specs) {
        Map<String, DatasetRegistryEntry> entries = new LinkedHashMap<>();
        for (CollectorSpec spec : specs) {
            entries.put(spec.datasetKey(), new DatasetRegistryEntry(
                    spec.datasetKey(),
                    spec.datasetName(),
                    spec.domain(),
                    spec.sourceName(),
                    spec.sourceUrl(),
                    spec.refreshCycle(),
                    spec.apiStatus(),
                    spec.authKeyRequired(),
                    spec.envVarName(),
                    toApiLogSummary(latestLog(spec.datasetKey(), "API"), spec)
            ));
        }
        return entries;
    }

    @Override
    public UUID upsertDataset(CollectorSpec spec) {
        UUID datasetId = datasetIdsByKey.computeIfAbsent(spec.datasetKey(), key ->
                UUID.nameUUIDFromBytes(("mock-dataset:" + key).getBytes(StandardCharsets.UTF_8))
        );
        datasetKeysById.put(datasetId, spec.datasetKey());
        return datasetId;
    }

    @Override
    public UUID ensureIndicator(String indicatorKey, String indicatorName, String domain, String unit, String description, UUID datasetId) {
        return indicatorIdsByKey.computeIfAbsent(indicatorKey, key ->
                UUID.nameUUIDFromBytes((key + ":" + datasetId).getBytes(StandardCharsets.UTF_8))
        );
    }

    @Override
    public int replaceStoreBusinesses(UUID datasetId, List<Map<String, String>> rows) {
        return rows == null ? 0 : rows.size();
    }

    @Override
    public int replaceAirQualitySnapshot(UUID datasetId, List<Map<String, String>> rows) {
        return rows == null ? 0 : rows.size();
    }

    @Override
    public UUID recordCollectionLog(
            UUID datasetId,
            String collectionType,
            String status,
            Instant startedAt,
            Instant finishedAt,
            int sourceRecordCount,
            int savedRecordCount,
            String errorMessage,
            String requestUrl,
            String createdBy
    ) {
        UUID logId = UUID.randomUUID();
        String datasetKey = datasetKeysById.getOrDefault(datasetId, datasetId == null ? "unknown" : datasetId.toString());
        collectionLogs.add(new CollectionLogEntry(
                logId.toString(),
                datasetKey,
                collectionType,
                status,
                startedAt == null ? Instant.now() : startedAt,
                finishedAt == null ? Instant.now() : finishedAt,
                sourceRecordCount,
                savedRecordCount,
                errorMessage,
                maskRequestUrlForLog(requestUrl),
                createdBy
        ));
        return logId;
    }

    private void seedInitialLogs() {
        Instant now = Instant.now();
        collectionLogs.add(new CollectionLogEntry(
                "MOCK-API-001",
                "stores",
                "API",
                "SUCCESS",
                now.minus(Duration.ofMinutes(18)),
                now.minus(Duration.ofMinutes(17)),
                28,
                28,
                "Mock store sync is ready.",
                "-",
                "mock"
        ));
        collectionLogs.add(new CollectionLogEntry(
                "MOCK-API-002",
                "air-quality",
                "API",
                "SUCCESS",
                now.minus(Duration.ofMinutes(13)),
                now.minus(Duration.ofMinutes(12)),
                18,
                18,
                "Mock air quality sync is ready.",
                "-",
                "mock"
        ));
    }

    private List<DatasetSummary> defaultDatasets() {
        return DatasetRegistry.publicSummaries();
    }

    private List<FacilitySummary> defaultFacilities() {
        return List.of(
                new FacilitySummary("FAC-001", "hospital", "Geumcheon Health Center", "Seoul Geumcheon-gu Siheung-daero 73-gil 70", "02-2627-2422", 37.4568, 126.8954, "Mock"),
                new FacilitySummary("FAC-002", "pharmacy", "Gasan Digital Pharmacy", "Seoul Geumcheon-gu Gasan-dong", "02-865-6817", 37.4723, 126.8917, "Mock"),
                new FacilitySummary("FAC-003", "parking", "Geumcheon District Parking", "Seoul Geumcheon-gu Siheung-daero 73-gil 70", "02-0000-0000", 37.4556, 126.8941, "Mock"),
                new FacilitySummary("FAC-004", "safety", "Siheung 2-dong Community Center", "Seoul Geumcheon-gu Doksan-ro 54-gil 12", "02-2627-3000", 37.4519, 126.9002, "Mock"),
                new FacilitySummary("FAC-005", "welfare", "Geumcheon Lifelong Learning Center", "Seoul Geumcheon-gu Gasan-dong 371-50", "02-2627-1000", 37.4612, 126.9085, "Mock"),
                new FacilitySummary("FAC-006", "safety", "Gasan AED Location", "Seoul Geumcheon-gu Gasan-digital 1-ro 168", "02-0000-0000", 37.4697, 126.8868, "Mock")
        );
    }

    private List<StoreSummary> defaultStores() {
        return List.of(
                new StoreSummary("STORE-001", "Gasan Tower Cafe", "cafe", "Seoul Geumcheon-gu Gasan-digital 1-ro 128", 37.4772, 126.8875, "Mock"),
                new StoreSummary("STORE-002", "Geumcheon Office Convenience", "convenience", "Seoul Geumcheon-gu Siheung-daero 73-gil 70", 37.4569, 126.8958, "Mock"),
                new StoreSummary("STORE-003", "Siheung Cafe Street", "cafe", "Seoul Geumcheon-gu Siheung-daero 138-gil 26", 37.4498, 126.9033, "Mock")
        );
    }

    private List<AirQualitySummary> defaultAirQuality() {
        Instant now = Instant.now();
        return List.of(
                new AirQualitySummary("111121", "Gasan-dong", formatInstant(now.minus(Duration.ofMinutes(10))), "Good", "PM10", 18.0, 0.014, 0.019, 0.3, 0.5, 22.0, 10.0, "Mock"),
                new AirQualitySummary("111122", "Doksan-dong", formatInstant(now.minus(Duration.ofMinutes(8))), "Moderate", "PM10", 34.0, 0.018, 0.022, 0.4, 0.6, 28.0, 12.0, "Mock")
        );
    }

    private CollectionLogEntry latestLog(String datasetKey, String collectionType) {
        return collectionLogs.stream()
                .filter(entry -> entry.datasetKey().equals(datasetKey))
                .filter(entry -> entry.collectionType().equalsIgnoreCase(collectionType))
                .max(Comparator.comparing(CollectionLogEntry::finishedAt))
                .orElse(null);
    }

    private ApiLogSummary toApiLogSummary(CollectionLogEntry entry, CollectorSpec spec) {
        if (entry == null) {
            return null;
        }

        String status = mapLogStatus(entry.status(), entry.createdBy());
        String duration = formatDuration(Duration.between(entry.startedAt(), entry.finishedAt()).toSeconds());
        String note = entry.errorMessage();
        if (note == null || note.isBlank()) {
            note = "Saved " + entry.savedRecordCount() + " record(s).";
        }

        return new ApiLogSummary(
                entry.logId(),
                spec == null ? entry.datasetKey() : spec.sourceName(),
                spec == null ? defaultDomain(entry.datasetKey()) : spec.domain(),
                status,
                formatInstant(entry.finishedAt()),
                duration,
                entry.savedRecordCount(),
                spec == null ? defaultTargetScreen(entry.datasetKey()) : spec.targetScreen(),
                spec == null ? "-" : spec.refreshCycle(),
                note
        );
    }

    private String mapLogStatus(String collectionStatus, String createdBy) {
        if (collectionStatus == null) {
            return "queued";
        }
        String normalized = collectionStatus.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "SUCCESS" -> "manual".equalsIgnoreCase(createdBy) ? "manual" : "success";
            case "FAILED" -> "fail";
            case "SKIPPED" -> "queued";
            default -> "queued";
        };
    }

    private String defaultDomain(String datasetKey) {
        return switch (datasetKey == null ? "" : datasetKey) {
            case "stores" -> "commercial";
            case "air-quality" -> "environment";
            case "facilities" -> "life";
            case "population" -> "population";
            default -> "general";
        };
    }

    private String defaultTargetScreen(String datasetKey) {
        return switch (datasetKey == null ? "" : datasetKey) {
            case "stores" -> "commercial-analysis";
            case "air-quality" -> "environment-dashboard";
            default -> "main-dashboard";
        };
    }

    private String maskRequestUrlForLog(String requestUrl) {
        if (requestUrl == null || requestUrl.isBlank()) {
            return requestUrl;
        }
        return RequestUrlMasker.mask(requestUrl);
    }

    private String formatInstant(Instant instant) {
        if (instant == null) {
            return "-";
        }
        return DATE_TIME.format(LocalDateTime.ofInstant(instant, ZoneId.systemDefault()));
    }

    private String formatDuration(long seconds) {
        long safeSeconds = Math.max(1L, seconds);
        if (safeSeconds < 60) {
            return safeSeconds + "s";
        }
        long minutes = safeSeconds / 60;
        long remain = safeSeconds % 60;
        if (remain == 0) {
            return minutes + "m";
        }
        return minutes + "m " + remain + "s";
    }

    private record CollectionLogEntry(
            String logId,
            String datasetKey,
            String collectionType,
            String status,
            Instant startedAt,
            Instant finishedAt,
            int sourceRecordCount,
            int savedRecordCount,
            String errorMessage,
            String requestUrl,
            String createdBy
    ) {
    }
}
