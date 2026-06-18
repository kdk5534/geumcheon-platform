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
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class PublicDataCollectorService {

    private static final String STATS_STORE_KEY = "stores";
    private static final String AIR_QUALITY_KEY = "air-quality";
    private static final String BIKE_KEY = "bike-stations";
    private static final String CCTV_KEY = "cctv-stations";
    private static final String PARKING_KEY = "parking-lots";
    private static final String POPULATION_KEY = "population";
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
                collectorSpec(AIR_QUALITY_KEY, hasValue(seoulOpenApiKey)),
                collectorSpec(BIKE_KEY, hasValue(seoulOpenApiKey)),
                collectorSpec(CCTV_KEY, hasValue(seoulOpenApiKey)),
                collectorSpec(PARKING_KEY, hasValue(seoulOpenApiKey)),
                collectorSpec(POPULATION_KEY, hasValue(dataGoKrApiKey))
        );
    }

    public List<ApiSourceSummary> loadApiSources() {
        return repository.listApiSources(specs());
    }

    public List<ApiLogSummary> loadApiLogs() {
        return repository.recentApiLogs(specs());
    }

    // ─── 공통 sync 골격 ──────────────────────────────────────────────────────────

    /** 행 데이터를 수집하는 함수형 인터페이스 — 체크 예외를 허용한다. */
    @FunctionalInterface
    private interface RowFetcher {
        List<Map<String, String>> fetch(String requestUrl, String datasetName) throws Exception;
    }

    /** 행 데이터를 저장하는 함수형 인터페이스. */
    @FunctionalInterface
    private interface RowSaver {
        int save(java.util.UUID datasetId, List<Map<String, String>> rows);
    }

    /**
     * 공공데이터 단건 수집의 공통 골격.
     * URL 생성 → API 키 검사 → 행 수집 → 저장 → 로그 기록 → 결과 반환을 일원화한다.
     */
    private CollectionRunResult runSyncPipeline(
            String datasetKey,
            String requiredApiKey,
            String apiKeyMissingMsg,
            java.util.function.Supplier<String> buildRequestUrl,
            RowFetcher fetchRows,
            RowSaver saveRows,
            java.util.function.Function<Integer, String> successMsg,
            String triggeredBy
    ) {
        PublicDataRepository.CollectorSpec spec = specs().stream()
                .filter(item -> datasetKey.equals(item.datasetKey()))
                .findFirst()
                .orElseThrow();

        Instant startedAt = Instant.now();
        String requestUrl = buildRequestUrl.get();
        String loggedRequestUrl = maskRequestUrlForLog(requestUrl);
        UUIDResult result = new UUIDResult(repository.upsertDataset(spec));

        if (requiredApiKey == null || requiredApiKey.isBlank()) {
            return finishSkipped(spec, startedAt, loggedRequestUrl, apiKeyMissingMsg, triggeredBy, result.datasetId());
        }

        try {
            List<Map<String, String>> rows = fetchRows.fetch(requestUrl, spec.datasetName());
            int saved = saveRows.save(result.datasetId(), rows);
            Instant finishedAt = Instant.now();
            repository.recordCollectionLog(
                    result.datasetId(), "API", "SUCCESS",
                    startedAt, finishedAt, rows.size(), saved, null, loggedRequestUrl, triggeredBy
            );
            return new CollectionRunResult(
                    spec.datasetKey(), "success", rows.size(), saved,
                    successMsg.apply(saved),
                    loggedRequestUrl, startedAt, finishedAt, Duration.between(startedAt, finishedAt)
            );
        } catch (Exception error) {
            return finishFailed(spec, startedAt, loggedRequestUrl, error, triggeredBy, result.datasetId());
        }
    }

    // ─── 공개 sync 메서드 ─────────────────────────────────────────────────────────

    public List<CollectionRunResult> syncAll(String triggeredBy) {
        if (!beginCollectorRun()) {
            return busyResults(triggeredBy);
        }

        try {
            List<CollectionRunResult> results = new ArrayList<>();
            results.add(syncStores(triggeredBy));
            results.add(syncAirQuality(triggeredBy));
            results.add(syncBikeStations(triggeredBy));
            results.add(syncCctvStations(triggeredBy));
            results.add(syncParkingLots(triggeredBy));
            results.add(syncPopulation(triggeredBy));
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
                case BIKE_KEY -> syncBikeStations(triggeredBy);
                case CCTV_KEY -> syncCctvStations(triggeredBy);
                case PARKING_KEY -> syncParkingLots(triggeredBy);
                case POPULATION_KEY -> syncPopulation(triggeredBy);
                default -> missingRoutineResult(spec);
            };
        } finally {
            collectorRunning.set(false);
        }
    }

    public CollectionRunResult syncStores(String triggeredBy) {
        return runSyncPipeline(
                STATS_STORE_KEY, dataGoKrApiKey, "DATA_GO_KR_API_KEY is missing.",
                () -> buildStoreRequestUrl(1),
                (url, name) -> fetchStoreRowsWithRetry(name),
                repository::replaceStoreBusinesses,
                saved -> "Saved " + saved + " store record(s).",
                triggeredBy);
    }

    public CollectionRunResult syncAirQuality(String triggeredBy) {
        return runSyncPipeline(
                AIR_QUALITY_KEY, seoulOpenApiKey, "SEOUL_OPEN_API_KEY is missing.",
                this::buildAirQualityRequestUrl,
                this::fetchRowsWithRetry,
                repository::replaceAirQualitySnapshot,
                saved -> "Saved " + saved + " air quality record(s).",
                triggeredBy);
    }

    public CollectionRunResult syncBikeStations(String triggeredBy) {
        return runSyncPipeline(
                BIKE_KEY, seoulOpenApiKey, "SEOUL_OPEN_API_KEY is missing.",
                () -> buildBikeRequestUrl(1),
                (url, name) -> fetchBikeRowsWithFilter(),
                (id, rows) -> repository.replaceFacilitySnapshot(id, "BIKE", rows),
                saved -> "Saved " + saved + " bike station(s).",
                triggeredBy);
    }

    // 금천구 bbox (위도 37.43~37.50, 경도 126.87~126.92)
    private static final double BIKE_LAT_MIN = 37.43;
    private static final double BIKE_LAT_MAX = 37.50;
    private static final double BIKE_LON_MIN = 126.87;
    private static final double BIKE_LON_MAX = 126.92;

    private List<Map<String, String>> fetchBikeRowsWithFilter() throws Exception {
        List<Map<String, String>> all = new ArrayList<>();
        int pageSize = 1000;
        int pageNo = 1;
        while (true) {
            int start = (pageNo - 1) * pageSize + 1;
            int end = pageNo * pageSize;
            JsonNode root = executeJsonWithRetry(buildBikeRequestUrl(start, end), "bike-stations page " + pageNo);
            List<Map<String, String>> page = extractRows(root);
            if (page.isEmpty()) {
                break;
            }
            for (Map<String, String> row : page) {
                String latStr = row.get("stationLatitude");
                String lonStr = row.get("stationLongitude");
                if (latStr == null || lonStr == null) continue;
                try {
                    double lat = Double.parseDouble(latStr.trim());
                    double lon = Double.parseDouble(lonStr.trim());
                    if (lat >= BIKE_LAT_MIN && lat <= BIKE_LAT_MAX && lon >= BIKE_LON_MIN && lon <= BIKE_LON_MAX) {
                        all.add(row);
                    }
                } catch (NumberFormatException ignored) {}
            }
            if (page.size() < pageSize) {
                break;
            }
            pageNo++;
            sleepBeforeStorePage();
        }
        return all;
    }

    private String buildBikeRequestUrl(int start, int end) {
        return "http://openapi.seoul.go.kr:8088/"
                + normalizeKeyValue(seoulOpenApiKey)
                + "/json/bikeList/" + start + "/" + end + "/";
    }

    private String buildBikeRequestUrl(int pageNo) {
        int start = (pageNo - 1) * 1000 + 1;
        int end = pageNo * 1000;
        return buildBikeRequestUrl(start, end);
    }

    public CollectionRunResult syncCctvStations(String triggeredBy) {
        return runSyncPipeline(
                CCTV_KEY, seoulOpenApiKey, "SEOUL_OPEN_API_KEY is missing.",
                this::buildCctvRequestUrl,
                this::fetchRowsWithRetry,
                (id, rows) -> repository.replaceFacilitySnapshot(id, "CCTV", rows),
                saved -> "Saved " + saved + " CCTV station(s).",
                triggeredBy);
    }

    private String buildCctvRequestUrl() {
        return "http://openapi.seoul.go.kr:8088/"
                + normalizeKeyValue(seoulOpenApiKey)
                + "/json/TB_GC_VVTV_INFO_ID01/1/400/";
    }

    public CollectionRunResult syncParkingLots(String triggeredBy) {
        return runSyncPipeline(
                PARKING_KEY, seoulOpenApiKey, "SEOUL_OPEN_API_KEY is missing.",
                () -> buildParkingRequestUrl(1, 500),
                (url, name) -> fetchParkingRowsWithFilter(),
                (id, rows) -> repository.replaceFacilitySnapshot(id, "PARKING", rows),
                saved -> "Saved " + saved + " parking lot(s).",
                triggeredBy);
    }

    private List<Map<String, String>> fetchParkingRowsWithFilter() throws Exception {
        List<Map<String, String>> all = new ArrayList<>();
        int pageSize = 500;
        int pageNo = 1;
        while (true) {
            int start = (pageNo - 1) * pageSize + 1;
            int end = pageNo * pageSize;
            JsonNode root = executeJsonWithRetry(buildParkingRequestUrl(start, end), "parking-lots page " + pageNo);
            List<Map<String, String>> page = extractRows(root);
            if (page.isEmpty()) {
                break;
            }
            for (Map<String, String> row : page) {
                String latStr = row.get("LAT");
                String lonStr = row.get("LOT");
                if (latStr == null || latStr.isBlank() || lonStr == null || lonStr.isBlank()) continue;
                try {
                    double lat = Double.parseDouble(latStr.trim());
                    double lon = Double.parseDouble(lonStr.trim());
                    if (lat >= BIKE_LAT_MIN && lat <= BIKE_LAT_MAX && lon >= BIKE_LON_MIN && lon <= BIKE_LON_MAX) {
                        all.add(row);
                    }
                } catch (NumberFormatException ignored) {}
            }
            if (page.size() < pageSize) {
                break;
            }
            pageNo++;
            sleepBeforeStorePage();
        }
        return all;
    }

    private String buildParkingRequestUrl(int start, int end) {
        return "http://openapi.seoul.go.kr:8088/"
                + normalizeKeyValue(seoulOpenApiKey)
                + "/json/GetParkInfo/" + start + "/" + end + "/"
                + "?ADDR=" + java.net.URLEncoder.encode("금천", java.nio.charset.StandardCharsets.UTF_8);
    }

    public CollectionRunResult syncPopulation(String triggeredBy) {
        return runSyncPipeline(
                POPULATION_KEY, dataGoKrApiKey, "DATA_GO_KR_API_KEY is missing.",
                this::buildPopulationRequestUrl,
                this::fetchRowsWithRetry,
                repository::replacePopulationSnapshot,
                saved -> "Saved " + saved + " population record(s).",
                triggeredBy);
    }

    private String buildPopulationRequestUrl() {
        LocalDate prev = LocalDate.now().minusMonths(1);
        String yearMonth = String.format("%d%02d", prev.getYear(), prev.getMonthValue());
        String encodedKey;
        try {
            encodedKey = URLEncoder.encode(normalizeKeyValue(dataGoKrApiKey), StandardCharsets.UTF_8);
        } catch (Exception e) {
            encodedKey = normalizeKeyValue(dataGoKrApiKey);
        }
        return "https://apis.data.go.kr/1741000/admmSexdAgePpltn/selectAdmmSexdAgePpltn"
                + "?serviceKey=" + encodedKey
                + "&admmCd=1154500000"
                + "&srchFrYm=" + yearMonth
                + "&srchToYm=" + yearMonth
                + "&lv=3"
                + "&regSeCd=1"
                + "&type=json"
                + "&numOfRows=50"
                + "&pageNo=1";
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
        if (node.isArray() && isObjectArray(node)) {
            return node;
        }
        if (node.isObject()) {
            for (String key : List.of("item", "row", "items", "data", "list", "rows")) {
                JsonNode direct = node.get(key);
                if (direct == null) {
                    continue;
                }
                if (direct.isArray() && isObjectArray(direct)) {
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

    // 빈 배열이거나 첫 요소가 객체인 경우에만 데이터 행 배열로 간주한다.
    // header.columns 같은 문자열 배열을 건너뛰기 위해 사용한다.
    private boolean isObjectArray(JsonNode array) {
        if (array.isEmpty()) {
            return true;
        }
        return array.get(0).isObject();
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
