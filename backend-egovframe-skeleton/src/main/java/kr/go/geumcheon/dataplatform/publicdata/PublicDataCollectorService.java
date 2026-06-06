package kr.go.geumcheon.dataplatform.publicdata;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class PublicDataCollectorService {

    private static final String STATS_STORE_KEY = "stores";
    private static final String AIR_QUALITY_KEY = "air-quality";
    private static final Logger log = LoggerFactory.getLogger(PublicDataCollectorService.class);

    private final JdbcPublicDataRepository repository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String dataGoKrApiKey;
    private final String seoulOpenApiKey;
    private final boolean collectorEnabled;
    private final int timeoutSeconds;
    private final int retryCount;
    private final int retryDelaySeconds;
    private final AtomicBoolean collectorRunning = new AtomicBoolean(false);

    public PublicDataCollectorService(
            JdbcPublicDataRepository repository,
            ObjectMapper objectMapper,
            @Value("${geumcheon.api-keys.data-go-kr:}") String dataGoKrApiKey,
            @Value("${geumcheon.api-keys.seoul-open-api:}") String seoulOpenApiKey,
            @Value("${geumcheon.collector.enabled:false}") boolean collectorEnabled,
            @Value("${geumcheon.collector.default-timeout-seconds:20}") int timeoutSeconds,
            @Value("${geumcheon.collector.retry-count:3}") int retryCount,
            @Value("${geumcheon.collector.retry-delay-seconds:5}") int retryDelaySeconds
    ) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.dataGoKrApiKey = dataGoKrApiKey;
        this.seoulOpenApiKey = seoulOpenApiKey;
        this.collectorEnabled = collectorEnabled;
        this.timeoutSeconds = timeoutSeconds;
        this.retryCount = Math.max(0, retryCount);
        this.retryDelaySeconds = Math.max(0, retryDelaySeconds);
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(Math.max(timeoutSeconds, 5)))
                .build();
    }

    public boolean isCollectorEnabled() {
        return collectorEnabled;
    }

    public List<JdbcPublicDataRepository.CollectorSpec> specs() {
        return List.of(
                new JdbcPublicDataRepository.CollectorSpec(
                        STATS_STORE_KEY,
                        "상가업소 정보",
                        "상권",
                        "소상공인시장진흥공단",
                        "https://www.data.go.kr/data/15012005/openapi.do",
                        "수시",
                        "POINT",
                        "API 가능",
                        true,
                        "DATA_GO_KR_API_KEY",
                        hasValue(dataGoKrApiKey),
                        "상권분석"
                ),
                new JdbcPublicDataRepository.CollectorSpec(
                        AIR_QUALITY_KEY,
                        "미세먼지/초미세먼지",
                        "실시간",
                        "서울 열린데이터광장",
                        "https://data.seoul.go.kr/dataList/OA-1200/A/1/datasetView.do",
                        "시간",
                        "AREA",
                        "API 가능",
                        true,
                        "SEOUL_OPEN_API_KEY",
                        hasValue(seoulOpenApiKey),
                        "대기환경"
                )
        );
    }

    public List<ApiSourceSummary> loadApiSources() {
        return repository.listApiSources(specs());
    }

    public List<ApiLogSummary> loadApiLogs() {
        return repository.recentApiLogs(specs());
    }

    public List<CollectionRunResult> syncAll(String triggeredBy) {
        if (!beginCollectorRun()) {
            return busyResults(triggeredBy);
        }

        try {
            List<CollectionRunResult> results = new ArrayList<>();
            results.add(syncStores(triggeredBy));
            results.add(syncAirQuality(triggeredBy));
            return results;
        } finally {
            collectorRunning.set(false);
        }
    }

    public CollectionRunResult syncDataset(String datasetKey, String triggeredBy) {
        JdbcPublicDataRepository.CollectorSpec spec = specs().stream()
                .filter(item -> item.datasetKey().equals(datasetKey))
                .findFirst()
                .orElse(null);
        if (spec == null) {
            return new CollectionRunResult(
                    datasetKey,
                    "skipped",
                    0,
                    0,
                    "Unknown dataset key: " + datasetKey,
                    "-",
                    Instant.now(),
                    Instant.now(),
                    Duration.ZERO
            );
        }
        if (!beginCollectorRun()) {
            return busyResult(spec, triggeredBy);
        }

        try {
            return switch (datasetKey) {
                case STATS_STORE_KEY -> syncStores(triggeredBy);
                case AIR_QUALITY_KEY -> syncAirQuality(triggeredBy);
                default -> busyResult(spec, triggeredBy);
            };
        } finally {
            collectorRunning.set(false);
        }
    }

    public CollectionRunResult syncStores(String triggeredBy) {
        JdbcPublicDataRepository.CollectorSpec spec = specs().stream()
                .filter(item -> STATS_STORE_KEY.equals(item.datasetKey()))
                .findFirst()
                .orElseThrow();

        Instant startedAt = Instant.now();
        String requestUrl = buildStoreRequestUrl();
        String loggedRequestUrl = maskRequestUrlForLog(requestUrl);
        UUIDResult result = new UUIDResult(repository.upsertDataset(spec));

        if (dataGoKrApiKey == null || dataGoKrApiKey.isBlank()) {
            return finishSkipped(spec, startedAt, loggedRequestUrl, "DATA_GO_KR_API_KEY is missing.", triggeredBy, result.datasetId());
        }

        try {
            List<Map<String, String>> rows = fetchRowsWithRetry(requestUrl, spec.datasetName());
            int saved = repository.replaceStoreBusinesses(result.datasetId(), rows);
            Instant finishedAt = Instant.now();
            repository.recordCollectionLog(
                    result.datasetId(),
                    "API",
                    "SUCCESS",
                    startedAt,
                    finishedAt,
                    rows.size(),
                    saved,
                    null,
                    loggedRequestUrl,
                    triggeredBy
            );
            return new CollectionRunResult(
                    spec.datasetKey(),
                    "success",
                    rows.size(),
                    saved,
                    "Saved " + saved + " store record(s).",
                    loggedRequestUrl,
                    startedAt,
                    finishedAt,
                    Duration.between(startedAt, finishedAt)
            );
        } catch (Exception error) {
            return finishFailed(spec, startedAt, loggedRequestUrl, error, triggeredBy, result.datasetId());
        }
    }

    public CollectionRunResult syncAirQuality(String triggeredBy) {
        JdbcPublicDataRepository.CollectorSpec spec = specs().stream()
                .filter(item -> AIR_QUALITY_KEY.equals(item.datasetKey()))
                .findFirst()
                .orElseThrow();

        Instant startedAt = Instant.now();
        String requestUrl = buildAirQualityRequestUrl();
        String loggedRequestUrl = maskRequestUrlForLog(requestUrl);
        UUIDResult result = new UUIDResult(repository.upsertDataset(spec));

        if (seoulOpenApiKey == null || seoulOpenApiKey.isBlank()) {
            return finishSkipped(spec, startedAt, loggedRequestUrl, "SEOUL_OPEN_API_KEY is missing.", triggeredBy, result.datasetId());
        }

        try {
            List<Map<String, String>> rows = fetchRowsWithRetry(requestUrl, spec.datasetName());
            int saved = repository.replaceAirQualitySnapshot(result.datasetId(), rows);
            Instant finishedAt = Instant.now();
            repository.recordCollectionLog(
                    result.datasetId(),
                    "API",
                    "SUCCESS",
                    startedAt,
                    finishedAt,
                    rows.size(),
                    saved,
                    null,
                    loggedRequestUrl,
                    triggeredBy
            );
            return new CollectionRunResult(
                    spec.datasetKey(),
                    "success",
                    rows.size(),
                    saved,
                    "Saved " + saved + " air quality record(s).",
                    loggedRequestUrl,
                    startedAt,
                    finishedAt,
                    Duration.between(startedAt, finishedAt)
            );
        } catch (Exception error) {
            return finishFailed(spec, startedAt, loggedRequestUrl, error, triggeredBy, result.datasetId());
        }
    }

    private CollectionRunResult finishSkipped(
            JdbcPublicDataRepository.CollectorSpec spec,
            Instant startedAt,
            String loggedRequestUrl,
            String message,
            String triggeredBy,
            java.util.UUID datasetId
    ) {
        Instant finishedAt = Instant.now();
        repository.recordCollectionLog(
                datasetId,
                "API",
                "SKIPPED",
                startedAt,
                finishedAt,
                0,
                0,
                message,
                loggedRequestUrl,
                triggeredBy
        );
        return new CollectionRunResult(
                spec.datasetKey(),
                "skipped",
                0,
                0,
                message,
                loggedRequestUrl,
                startedAt,
                finishedAt,
                Duration.between(startedAt, finishedAt)
        );
    }

    private CollectionRunResult finishFailed(
            JdbcPublicDataRepository.CollectorSpec spec,
            Instant startedAt,
            String loggedRequestUrl,
            Exception error,
            String triggeredBy,
            java.util.UUID datasetId
    ) {
        Instant finishedAt = Instant.now();
        String detailMessage = error.getMessage() == null || error.getMessage().isBlank()
                ? error.getClass().getSimpleName()
                : error.getMessage();
        String maskedDetailMessage = maskKnownSecrets(detailMessage);
        String userMessage = "Public data collection failed.";
        log.warn("Public data collection failed for {}: {}", spec.datasetKey(), maskedDetailMessage, error);
        repository.recordCollectionLog(
                datasetId,
                "API",
                "FAILED",
                startedAt,
                finishedAt,
                0,
                0,
                maskedDetailMessage,
                loggedRequestUrl,
                triggeredBy
        );
        return new CollectionRunResult(
                spec.datasetKey(),
                "failed",
                0,
                0,
                userMessage,
                loggedRequestUrl,
                startedAt,
                finishedAt,
                Duration.between(startedAt, finishedAt)
        );
    }

    private String buildStoreRequestUrl() {
        return "http://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius"
                + "?ServiceKey=" + normalizeKeyValue(dataGoKrApiKey)
                + "&pageNo=1"
                + "&numOfRows=100"
                + "&type=json"
                + "&cx=126.8954"
                + "&cy=37.4568"
                + "&x=126.8954"
                + "&y=37.4568"
                + "&radius=3000";
    }

    private String buildAirQualityRequestUrl() {
        return "http://openAPI.seoul.go.kr:8088/"
                + normalizeKeyValue(seoulOpenApiKey)
                + "/json/ListAirQualityByDistrictService/1/25/";
    }

    private String maskRequestUrlForLog(String requestUrl) {
        if (requestUrl == null || requestUrl.isBlank()) {
            return "-";
        }
        return maskKnownSecrets(RequestUrlMasker.mask(requestUrl));
    }

    private String maskKnownSecrets(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        String masked = value;
        String dataGoKrKey = normalizeKeyValue(dataGoKrApiKey);
        if (!dataGoKrKey.isBlank()) {
            masked = masked.replace(dataGoKrKey, "[redacted]");
        }
        String seoulKey = normalizeKeyValue(seoulOpenApiKey);
        if (!seoulKey.isBlank()) {
            masked = masked.replace(seoulKey, "[redacted]");
        }
        return masked;
    }

    private List<CollectionRunResult> busyResults(String triggeredBy) {
        Instant now = Instant.now();
        return specs().stream()
                .map(spec -> busyResult(spec, triggeredBy, now))
                .toList();
    }

    private CollectionRunResult busyResult(JdbcPublicDataRepository.CollectorSpec spec, String triggeredBy) {
        return busyResult(spec, triggeredBy, Instant.now());
    }

    private CollectionRunResult busyResult(JdbcPublicDataRepository.CollectorSpec spec, String triggeredBy, Instant now) {
        return new CollectionRunResult(
                spec.datasetKey(),
                "skipped",
                0,
                0,
                "Public data collector is already running.",
                "-",
                now,
                now,
                Duration.ZERO
        );
    }

    private boolean beginCollectorRun() {
        return collectorRunning.compareAndSet(false, true);
    }

    private List<Map<String, String>> fetchRowsWithRetry(String requestUrl, String datasetName) throws Exception {
        int attempts = Math.max(1, retryCount + 1);
        Exception lastError = null;

        for (int attempt = 1; attempt <= attempts; attempt += 1) {
            try {
                JsonNode root = executeJson(requestUrl);
                List<Map<String, String>> rows = extractRows(root);
                if (rows.isEmpty()) {
                    throw new IllegalStateException("No " + datasetName + " records were returned from the API.");
                }
                return rows;
            } catch (Exception error) {
                lastError = error;
                if (attempt >= attempts) {
                    break;
                }
                logRetry(attempt, attempts, datasetName, error);
                sleepBeforeRetry();
            }
        }

        throw lastError == null ? new IllegalStateException("Collection failed without a specific error.") : lastError;
    }

    private void logRetry(int attempt, int attempts, String datasetName, Exception error) {
        String message = error.getMessage() == null || error.getMessage().isBlank()
                ? error.getClass().getSimpleName()
                : error.getMessage();
        log.warn(
                "Collector retry {}/{} for {} failed: {}",
                attempt,
                attempts,
                datasetName,
                maskKnownSecrets(message)
        );
    }

    private void sleepBeforeRetry() throws InterruptedException {
        if (retryDelaySeconds <= 0) {
            return;
        }
        try {
            Thread.sleep(Duration.ofSeconds(retryDelaySeconds).toMillis());
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw error;
        }
    }

    private String normalizeKeyValue(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean hasValue(String value) {
        return value != null && !value.isBlank();
    }

    private JsonNode executeJson(String url) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .GET()
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("API request failed with HTTP " + response.statusCode());
        }
        return objectMapper.readTree(response.body());
    }

    private List<Map<String, String>> extractRows(JsonNode root) {
        JsonNode array = findArrayNode(root);
        if (array == null || !array.isArray()) {
            return List.of();
        }

        List<Map<String, String>> rows = new ArrayList<>();
        for (JsonNode item : array) {
            if (!item.isObject()) {
                continue;
            }
            rows.add(flatten(item));
        }
        return rows;
    }

    private JsonNode findArrayNode(JsonNode node) {
        if (node == null) {
            return null;
        }
        if (node.isArray()) {
            return node;
        }
        if (node.isObject()) {
            for (String key : List.of("item", "row", "items", "data", "list", "rows")) {
                JsonNode direct = node.get(key);
                if (direct == null) {
                    continue;
                }
                if (direct.isArray()) {
                    return direct;
                }
                JsonNode nested = findArrayNode(direct);
                if (nested != null) {
                    return nested;
                }
            }
            for (JsonNode child : node) {
                JsonNode nested = findArrayNode(child);
                if (nested != null) {
                    return nested;
                }
            }
        }
        return null;
    }

    private Map<String, String> flatten(JsonNode object) {
        Map<String, String> row = new LinkedHashMap<>();
        object.fields().forEachRemaining(entry -> row.put(entry.getKey(), stringify(entry.getValue())));
        return row;
    }

    private String stringify(JsonNode node) {
        if (node == null || node.isNull()) {
            return "";
        }
        if (node.isValueNode()) {
            return node.asText("");
        }
        return node.toString();
    }

    private record UUIDResult(java.util.UUID datasetId) {
    }
}
