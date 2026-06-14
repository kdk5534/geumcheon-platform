package kr.go.geumcheon.dataplatform.publicdata;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import kr.go.geumcheon.dataplatform.dataset.DatasetRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
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

    private final PublicDataRepository repository;
    private final DatasetRegistry datasetRegistry;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String dataGoKrApiKey;
    private final String seoulOpenApiKey;
    private final boolean collectorEnabled;
    private final int timeoutSeconds;
    private final int retryCount;
    private final int retryDelaySeconds;
    private final int storePageSize;
    private final int storeMaxPages;
    private final int storePageDelayMillis;
    private final AtomicBoolean collectorRunning = new AtomicBoolean(false);

    @Autowired
    public PublicDataCollectorService(
            PublicDataRepository repository,
            DatasetRegistry datasetRegistry,
            ObjectMapper objectMapper,
            @Value("${geumcheon.api-keys.data-go-kr:}") String dataGoKrApiKey,
            @Value("${geumcheon.api-keys.seoul-open-api:}") String seoulOpenApiKey,
            @Value("${geumcheon.collector.enabled:false}") boolean collectorEnabled,
            @Value("${geumcheon.collector.default-timeout-seconds:20}") int timeoutSeconds,
            @Value("${geumcheon.collector.retry-count:3}") int retryCount,
            @Value("${geumcheon.collector.retry-delay-seconds:5}") int retryDelaySeconds,
            @Value("${geumcheon.collector.store-page-size:100}") int storePageSize,
            @Value("${geumcheon.collector.store-max-pages:1}") int storeMaxPages,
            @Value("${geumcheon.collector.store-page-delay-millis:0}") int storePageDelayMillis
    ) {
        this(
                repository,
                datasetRegistry,
                objectMapper,
                dataGoKrApiKey,
                seoulOpenApiKey,
                collectorEnabled,
                timeoutSeconds,
                retryCount,
                retryDelaySeconds,
                storePageSize,
                storeMaxPages,
                storePageDelayMillis,
                HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(Math.max(timeoutSeconds, 5)))
                        .build()
        );
    }

    PublicDataCollectorService(
            PublicDataRepository repository,
            DatasetRegistry datasetRegistry,
            ObjectMapper objectMapper,
            String dataGoKrApiKey,
            String seoulOpenApiKey,
            boolean collectorEnabled,
            int timeoutSeconds,
            int retryCount,
            int retryDelaySeconds,
            int storePageSize,
            int storeMaxPages,
            int storePageDelayMillis,
            HttpClient httpClient
    ) {
        this.repository = repository;
        this.datasetRegistry = datasetRegistry;
        this.objectMapper = objectMapper;
        this.dataGoKrApiKey = dataGoKrApiKey;
        this.seoulOpenApiKey = seoulOpenApiKey;
        this.collectorEnabled = collectorEnabled;
        this.timeoutSeconds = timeoutSeconds;
        this.retryCount = Math.max(0, retryCount);
        this.retryDelaySeconds = Math.max(0, retryDelaySeconds);
        this.storePageSize = Math.max(1, storePageSize);
        this.storeMaxPages = Math.max(1, storeMaxPages);
        this.storePageDelayMillis = Math.max(0, storePageDelayMillis);
        this.httpClient = httpClient;
    }

    public boolean isCollectorEnabled() {
        return collectorEnabled;
    }

    public List<PublicDataRepository.CollectorSpec> specs() {
        return List.of(
                collectorSpec(STATS_STORE_KEY, hasValue(dataGoKrApiKey)),
                collectorSpec(AIR_QUALITY_KEY, hasValue(seoulOpenApiKey))
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
        PublicDataRepository.CollectorSpec spec = specs().stream()
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
                default -> missingRoutineResult(spec);
            };
        } finally {
            collectorRunning.set(false);
        }
    }

    public CollectionRunResult syncStores(String triggeredBy) {
        PublicDataRepository.CollectorSpec spec = specs().stream()
                .filter(item -> STATS_STORE_KEY.equals(item.datasetKey()))
                .findFirst()
                .orElseThrow();

        Instant startedAt = Instant.now();
        String requestUrl = buildStoreRequestUrl(1);
        String loggedRequestUrl = maskRequestUrlForLog(requestUrl);
        UUIDResult result = new UUIDResult(repository.upsertDataset(spec));

        if (dataGoKrApiKey == null || dataGoKrApiKey.isBlank()) {
            return finishSkipped(spec, startedAt, loggedRequestUrl, "DATA_GO_KR_API_KEY is missing.", triggeredBy, result.datasetId());
        }

        try {
            List<Map<String, String>> rows = fetchStoreRowsWithRetry(spec.datasetName());
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
        PublicDataRepository.CollectorSpec spec = specs().stream()
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
            PublicDataRepository.CollectorSpec spec,
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
            PublicDataRepository.CollectorSpec spec,
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
        return buildStoreRequestUrl(1);
    }

    private String buildStoreRequestUrl(int pageNo) {
        return "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius"
                + "?ServiceKey=" + normalizeKeyValue(dataGoKrApiKey)
                + "&pageNo=" + Math.max(1, pageNo)
                + "&numOfRows=" + storePageSize
                + "&type=json"
                + "&cx=126.8954"
                + "&cy=37.4568"
                + "&x=126.8954"
                + "&y=37.4568"
                + "&radius=3000";
    }

    private String buildAirQualityRequestUrl() {
        return "https://openAPI.seoul.go.kr:8088/"
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

    private CollectionRunResult busyResult(PublicDataRepository.CollectorSpec spec, String triggeredBy) {
        return busyResult(spec, triggeredBy, Instant.now());
    }

    private CollectionRunResult busyResult(PublicDataRepository.CollectorSpec spec, String triggeredBy, Instant now) {
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

    private CollectionRunResult missingRoutineResult(PublicDataRepository.CollectorSpec spec) {
        Instant now = Instant.now();
        return new CollectionRunResult(
                spec.datasetKey(),
                "skipped",
                0,
                0,
                "No collector routine for datasetKey: " + spec.datasetKey(),
                "-",
                now,
                now,
                Duration.ZERO
        );
    }

    private boolean beginCollectorRun() {
        return collectorRunning.compareAndSet(false, true);
    }

    private List<Map<String, String>> fetchStoreRowsWithRetry(String datasetName) throws Exception {
        List<Map<String, String>> allRows = new ArrayList<>();
        Integer totalCount = null;

        for (int pageNo = 1; pageNo <= storeMaxPages; pageNo += 1) {
            JsonNode root = executeJsonWithRetry(buildStoreRequestUrl(pageNo), datasetName + " page " + pageNo);
            List<Map<String, String>> pageRows = extractRows(root);
            if (pageRows.isEmpty()) {
                if (pageNo == 1) {
                    throw new IllegalStateException("No " + datasetName + " records were returned from the API.");
                }
                break;
            }

            allRows.addAll(pageRows);
            if (totalCount == null) {
                totalCount = extractTotalCount(root);
                failIfStorePageLimitExceeded(totalCount);
            }
            if (!hasMoreStorePages(pageNo, allRows.size(), pageRows.size(), totalCount)) {
                break;
            }
            sleepBeforeStorePage();
        }

        return allRows;
    }

    private void failIfStorePageLimitExceeded(Integer totalCount) {
        if (totalCount == null || totalCount <= 0) {
            return;
        }
        int requiredPages = (int) Math.ceil((double) totalCount / storePageSize);
        if (requiredPages > storeMaxPages) {
            throw new IllegalStateException(
                    "API returned totalCount " + totalCount
                            + " requiring " + requiredPages
                            + " page(s), exceeding configured max pages " + storeMaxPages
                            + " before replacing stored rows."
            );
        }
    }

    private boolean hasMoreStorePages(int pageNo, int collectedCount, int pageRowCount, Integer totalCount) {
        if (pageNo >= storeMaxPages) {
            return false;
        }
        if (pageRowCount < storePageSize) {
            return false;
        }
        return totalCount == null || collectedCount < totalCount;
    }

    private Integer extractTotalCount(JsonNode node) {
        JsonNode countNode = findCountNode(node);
        if (countNode == null || countNode.isNull()) {
            return null;
        }
        if (countNode.isInt() || countNode.isLong()) {
            return countNode.asInt();
        }
        String text = countNode.asText("").trim();
        if (text.isEmpty()) {
            return null;
        }
        try {
            return Integer.parseInt(text.replace(",", ""));
        } catch (NumberFormatException error) {
            return null;
        }
    }

    private JsonNode findCountNode(JsonNode node) {
        if (node == null) {
            return null;
        }
        if (node.isObject()) {
            for (String key : List.of("totalCount", "totalCnt", "list_total_count")) {
                JsonNode direct = node.get(key);
                if (direct != null && !direct.isNull()) {
                    return direct;
                }
            }
            for (JsonNode child : node) {
                JsonNode nested = findCountNode(child);
                if (nested != null) {
                    return nested;
                }
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                JsonNode nested = findCountNode(child);
                if (nested != null) {
                    return nested;
                }
            }
        }
        return null;
    }

    private void sleepBeforeStorePage() throws InterruptedException {
        if (storePageDelayMillis <= 0) {
            return;
        }
        try {
            Thread.sleep(storePageDelayMillis);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw error;
        }
    }

    private List<Map<String, String>> fetchRowsWithRetry(String requestUrl, String datasetName) throws Exception {
        JsonNode root = executeJsonWithRetry(requestUrl, datasetName);
        List<Map<String, String>> rows = extractRows(root);
        if (rows.isEmpty()) {
            throw new IllegalStateException("No " + datasetName + " records were returned from the API.");
        }
        return rows;
    }

    private JsonNode executeJsonWithRetry(String requestUrl, String datasetName) throws Exception {
        int attempts = Math.max(1, retryCount + 1);
        Exception lastError = null;

        for (int attempt = 1; attempt <= attempts; attempt += 1) {
            try {
                return executeJson(requestUrl);
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

    private PublicDataRepository.CollectorSpec collectorSpec(String datasetKey, boolean apiKeyPresent) {
        return datasetRegistry.getRequired(datasetKey).toCollectorSpec(apiKeyPresent);
    }

    private record UUIDResult(java.util.UUID datasetId) {
    }
}
