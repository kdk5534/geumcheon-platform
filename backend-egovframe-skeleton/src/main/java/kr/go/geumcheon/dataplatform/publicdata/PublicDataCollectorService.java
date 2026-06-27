package kr.go.geumcheon.dataplatform.publicdata;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import kr.go.geumcheon.dataplatform.dataset.DatasetOperationalPolicy;
import kr.go.geumcheon.dataplatform.dataset.DatasetRegistry;
import kr.go.geumcheon.dataplatform.dataset.DatasetPolicyRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
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
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class PublicDataCollectorService {

    private static final String STATS_STORE_KEY  = "stores";
    private static final String AIR_QUALITY_KEY  = "air-quality";
    private static final String BIKE_KEY         = "bike-stations";
    private static final String CCTV_KEY         = "cctv-stations";
    private static final String PARKING_KEY      = "parking-lots";
    private static final String POPULATION_KEY   = "population";
    // P4 신규 POINT 시설 데이터셋
    private static final String WIFI_KEY         = "public-wifi";
    private static final String HEAT_SHELTER_KEY = "heat-shelters";
    private static final String SCHOOL_ZONE_KEY  = "school-zones";
    private static final String EV_CHARGER_KEY   = "ev-chargers";
    private static final String WELFARE_KEY      = "welfare-facilities";
    private static final String CIVIL_SHELTER_KEY = "civil-defense-shelters";
    private static final String HOSPITAL_KEY     = "hospitals";
    private static final String PHARMACY_KEY     = "pharmacies";
    private static final String CHILDCARE_KEY    = "childcare-centers";
    // Phase 1 — 안전·환경 신규
    private static final String STREET_LIGHT_KEY = "street-lights";
    private static final String FIRE_HYDRANT_KEY = "fire-hydrants";
    // Phase 1 — 생활편의·문화 신규
    private static final String MUSEUM_KEY  = "museums";
    private static final String LIBRARY_KEY = "libraries";
    private static final String PARK_KEY = "parks";
    // Phase 1 — 산업·상권(G밸리 특화) 신규
    private static final String TRADITIONAL_MARKET_KEY = "traditional-markets";
    private static final String KNOWLEDGE_INDUSTRY_CENTER_KEY = "knowledge-industry-center";
    // odcloud 전국지식산업센터현황 API — 2025년 6/30 기준판
    // 매년 새 uddi 경로 추가됨: infuser.odcloud.kr/oas/docs?namespace=15117154/v1 에서 최신 uddi 확인 후 교체
    private static final String KNOWLEDGE_INDUSTRY_CENTER_URL =
            "https://api.odcloud.kr/api/15117154/v1/uddi:a72ac85b-0dac-46a1-bfb6-eba4fc7895d7";
    private static final Map<String, String> LIVING_FACILITY_SERVICES = Map.of(
            WELFARE_KEY, "fcltOpenInfo_GC",
            CIVIL_SHELTER_KEY, "LOCALDATA_114602_GC",
            HOSPITAL_KEY, "LOCALDATA_010101_GC",
            PHARMACY_KEY, "LOCALDATA_010106_GC",
            CHILDCARE_KEY, "ChildCareInfoGC"
    );
    private static final String BIKE_DATASET_PAGE_URL =
            "https://data.seoul.go.kr/dataList/OA-13252/A/1/datasetView.do";
    private static final String EV_DATASET_PAGE_URL =
            "https://data.seoul.go.kr/dataList/OA-13233/F/1/datasetView.do";
    private static final String SEOUL_FILE_DOWNLOAD_URL =
            "https://datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do?&useCache=false";
    private static final Pattern BIKE_FILE_SEQUENCE_PATTERN = Pattern.compile(
            "downloadFile\\('([0-9]+)'\\)[^>]*>\\s*공공자전거 대여소 정보\\([^<]+\\)\\.xlsx",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern EV_FILE_SEQUENCE_PATTERN = Pattern.compile(
            "downloadFile\\('([0-9]+)'\\)[^>]*>\\s*서울특별시 금천구_전기차충전소 정보_([0-9]{8})\\.xlsx",
            Pattern.CASE_INSENSITIVE
    );
    // 서울 API에 자치구 필드가 없는 시설 데이터용 금천구 인근 bbox.
    private static final double BIKE_LAT_MIN = 37.43;
    private static final double BIKE_LAT_MAX = 37.50;
    private static final double BIKE_LON_MIN = 126.87;
    private static final double BIKE_LON_MAX = 126.92;
    private static final Logger log = LoggerFactory.getLogger(PublicDataCollectorService.class);

    private final PublicDataRepository repository;
    private final DatasetRegistry datasetRegistry;
    private final ObjectMapper objectMapper;
    private volatile HttpClient httpClient;
    private final String dataGoKrApiKey;
    private final String seoulOpenApiKey;
    private final String wifiRelayBaseUrl;
    private final String wifiRelayToken;
    private final String livingFacilityRelayBaseUrl;
    private final String livingFacilityRelayToken;
    private final boolean collectorEnabled;
    private final int timeoutSeconds;
    private final int retryCount;
    private final int retryDelaySeconds;
    private final int storePageSize;
    private final int storeMaxPages;
    private final int storePageDelayMillis;
    private final boolean allowInsecureSeoulHttp;
    private final AtomicBoolean collectorRunning = new AtomicBoolean(false);
    // VWorld 지오코딩 키 — @Value 필드 주입 (테스트 생성자에서는 null, 지오코딩 건너뜀)
    @Value("${geumcheon.api-keys.vworld:}")
    private String vworldApiKey;

    @Autowired
    public PublicDataCollectorService(
            PublicDataRepository repository,
            DatasetRegistry datasetRegistry,
            ObjectMapper objectMapper,
            @Value("${geumcheon.api-keys.data-go-kr:}") String dataGoKrApiKey,
            @Value("${geumcheon.api-keys.seoul-open-api:}") String seoulOpenApiKey,
            @Value("${geumcheon.wifi-relay.base-url:http://127.0.0.1:18088}") String wifiRelayBaseUrl,
            @Value("${geumcheon.wifi-relay.token:}") String wifiRelayToken,
            @Value("${geumcheon.living-facility-relay.base-url:http://127.0.0.1:18089}") String livingFacilityRelayBaseUrl,
            @Value("${geumcheon.living-facility-relay.token:}") String livingFacilityRelayToken,
            @Value("${geumcheon.collector.enabled:false}") boolean collectorEnabled,
            @Value("${geumcheon.collector.default-timeout-seconds:20}") int timeoutSeconds,
            @Value("${geumcheon.collector.retry-count:3}") int retryCount,
            @Value("${geumcheon.collector.retry-delay-seconds:5}") int retryDelaySeconds,
            @Value("${geumcheon.collector.allow-insecure-seoul-http:false}") boolean allowInsecureSeoulHttp,
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
                allowInsecureSeoulHttp,
                storePageSize,
                storeMaxPages,
                storePageDelayMillis,
                wifiRelayBaseUrl,
                wifiRelayToken,
                livingFacilityRelayBaseUrl,
                livingFacilityRelayToken,
                null
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
        this(
                repository, datasetRegistry, objectMapper,
                dataGoKrApiKey, seoulOpenApiKey, collectorEnabled,
                timeoutSeconds, retryCount, retryDelaySeconds, false,
                storePageSize, storeMaxPages, storePageDelayMillis,
                "http://127.0.0.1:18088", "", "http://127.0.0.1:18089", "", httpClient
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
            boolean allowInsecureSeoulHttp,
            int storePageSize,
            int storeMaxPages,
            int storePageDelayMillis,
            HttpClient httpClient
    ) {
        this(
                repository, datasetRegistry, objectMapper,
                dataGoKrApiKey, seoulOpenApiKey, collectorEnabled,
                timeoutSeconds, retryCount, retryDelaySeconds, allowInsecureSeoulHttp,
                storePageSize, storeMaxPages, storePageDelayMillis,
                "http://127.0.0.1:18088", "", "http://127.0.0.1:18089", "", httpClient
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
            boolean allowInsecureSeoulHttp,
            int storePageSize,
            int storeMaxPages,
            int storePageDelayMillis,
            String wifiRelayBaseUrl,
            String wifiRelayToken,
            HttpClient httpClient
    ) {
        this(repository, datasetRegistry, objectMapper, dataGoKrApiKey, seoulOpenApiKey,
                collectorEnabled, timeoutSeconds, retryCount, retryDelaySeconds,
                allowInsecureSeoulHttp, storePageSize, storeMaxPages, storePageDelayMillis,
                wifiRelayBaseUrl, wifiRelayToken, "http://127.0.0.1:18089", "", httpClient);
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
            boolean allowInsecureSeoulHttp,
            int storePageSize,
            int storeMaxPages,
            int storePageDelayMillis,
            String wifiRelayBaseUrl,
            String wifiRelayToken,
            String livingFacilityRelayBaseUrl,
            String livingFacilityRelayToken,
            HttpClient httpClient
    ) {
        this.repository = repository;
        this.datasetRegistry = datasetRegistry;
        this.objectMapper = objectMapper;
        this.dataGoKrApiKey = dataGoKrApiKey;
        this.seoulOpenApiKey = seoulOpenApiKey;
        this.wifiRelayBaseUrl = normalizeWifiRelayBaseUrl(wifiRelayBaseUrl);
        this.wifiRelayToken = wifiRelayToken == null ? "" : wifiRelayToken.trim();
        this.livingFacilityRelayBaseUrl = normalizeRelayBaseUrl(livingFacilityRelayBaseUrl, 18089, "Living facility");
        this.livingFacilityRelayToken = livingFacilityRelayToken == null ? "" : livingFacilityRelayToken.trim();
        this.collectorEnabled = collectorEnabled;
        this.timeoutSeconds = timeoutSeconds;
        this.retryCount = Math.max(0, retryCount);
        this.retryDelaySeconds = Math.max(0, retryDelaySeconds);
        this.storePageSize = Math.max(1, storePageSize);
        this.storeMaxPages = Math.max(1, storeMaxPages);
        this.storePageDelayMillis = Math.max(0, storePageDelayMillis);
        this.allowInsecureSeoulHttp = allowInsecureSeoulHttp;
        this.httpClient = httpClient;
    }

    public boolean isCollectorEnabled() {
        return collectorEnabled;
    }

    private HttpClient httpClient() {
        HttpClient current = httpClient;
        if (current != null) {
            return current;
        }
        synchronized (this) {
            if (httpClient == null) {
                httpClient = HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(Math.max(timeoutSeconds, 5)))
                        .build();
            }
            return httpClient;
        }
    }

    public List<PublicDataRepository.CollectorSpec> specs() {
        return List.of(
                collectorSpec(STATS_STORE_KEY,  hasValue(dataGoKrApiKey)),
                collectorSpec(AIR_QUALITY_KEY,  hasValue(dataGoKrApiKey)),
                collectorSpec(BIKE_KEY,         true),
                collectorSpec(CCTV_KEY,         false),
                collectorSpec(PARKING_KEY,      hasValue(dataGoKrApiKey)),
                collectorSpec(POPULATION_KEY,   hasValue(dataGoKrApiKey)),
                // P4 신규
                collectorSpec(WIFI_KEY,         hasValue(wifiRelayToken)),
                collectorSpec(HEAT_SHELTER_KEY, false),
                collectorSpec(SCHOOL_ZONE_KEY,  hasValue(dataGoKrApiKey)),
                collectorSpec(EV_CHARGER_KEY,   true)
                , collectorSpec(WELFARE_KEY, hasValue(livingFacilityRelayToken))
                , collectorSpec(CIVIL_SHELTER_KEY, hasValue(livingFacilityRelayToken))
                , collectorSpec(HOSPITAL_KEY, hasValue(livingFacilityRelayToken))
                , collectorSpec(PHARMACY_KEY, hasValue(livingFacilityRelayToken))
                , collectorSpec(CHILDCARE_KEY, hasValue(livingFacilityRelayToken))
                // Phase 1 신규 — 안전·환경
                , collectorSpec(STREET_LIGHT_KEY, hasValue(dataGoKrApiKey))
                , collectorSpec(FIRE_HYDRANT_KEY, hasValue(dataGoKrApiKey))
                // Phase 1 신규 — 생활편의·문화
                , collectorSpec(MUSEUM_KEY, hasValue(dataGoKrApiKey))
                , collectorSpec(LIBRARY_KEY, hasValue(dataGoKrApiKey))
                , collectorSpec(PARK_KEY, hasValue(dataGoKrApiKey))
                // Phase 1 신규 — 산업·상권
                , collectorSpec(TRADITIONAL_MARKET_KEY, hasValue(dataGoKrApiKey))
                , collectorSpec(KNOWLEDGE_INDUSTRY_CENTER_KEY, hasValue(dataGoKrApiKey))
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
        DatasetOperationalPolicy policy = DatasetPolicyRegistry.getRequired(datasetKey);
        // Plain HTTP is never allowed in the main platform. Public Wi-Fi uses the
        // loopback relay; all direct external source URLs remain HTTPS-only.
        boolean localTransportOverride = false;
        // loggedRequestUrl·result 초기값을 선언해 catch 블록에서 null 없이 참조할 수 있게 한다.
        String loggedRequestUrl = "-";
        UUIDResult result = new UUIDResult(null);

        try {
            if (!policy.collectionEnabled() && !localTransportOverride) {
                UUID datasetId = repository.upsertDataset(spec);
                return finishSkipped(
                        spec,
                        startedAt,
                        "-",
                        "Collection disabled by approved transport security policy.",
                        triggeredBy,
                        datasetId
                );
            }
            String requestUrl = buildRequestUrl.get();
            loggedRequestUrl = maskRequestUrlForLog(requestUrl);
            result = new UUIDResult(repository.upsertDataset(spec));

            if (requiredApiKey == null || requiredApiKey.isBlank()) {
                return finishSkipped(spec, startedAt, loggedRequestUrl, apiKeyMissingMsg, triggeredBy, result.datasetId());
            }

            List<Map<String, String>> rows = fetchRows.fetch(requestUrl, spec.datasetName());
            if (rows.isEmpty()) {
                Instant finishedAt = Instant.now();
                String message = "API returned 0 rows. Existing snapshot preserved.";
                repository.recordCollectionLog(
                        result.datasetId(), "API", "FAILED",
                        startedAt, finishedAt, 0, 0, message, loggedRequestUrl, triggeredBy
                );
                return new CollectionRunResult(
                        spec.datasetKey(), "failed", 0, 0,
                        message, loggedRequestUrl, startedAt, finishedAt,
                        Duration.between(startedAt, finishedAt)
                );
            }
            Integer previousSuccessfulCount = repository.latestSuccessfulSourceCount(result.datasetId());
            // 2026-06 공식 XLSX 전환 전 값(127)은 금천구 bbox에 인접 자치구가 섞인 수치다.
            // 자치구 열을 직접 사용하는 최초 전환에만 과거 건수 비교를 생략하고, 이후부터는 다시 30% 게이트를 적용한다.
            if (BIKE_KEY.equals(datasetKey) && Integer.valueOf(127).equals(previousSuccessfulCount)) {
                previousSuccessfulCount = null;
            }
            if (localTransportOverride) {
                CollectionQualityGate.requireExpectedCountWithLocalTransportOverride(
                        policy, rows.size(), previousSuccessfulCount
                );
            } else {
                CollectionQualityGate.requireExpectedCount(
                        policy, rows.size(), previousSuccessfulCount
                );
            }
            int saved = saveRows.save(result.datasetId(), rows);
            Instant finishedAt = Instant.now();
            // 응답 행이 있는데 저장이 0건이면 필드 불일치로 기존 데이터가 보존됐지만 수집 자체는 실패다.
            if (!rows.isEmpty() && saved == 0) {
                String warnMsg = "API returned " + rows.size() + " row(s) but 0 were saved"
                        + " (field mismatch?). Existing snapshot preserved.";
                repository.recordCollectionLog(
                        result.datasetId(), "API", "FAILED",
                        startedAt, finishedAt, rows.size(), 0, warnMsg, loggedRequestUrl, triggeredBy
                );
                return new CollectionRunResult(
                        spec.datasetKey(), "failed", rows.size(), 0,
                        warnMsg, loggedRequestUrl, startedAt, finishedAt,
                        Duration.between(startedAt, finishedAt)
                );
            }
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
            results.add(runSafely(STATS_STORE_KEY, triggeredBy, () -> syncStores(triggeredBy)));
            results.add(runSafely(AIR_QUALITY_KEY, triggeredBy, () -> syncAirQuality(triggeredBy)));
            results.add(runSafely(BIKE_KEY, triggeredBy, () -> syncBikeStations(triggeredBy)));
            results.add(runSafely(CCTV_KEY, triggeredBy, () -> syncCctvStations(triggeredBy)));
            results.add(runSafely(PARKING_KEY, triggeredBy, () -> syncParkingLots(triggeredBy)));
            results.add(runSafely(POPULATION_KEY, triggeredBy, () -> syncPopulation(triggeredBy)));
            results.add(runSafely(WIFI_KEY, triggeredBy, () -> syncPublicWifi(triggeredBy)));
            results.add(runSafely(HEAT_SHELTER_KEY, triggeredBy, () -> syncHeatShelters(triggeredBy)));
            results.add(runSafely(SCHOOL_ZONE_KEY, triggeredBy, () -> syncSchoolZones(triggeredBy)));
            results.add(runSafely(EV_CHARGER_KEY, triggeredBy, () -> syncEvChargers(triggeredBy)));
            results.add(runSafely(WELFARE_KEY, triggeredBy, () -> syncLivingFacility(WELFARE_KEY, "WELFARE", triggeredBy)));
            results.add(runSafely(CIVIL_SHELTER_KEY, triggeredBy, () -> syncLivingFacility(CIVIL_SHELTER_KEY, "CIVIL_DEFENSE_SHELTER", triggeredBy)));
            results.add(runSafely(HOSPITAL_KEY, triggeredBy, () -> syncLivingFacility(HOSPITAL_KEY, "HOSPITAL", triggeredBy)));
            results.add(runSafely(PHARMACY_KEY, triggeredBy, () -> syncLivingFacility(PHARMACY_KEY, "PHARMACY", triggeredBy)));
            results.add(runSafely(CHILDCARE_KEY, triggeredBy, () -> syncLivingFacility(CHILDCARE_KEY, "CHILDCARE", triggeredBy)));
            // Phase 1 신규 — 안전·환경
            results.add(runSafely(STREET_LIGHT_KEY, triggeredBy, () -> syncStreetLights(triggeredBy)));
            results.add(runSafely(FIRE_HYDRANT_KEY, triggeredBy, () -> syncFireHydrants(triggeredBy)));
            // Phase 1 신규 — 생활편의·문화
            results.add(runSafely(MUSEUM_KEY, triggeredBy, () -> syncMuseums(triggeredBy)));
            results.add(runSafely(LIBRARY_KEY, triggeredBy, () -> syncLibraries(triggeredBy)));
            results.add(runSafely(PARK_KEY, triggeredBy, () -> syncParks(triggeredBy)));
            // Phase 1 신규 — 산업·상권
            results.add(runSafely(TRADITIONAL_MARKET_KEY, triggeredBy, () -> syncTraditionalMarkets(triggeredBy)));
            results.add(runSafely(KNOWLEDGE_INDUSTRY_CENTER_KEY, triggeredBy, () -> syncKnowledgeIndustryCenters(triggeredBy)));
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
        if ("소스 미확정".equals(spec.apiStatus())) {
            return unconfirmedSourceResult(spec);
        }
        if (!beginCollectorRun()) {
            return busyResult(spec, triggeredBy);
        }

        try {
            return switch (datasetKey) {
                case STATS_STORE_KEY  -> syncStores(triggeredBy);
                case AIR_QUALITY_KEY  -> syncAirQuality(triggeredBy);
                case BIKE_KEY         -> syncBikeStations(triggeredBy);
                case CCTV_KEY         -> syncCctvStations(triggeredBy);
                case PARKING_KEY      -> syncParkingLots(triggeredBy);
                case POPULATION_KEY   -> syncPopulation(triggeredBy);
                case WIFI_KEY         -> syncPublicWifi(triggeredBy);
                case HEAT_SHELTER_KEY -> syncHeatShelters(triggeredBy);
                case SCHOOL_ZONE_KEY  -> syncSchoolZones(triggeredBy);
                case EV_CHARGER_KEY   -> syncEvChargers(triggeredBy);
                case WELFARE_KEY      -> syncLivingFacility(WELFARE_KEY, "WELFARE", triggeredBy);
                case CIVIL_SHELTER_KEY -> syncLivingFacility(CIVIL_SHELTER_KEY, "CIVIL_DEFENSE_SHELTER", triggeredBy);
                case HOSPITAL_KEY     -> syncLivingFacility(HOSPITAL_KEY, "HOSPITAL", triggeredBy);
                case PHARMACY_KEY     -> syncLivingFacility(PHARMACY_KEY, "PHARMACY", triggeredBy);
                case CHILDCARE_KEY    -> syncLivingFacility(CHILDCARE_KEY, "CHILDCARE", triggeredBy);
                // Phase 1 신규 — 안전·환경
                case STREET_LIGHT_KEY -> syncStreetLights(triggeredBy);
                case FIRE_HYDRANT_KEY -> syncFireHydrants(triggeredBy);
                // Phase 1 신규 — 생활편의·문화
                case MUSEUM_KEY  -> syncMuseums(triggeredBy);
                case LIBRARY_KEY -> syncLibraries(triggeredBy);
                case PARK_KEY -> syncParks(triggeredBy);
                // Phase 1 신규 — 산업·상권
                case TRADITIONAL_MARKET_KEY -> syncTraditionalMarkets(triggeredBy);
                case KNOWLEDGE_INDUSTRY_CENTER_KEY -> syncKnowledgeIndustryCenters(triggeredBy);
                default               -> missingRoutineResult(spec);
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
                AIR_QUALITY_KEY, dataGoKrApiKey, "DATA_GO_KR_API_KEY is missing.",
                this::buildAirQualityRequestUrl,
                this::fetchAirQualityRowsWithStation,
                repository::replaceAirQualitySnapshot,
                saved -> "Saved " + saved + " air quality record(s).",
                triggeredBy);
    }

    public CollectionRunResult syncBikeStations(String triggeredBy) {
        return runSyncPipeline(
                BIKE_KEY, "official-https-file", "Official HTTPS file source is unavailable.",
                () -> BIKE_DATASET_PAGE_URL,
                (url, name) -> fetchBikeRowsFromOfficialFile(),
                (id, rows) -> repository.replaceFacilitySnapshot(id, "BIKE", rows),
                saved -> "Saved " + saved + " bike station(s).",
                triggeredBy);
    }

    private List<Map<String, String>> fetchBikeRowsFromOfficialFile() throws Exception {
        HttpRequest pageRequest = HttpRequest.newBuilder(URI.create(BIKE_DATASET_PAGE_URL))
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .GET()
                .build();
        HttpResponse<String> pageResponse = httpClient().send(
                pageRequest,
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
        );
        requireSuccessStatus(pageResponse.statusCode(), "bike-stations dataset page");

        Matcher matcher = BIKE_FILE_SEQUENCE_PATTERN.matcher(pageResponse.body());
        if (!matcher.find()) {
            throw new IllegalStateException("Latest official bike-stations XLSX link was not found.");
        }
        String sequence = matcher.group(1);
        String form = "infId=OA-13252&seqNo=&seq=" + URLEncoder.encode(sequence, StandardCharsets.UTF_8)
                + "&infSeq=2";
        HttpRequest fileRequest = HttpRequest.newBuilder(URI.create(SEOUL_FILE_DOWNLOAD_URL))
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form))
                .build();
        HttpResponse<byte[]> fileResponse = httpClient().send(fileRequest, HttpResponse.BodyHandlers.ofByteArray());
        requireSuccessStatus(fileResponse.statusCode(), "bike-stations XLSX download");
        return parseGeumcheonBikeWorkbook(fileResponse.body());
    }

    private List<Map<String, String>> parseGeumcheonBikeWorkbook(byte[] content) throws IOException {
        if (content == null || content.length == 0) {
            throw new IllegalStateException("Official bike-stations XLSX was empty.");
        }
        List<Map<String, String>> rows = new ArrayList<>();
        DataFormatter formatter = new DataFormatter();
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(content))) {
            Sheet sheet = workbook.getSheetAt(0);
            for (int rowIndex = 5; rowIndex <= sheet.getLastRowNum(); rowIndex += 1) {
                Row row = sheet.getRow(rowIndex);
                if (row == null || !"금천구".equals(cellText(row, 2, formatter))) {
                    continue;
                }
                Map<String, String> item = new LinkedHashMap<>();
                item.put("stationId", cellText(row, 0, formatter));
                item.put("stationName", cellText(row, 1, formatter));
                item.put("district", cellText(row, 2, formatter));
                item.put("addr", cellText(row, 3, formatter));
                item.put("stationLatitude", numericCellText(row, 4, formatter));
                item.put("stationLongitude", numericCellText(row, 5, formatter));
                item.put("rackTotCnt", Integer.toString(
                        integerCellValue(row, 7, formatter) + integerCellValue(row, 8, formatter)
                ));
                item.put("lcdRackCount", cellText(row, 7, formatter));
                item.put("qrRackCount", cellText(row, 8, formatter));
                item.put("operationType", cellText(row, 9, formatter));
                rows.add(item);
            }
        }
        return rows;
    }

    private String cellText(Row row, int index, DataFormatter formatter) {
        Cell cell = row.getCell(index, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        return cell == null ? "" : formatter.formatCellValue(cell).trim();
    }

    private String numericCellText(Row row, int index, DataFormatter formatter) {
        Cell cell = row.getCell(index, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) {
            return "";
        }
        if (cell.getCellType() == org.apache.poi.ss.usermodel.CellType.NUMERIC) {
            return Double.toString(cell.getNumericCellValue());
        }
        return formatter.formatCellValue(cell).trim();
    }

    private int integerCellValue(Row row, int index, DataFormatter formatter) {
        String value = cellText(row, index, formatter).replace(",", "");
        if (value.isBlank()) {
            return 0;
        }
        try {
            return (int) Double.parseDouble(value);
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private void requireSuccessStatus(int statusCode, String sourceName) {
        if (statusCode < 200 || statusCode >= 300) {
            throw new IllegalStateException(sourceName + " returned HTTP " + statusCode + ".");
        }
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
        return seoulOpenApiBaseUrl()
                + normalizeKeyValue(seoulOpenApiKey)
                + "/json/TB_GC_VVTV_INFO_ID01/1/400/";
    }

    public CollectionRunResult syncParkingLots(String triggeredBy) {
        return runSyncPipeline(
                PARKING_KEY, dataGoKrApiKey, "DATA_GO_KR_API_KEY is missing.",
                this::buildParkingRequestUrl,
                this::fetchRowsWithRetry,
                (id, rows) -> repository.replaceFacilitySnapshot(id, "PARKING", rows),
                saved -> "Saved " + saved + " parking lot(s).",
                triggeredBy);
    }

    private String buildParkingRequestUrl() {
        return "https://api.data.go.kr/openapi/tn_pubr_prkplce_info_api"
                + "?serviceKey=" + normalizeKeyValue(dataGoKrApiKey)
                + "&pageNo=1"
                + "&numOfRows=1000"
                + "&type=json"
                + "&instt_nm=" + URLEncoder.encode("서울특별시 금천구", StandardCharsets.UTF_8);
    }

    // ─── P4 신규 POINT 시설 수집 ───────────────────────────────────────────────────

    /** 서울 열린데이터광장 공통 URL 패턴. serviceId·start·end만 교체. */
    private String buildSeoulOpenUrl(String serviceId, int start, int end) {
        return seoulOpenApiBaseUrl()
                + normalizeKeyValue(seoulOpenApiKey)
                + "/json/" + serviceId + "/" + start + "/" + end + "/";
    }

    /**
     * 서울 열린데이터광장 API를 페이지 순회하며 금천구 bbox 내 행만 수집한다.
     * 위경도 필드는 데이터셋마다 다르므로 후보 키 목록을 순서대로 시도한다.
     * bbox: 위도 37.43~37.50, 경도 126.87~126.92 (기존 BIKE/PARKING 필터와 동일)
     *
     * @param serviceId  열린데이터광장 서비스 ID
     * @param pageSize   페이지당 행 수
     * @param latKeys    위도 필드명 후보 목록 (순서대로 시도)
     * @param lonKeys    경도 필드명 후보 목록 (순서대로 시도)
     */
    private List<Map<String, String>> fetchSeoulBboxFiltered(
            String serviceId, int pageSize, String[] latKeys, String[] lonKeys
    ) throws Exception {
        List<Map<String, String>> all = new ArrayList<>();
        int pageNo = 1;
        while (true) {
            int start = (pageNo - 1) * pageSize + 1;
            int end = pageNo * pageSize;
            JsonNode root = executeJsonWithRetry(buildSeoulOpenUrl(serviceId, start, end), serviceId + " page " + pageNo);
            List<Map<String, String>> page = extractRows(root);
            if (page.isEmpty()) {
                break;
            }
            for (Map<String, String> row : page) {
                String latStr = firstNonBlank(row, latKeys);
                String lonStr = firstNonBlank(row, lonKeys);
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

    /** 후보 키 목록 중 값이 있는 첫 번째 값을 반환한다. */
    private static String firstNonBlank(Map<String, String> row, String[] keys) {
        for (String key : keys) {
            String v = row.get(key);
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    public CollectionRunResult syncPublicWifi(String triggeredBy) {
        // 서비스 ID: TbPublicWifiInfo (서울 열린데이터광장 — 서울시 공공와이파이 위치정보)
        // 필드: X_SWIFI_MAIN_NM(설치장소), INSTL_FLOR_INFO(설치위치), LAT, LNT
        return runSyncPipeline(
                WIFI_KEY, wifiRelayToken, "WIFI_RELAY_TOKEN is missing.",
                this::buildWifiRelayRequestUrl,
                this::fetchWifiRelayRows,
                (id, rows) -> repository.replaceFacilitySnapshot(id, "WIFI", rows),
                saved -> "Saved " + saved + " public WiFi access point(s).",
                triggeredBy);
    }

    private String buildWifiRelayRequestUrl() {
        return URI.create(wifiRelayBaseUrl + "/").resolve("/v1/public-wifi").toString();
    }

    private List<Map<String, String>> fetchWifiRelayRows(String requestUrl, String datasetName) throws Exception {
        JsonNode root = executeWifiRelayJsonWithRetry(requestUrl, datasetName);
        if (!"SUCCESS".equals(root.path("status").asText())) {
            throw new IllegalStateException("WiFi relay returned a non-success status.");
        }
        List<Map<String, String>> rows = extractRows(root);
        if (rows.isEmpty()) {
            throw new IllegalStateException("WiFi relay returned 0 validated rows.");
        }
        Set<String> identifiers = new java.util.HashSet<>();
        for (Map<String, String> row : rows) {
            String identifier = row.get("X_SWIFI_WRDNFC_NO");
            String name = row.get("X_SWIFI_MAIN_NM");
            String lat = row.get("LAT");
            String lon = row.get("LNT");
            if (!"TbPublicWifiInfo_GC".equals(row.get("sourceService"))
                    || !"금천구".equals(row.get("district"))
                    || !hasValue(identifier) || !hasValue(name) || !hasValue(lat) || !hasValue(lon)) {
                throw new IllegalStateException("WiFi relay row contract validation failed.");
            }
            if (!identifiers.add(identifier)) {
                throw new IllegalStateException("WiFi relay returned a duplicate identifier.");
            }
            try {
                double latitude = Double.parseDouble(lat);
                double longitude = Double.parseDouble(lon);
                if (latitude < 37.42 || latitude > 37.51 || longitude < 126.85 || longitude > 126.93) {
                    throw new IllegalStateException("WiFi relay returned an out-of-range coordinate.");
                }
            } catch (NumberFormatException error) {
                throw new IllegalStateException("WiFi relay returned an invalid coordinate.", error);
            }
        }
        return rows;
    }

    private JsonNode executeWifiRelayJsonWithRetry(String requestUrl, String datasetName) throws Exception {
        return executeRelayJsonWithRetry(requestUrl, datasetName, wifiRelayToken, "WiFi");
    }

    private JsonNode executeRelayJsonWithRetry(
            String requestUrl, String datasetName, String relayToken, String relayName
    ) throws Exception {
        // The living-facility relay already owns upstream retry/backoff. Retrying
        // again here would multiply calls and exceed the main platform timeout.
        int attempts = "Living facility".equals(relayName) ? 1 : Math.max(1, retryCount + 1);
        Exception lastError = null;
        for (int attempt = 1; attempt <= attempts; attempt += 1) {
            try {
                HttpRequest request = HttpRequest.newBuilder(URI.create(requestUrl))
                        .timeout(Duration.ofSeconds(timeoutSeconds))
                        .header("Accept", "application/json")
                        .header("X-Relay-Token", relayToken)
                        .GET()
                        .build();
                HttpResponse<String> response = httpClient().send(
                        request,
                        HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
                );
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    throw new IllegalStateException(relayName + " relay failed: " + relayErrorCode(response.body()) + ".");
                }
                return objectMapper.readTree(response.body());
            } catch (Exception error) {
                lastError = error;
                if (attempt >= attempts) {
                    break;
                }
                logRetry(attempt, attempts, datasetName, error);
                sleepBeforeRetry();
            }
        }
        throw lastError == null ? new IllegalStateException(relayName + " relay request failed.") : lastError;
    }

    private String relayErrorCode(String responseBody) {
        Set<String> allowedCodes = Set.of(
                "TIMEOUT", "CONNECTION_REFUSED", "NETWORK_ERROR", "UPSTREAM_HTTP_STATUS",
                "UPSTREAM_CONTRACT", "UPSTREAM_UNAVAILABLE", "QUALITY_GATE", "RATE_LIMITED",
                "UNAUTHORIZED", "CONFIGURATION_ERROR", "INTERNAL_ERROR"
                , "SERVICE_NOT_ALLOWED"
        );
        try {
            String code = objectMapper.readTree(responseBody).path("errorCode").asText("");
            return allowedCodes.contains(code) ? code : "UPSTREAM_UNAVAILABLE";
        } catch (Exception ignored) {
            return "UPSTREAM_UNAVAILABLE";
        }
    }

    public CollectionRunResult syncLivingFacility(String datasetKey, String category, String triggeredBy) {
        String serviceId = LIVING_FACILITY_SERVICES.get(datasetKey);
        if (serviceId == null) {
            throw new IllegalArgumentException("Unsupported living facility dataset: " + datasetKey);
        }
        return runSyncPipeline(
                datasetKey, livingFacilityRelayToken, "LIVING_FACILITY_RELAY_TOKEN is missing.",
                () -> livingFacilityRelayBaseUrl + "/v1/facilities?service="
                        + URLEncoder.encode(serviceId, StandardCharsets.UTF_8),
                (url, name) -> fetchLivingFacilityRows(url, name, serviceId),
                (id, rows) -> repository.replaceFacilitySnapshot(id, category, rows),
                saved -> "Saved " + saved + " validated living facility record(s).",
                triggeredBy
        );
    }

    private List<Map<String, String>> fetchLivingFacilityRows(
            String requestUrl, String datasetName, String serviceId
    ) throws Exception {
        JsonNode root = executeRelayJsonWithRetry(
                requestUrl, datasetName, livingFacilityRelayToken, "Living facility"
        );
        if (!"SUCCESS".equals(root.path("status").asText())
                || !serviceId.equals(root.path("sourceService").asText())) {
            throw new IllegalStateException("Living facility relay contract validation failed.");
        }
        List<Map<String, String>> sourceRows = extractRows(root);
        if (sourceRows.isEmpty()) {
            throw new IllegalStateException("Living facility relay returned 0 validated rows.");
        }
        Set<String> identifiers = new java.util.HashSet<>();
        List<Map<String, String>> normalized = new ArrayList<>();
        for (Map<String, String> source : sourceRows) {
            if (!serviceId.equals(source.get("sourceService"))
                    || !"금천구".equals(source.get("district"))) {
                throw new IllegalStateException("Living facility relay row source validation failed.");
            }
            Map<String, String> row = normalizeLivingFacilityRow(serviceId, source);
            String identifier = row.get("sourceOriginalId");
            if (!hasValue(identifier) || !hasValue(row.get("name")) || !hasValue(row.get("address"))) {
                throw new IllegalStateException("Living facility relay row required fields are missing.");
            }
            if (!identifiers.add(identifier)) {
                throw new IllegalStateException("Living facility relay returned a duplicate identifier.");
            }
            validateOptionalLivingFacilityCoordinates(row);
            normalized.add(row);
        }
        return normalized;
    }

    private Map<String, String> normalizeLivingFacilityRow(String serviceId, Map<String, String> source) {
        Map<String, String> row = new LinkedHashMap<>(source);
        row.put("sourceOriginalId", source.getOrDefault("sourceOriginalId", ""));
        switch (serviceId) {
            case "fcltOpenInfo_GC" -> {
                row.put("name", firstNonBlank(source, new String[]{"FCLT_NM"}));
                row.put("address", firstNonBlank(source, new String[]{"FCLT_ADDR"}));
                row.put("description", firstNonBlank(source, new String[]{"FCLT_KIND_NM", "FCLT_TY_NM"}));
            }
            case "LOCALDATA_114602_GC" -> {
                row.put("name", firstNonBlank(source, new String[]{"BPLC_NM"}));
                row.put("address", firstNonBlank(source, new String[]{"ROAD_NM_ADDR", "LOTNO_ADDR"}));
                row.put("description", firstNonBlank(source, new String[]{"SALS_STTS_NM"}));
            }
            case "LOCALDATA_010101_GC", "LOCALDATA_010106_GC" -> {
                row.put("name", firstNonBlank(source, new String[]{"BPLCNM"}));
                row.put("address", firstNonBlank(source, new String[]{"RDNWHLADDR", "SITEWHLADDR"}));
                row.put("description", firstNonBlank(source, new String[]{"TRDSTATENM", "DTLSTATENM"}));
            }
            case "ChildCareInfoGC" -> {
                row.put("name", firstNonBlank(source, new String[]{"CRNAME"}));
                row.put("address", firstNonBlank(source, new String[]{"CRADDR"}));
                row.put("description", firstNonBlank(source, new String[]{"CRTYPENAME"}));
            }
            default -> throw new IllegalArgumentException("Unsupported relay service.");
        }
        row.values().removeIf(java.util.Objects::isNull);
        return row;
    }

    private void validateOptionalLivingFacilityCoordinates(Map<String, String> row) {
        String lat = row.get("LAT");
        String lon = row.get("LNG");
        if (!hasValue(lat) && !hasValue(lon)) return;
        if (!hasValue(lat) || !hasValue(lon)) {
            throw new IllegalStateException("Living facility relay returned an incomplete coordinate pair.");
        }
        try {
            double latitude = Double.parseDouble(lat);
            double longitude = Double.parseDouble(lon);
            if (latitude < 37.42 || latitude > 37.51 || longitude < 126.85 || longitude > 126.93) {
                throw new IllegalStateException("Living facility relay returned an out-of-range coordinate.");
            }
        } catch (NumberFormatException error) {
            throw new IllegalStateException("Living facility relay returned an invalid coordinate.", error);
        }
    }

    public CollectionRunResult syncHeatShelters(String triggeredBy) {
        return runSyncPipeline(
                HEAT_SHELTER_KEY, "", "SAFETY_DATA_API_KEY is missing.",
                () -> "-",
                (url, name) -> List.of(),
                (id, rows) -> 0,
                saved -> "Saved " + saved + " heat shelter(s).",
                triggeredBy
        );
    }

    public CollectionRunResult syncSchoolZones(String triggeredBy) {
        return runSyncPipeline(
                SCHOOL_ZONE_KEY, dataGoKrApiKey, "DATA_GO_KR_API_KEY is missing.",
                this::buildSchoolZoneRequestUrl,
                this::fetchSchoolZoneRows,
                (id, rows) -> repository.replaceFacilitySnapshot(id, "SCHOOL_ZONE", rows),
                saved -> "Saved " + saved + " school zone(s).",
                triggeredBy);
    }

    public CollectionRunResult syncEvChargers(String triggeredBy) {
        return runSyncPipeline(
                EV_CHARGER_KEY, "official-https-file", "Official HTTPS file source is unavailable.",
                () -> EV_DATASET_PAGE_URL,
                (url, name) -> fetchEvRowsFromOfficialFile(),
                (id, rows) -> repository.replaceFacilitySnapshot(id, "EV_CHARGER", rows),
                saved -> "Saved " + saved + " EV charger(s).",
                triggeredBy);
    }

    // ─── 보안등 (data.go.kr 표준데이터 API, 좌표 포함) ──────────────

    public CollectionRunResult syncStreetLights(String triggeredBy) {
        return runSyncPipeline(
                STREET_LIGHT_KEY, dataGoKrApiKey, "DATA_GO_KR_API_KEY가 설정되지 않았습니다.",
                this::buildStreetLightRequestUrl,
                this::fetchStreetLightRows,
                (id, rows) -> repository.replaceFacilitySnapshot(id, "STREET_LIGHT", rows),
                saved -> "보안등 " + saved + "건 저장 완료.",
                triggeredBy);
    }

    private String buildStreetLightRequestUrl() {
        return "https://api.data.go.kr/openapi/tn_pubr_public_scrty_lmp_api"
                + "?serviceKey=" + normalizeKeyValue(dataGoKrApiKey)
                + "&pageNo=1&numOfRows=1000&type=json";
    }

    private List<Map<String, String>> fetchStreetLightRows(String requestUrl, String datasetName) throws Exception {
        // insttNm: "서울특별시 금천구" 형식 또는 rdnmadr 기준 금천구 필터
        return fetchRowsWithRetry(requestUrl, datasetName).stream()
                .filter(row -> containsGeumcheon(firstNonBlankIgnoreCase(
                        row, "insttNm", "rdnmadr", "lnmadr"
                )))
                .toList();
    }

    // ─── 소방용수시설 (data.go.kr 표준데이터 API, 좌표 포함) ──────────────

    public CollectionRunResult syncFireHydrants(String triggeredBy) {
        return runSyncPipeline(
                FIRE_HYDRANT_KEY, dataGoKrApiKey, "DATA_GO_KR_API_KEY가 설정되지 않았습니다.",
                this::buildFireHydrantRequestUrl,
                this::fetchFireHydrantRows,
                (id, rows) -> repository.replaceFacilitySnapshot(id, "FIRE_HYDRANT", rows),
                saved -> "소방용수시설 " + saved + "건 저장 완료.",
                triggeredBy);
    }

    private String buildFireHydrantRequestUrl() {
        return "https://api.data.go.kr/openapi/tn_pubr_public_ffus_wtrcns_api"
                + "?serviceKey=" + normalizeKeyValue(dataGoKrApiKey)
                + "&pageNo=1&numOfRows=1000&type=json";
    }

    private List<Map<String, String>> fetchFireHydrantRows(String requestUrl, String datasetName) throws Exception {
        // signguNm 필드: "금천구" 직접 포함 — rdnmadr 보조 확인
        return fetchRowsWithRetry(requestUrl, datasetName).stream()
                .filter(row -> containsGeumcheon(firstNonBlankIgnoreCase(
                        row, "signguNm", "rdnmadr", "lnmadr"
                )))
                .toList();
    }

    // ─── 박물관·미술관 (data.go.kr 표준데이터 API, 좌표 포함) ──────────────

    public CollectionRunResult syncMuseums(String triggeredBy) {
        return runSyncPipeline(
                MUSEUM_KEY, dataGoKrApiKey, "DATA_GO_KR_API_KEY가 설정되지 않았습니다.",
                this::buildMuseumRequestUrl,
                this::fetchMuseumRows,
                (id, rows) -> repository.replaceFacilitySnapshot(id, "MUSEUM", rows),
                saved -> "박물관·미술관 " + saved + "건 저장 완료.",
                triggeredBy);
    }

    private String buildMuseumRequestUrl() {
        return "https://api.data.go.kr/openapi/tn_pubr_public_museum_artgr_info_api"
                + "?serviceKey=" + normalizeKeyValue(dataGoKrApiKey)
                + "&pageNo=1&numOfRows=1000&type=json";
    }

    private List<Map<String, String>> fetchMuseumRows(String requestUrl, String datasetName) throws Exception {
        // insttNm 필드: "서울특별시 금천구" 형식으로 시군구 포함 — 금천구 필터 기준
        return fetchRowsWithRetry(requestUrl, datasetName).stream()
                .filter(row -> containsGeumcheon(firstNonBlankIgnoreCase(
                        row, "rdnmadr", "lnmadr", "insttNm", "fcltyNm"
                )))
                .toList();
    }

    // ─── 도서관 (data.go.kr 표준데이터 API, 좌표 포함, 자동승인) ──────────────

    public CollectionRunResult syncLibraries(String triggeredBy) {
        return runSyncPipeline(
                LIBRARY_KEY, dataGoKrApiKey, "DATA_GO_KR_API_KEY가 설정되지 않았습니다.",
                this::buildLibraryRequestUrl,
                this::fetchLibraryRows,
                (id, rows) -> repository.replaceFacilitySnapshot(id, "LIBRARY", rows),
                saved -> "도서관 " + saved + "건 저장 완료.",
                triggeredBy);
    }

    private String buildLibraryRequestUrl() {
        return "https://api.data.go.kr/openapi/tn_pubr_public_lbrry_api"
                + "?serviceKey=" + normalizeKeyValue(dataGoKrApiKey)
                + "&pageNo=1&numOfRows=1000&type=json";
    }

    private List<Map<String, String>> fetchLibraryRows(String requestUrl, String datasetName) throws Exception {
        return fetchRowsWithRetry(requestUrl, datasetName).stream()
                .filter(row -> containsGeumcheon(firstNonBlankIgnoreCase(
                        row, "RDNMADR", "LNMADR", "LBRRY_NM"
                )))
                .toList();
    }

    // ─── 도시공원 (data.go.kr 표준데이터 API, 좌표 포함, 자동승인) ──────────────

    public CollectionRunResult syncParks(String triggeredBy) {
        return runSyncPipeline(
                PARK_KEY, dataGoKrApiKey, "DATA_GO_KR_API_KEY가 설정되지 않았습니다.",
                this::buildParkRequestUrl,
                this::fetchParkRows,
                (id, rows) -> repository.replaceFacilitySnapshot(id, "PARK", rows),
                saved -> "도시공원 " + saved + "건 저장 완료.",
                triggeredBy);
    }

    private String buildParkRequestUrl() {
        return "https://api.data.go.kr/openapi/tn_pubr_public_cty_park_info_api"
                + "?serviceKey=" + normalizeKeyValue(dataGoKrApiKey)
                + "&pageNo=1&numOfRows=1000&type=json";
    }

    private List<Map<String, String>> fetchParkRows(String requestUrl, String datasetName) throws Exception {
        return fetchRowsWithRetry(requestUrl, datasetName).stream()
                .filter(row -> containsGeumcheon(firstNonBlankIgnoreCase(
                        row, "RDNMADR", "LNMADR", "PARK_NM"
                )))
                .toList();
    }

    // ─── 전통시장 (data.go.kr 표준데이터 API, 좌표 포함) ─────────────────────────

    public CollectionRunResult syncTraditionalMarkets(String triggeredBy) {
        return runSyncPipeline(
                TRADITIONAL_MARKET_KEY, dataGoKrApiKey, "DATA_GO_KR_API_KEY가 설정되지 않았습니다.",
                this::buildTraditionalMarketRequestUrl,
                this::fetchTraditionalMarketRows,
                (id, rows) -> repository.replaceFacilitySnapshot(id, "TRADITIONAL_MARKET", rows),
                saved -> "전통시장 " + saved + "건 저장 완료.",
                triggeredBy);
    }

    private String buildTraditionalMarketRequestUrl() {
        return "https://api.data.go.kr/openapi/tn_pubr_public_trdit_mrkt_api"
                + "?serviceKey=" + normalizeKeyValue(dataGoKrApiKey)
                + "&pageNo=1&numOfRows=1000&type=json";
    }

    private List<Map<String, String>> fetchTraditionalMarketRows(String requestUrl, String datasetName) throws Exception {
        return fetchRowsWithRetry(requestUrl, datasetName).stream()
                .filter(row -> containsGeumcheon(firstNonBlankIgnoreCase(
                        row, "rdnmadr", "lnmadr", "mrktNm"
                )))
                .toList();
    }

    // ─── 지식산업센터 (odcloud API + VWorld 지오코딩) ────────────────────────────

    public CollectionRunResult syncKnowledgeIndustryCenters(String triggeredBy) {
        return runSyncPipeline(
                KNOWLEDGE_INDUSTRY_CENTER_KEY, dataGoKrApiKey, "DATA_GO_KR_API_KEY가 설정되지 않았습니다.",
                this::buildKnowledgeIndustryCenterRequestUrl,
                this::fetchKnowledgeIndustryCenterRows,
                (id, rows) -> repository.replaceFacilitySnapshot(id, "KNOWLEDGE_INDUSTRY_CENTER", rows),
                saved -> "지식산업센터 " + saved + "건 저장 완료.",
                triggeredBy);
    }

    private String buildKnowledgeIndustryCenterRequestUrl() {
        // totalCount 1,549건이므로 perPage=2000으로 단일 요청 처리
        return KNOWLEDGE_INDUSTRY_CENTER_URL
                + "?serviceKey=" + normalizeKeyValue(dataGoKrApiKey)
                + "&page=1&perPage=2000&returnType=JSON";
    }

    private List<Map<String, String>> fetchKnowledgeIndustryCenterRows(String requestUrl, String datasetName) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(requestUrl))
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .header("Accept", "application/json")
                .GET()
                .build();
        HttpResponse<String> response = httpClient().send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        requireSuccessStatus(response.statusCode(), datasetName);
        JsonNode root = objectMapper.readTree(response.body());
        JsonNode data = root.path("data");
        if (!data.isArray()) return List.of();
        List<Map<String, String>> rows = new ArrayList<>();
        for (JsonNode item : data) {
            if (!"서울특별시".equals(textOfNode(item, "시도"))
                    || !"금천구".equals(textOfNode(item, "시군구"))) continue;
            String name = textOfNode(item, "지식산업센터명");
            if (name.isBlank()) continue;
            String addressRoad = textOfNode(item, "공장대표주소(도로명)");
            String addressLot  = textOfNode(item, "공장대표주소(지번)");
            String addr = addressRoad.isBlank() ? addressLot : addressRoad;
            Map<String, String> row = new LinkedHashMap<>();
            row.put("STAT_NM",    name);
            row.put("ADDR",       addr);
            row.put("입지구분",   textOfNode(item, "입지구분"));
            row.put("단지명",     textOfNode(item, "단지명"));
            row.put("상태",       textOfNode(item, "상태"));
            row.put("건축연면적", textOfNode(item, "건축면적(제곱미터)"));
            row.put("설치자",     textOfNode(item, "설치자"));
            row.put("source",     "공공데이터포털 한국산업단지공단 전국지식산업센터현황");
            // VWorld 지오코딩: 도로명 우선, 실패 시 지번 재시도
            String[] coords = geocodeAddress(
                    addressRoad.isBlank() ? null : addressRoad,
                    addressLot.isBlank()  ? null : addressLot);
            if (coords != null) {
                row.put("LAT", coords[0]);
                row.put("LNG", coords[1]);
            }
            rows.add(row);
        }
        return rows;
    }

    /** JsonNode에서 문자열 값을 안전하게 추출한다. */
    private String textOfNode(JsonNode node, String key) {
        JsonNode val = node.get(key);
        return (val == null || val.isNull()) ? "" : val.asText().trim();
    }

    /**
     * VWorld Geocoder 2.0으로 도로명→지번 순서로 좌표 변환.
     * 키 미설정·변환 실패 시 null 반환(좌표 없이 저장).
     *
     * @return [위도(y), 경도(x)] 또는 null
     */
    private String[] geocodeAddress(String roadAddress, String lotAddress) {
        if (vworldApiKey == null || vworldApiKey.isBlank()) return null;
        String[] result = geocodeWithType(roadAddress, "ROAD");
        if (result != null) return result;
        return geocodeWithType(lotAddress, "PARCEL");
    }

    private String[] geocodeWithType(String address, String type) {
        if (address == null || address.isBlank()) return null;
        try {
            String encoded = URLEncoder.encode(address, StandardCharsets.UTF_8);
            URI uri = URI.create(
                    "https://api.vworld.kr/req/address"
                    + "?service=address&request=getCoord&version=2.0"
                    + "&crs=EPSG:4326&type=" + type
                    + "&address=" + encoded
                    + "&format=json&key=" + vworldApiKey);
            HttpRequest req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    .GET().build();
            HttpResponse<String> resp = httpClient().send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (resp.statusCode() != 200) return null;
            JsonNode root = objectMapper.readTree(resp.body());
            if (!"OK".equals(root.path("response").path("status").asText())) return null;
            JsonNode point = root.path("response").path("result").path("point");
            String x = point.path("x").asText(); // 경도(LNG)
            String y = point.path("y").asText(); // 위도(LAT)
            if (x.isBlank() || y.isBlank() || "null".equalsIgnoreCase(x)) return null;
            return new String[]{y, x};
        } catch (Exception e) {
            log.warn("[지식산업센터] VWorld 지오코딩 실패 — type={}, address={}: {}", type, address, e.getMessage());
            return null;
        }
    }

    private String buildSchoolZoneRequestUrl() {
        return "https://api.data.go.kr/openapi/tn_pubr_public_child_prtc_zn_api"
                + "?serviceKey=" + normalizeKeyValue(dataGoKrApiKey)
                + "&pageNo=1&numOfRows=1000&type=json"
                + "&instt_code=3170000";
    }

    private List<Map<String, String>> fetchSchoolZoneRows(String requestUrl, String datasetName) throws Exception {
        return fetchRowsWithRetry(requestUrl, datasetName).stream()
                .filter(row -> containsGeumcheon(firstNonBlankIgnoreCase(
                        row, "INSTITUTION_NM", "RDNMADR", "LNMADR"
                )))
                .toList();
    }

    private List<Map<String, String>> fetchEvRowsFromOfficialFile() throws Exception {
        HttpRequest pageRequest = HttpRequest.newBuilder(URI.create(EV_DATASET_PAGE_URL))
                .timeout(Duration.ofSeconds(timeoutSeconds)).GET().build();
        HttpResponse<String> pageResponse = httpClient().send(
                pageRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
        );
        requireSuccessStatus(pageResponse.statusCode(), "ev-chargers dataset page");
        Matcher matcher = EV_FILE_SEQUENCE_PATTERN.matcher(pageResponse.body());
        if (!matcher.find()) throw new IllegalStateException("Latest official EV charger XLSX link was not found.");
        String form = "infId=OA-13233&seqNo=&seq="
                + URLEncoder.encode(matcher.group(1), StandardCharsets.UTF_8) + "&infSeq=1";
        HttpRequest fileRequest = HttpRequest.newBuilder(URI.create(SEOUL_FILE_DOWNLOAD_URL))
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form)).build();
        HttpResponse<byte[]> fileResponse = httpClient().send(fileRequest, HttpResponse.BodyHandlers.ofByteArray());
        requireSuccessStatus(fileResponse.statusCode(), "ev-chargers XLSX download");
        return parseGeumcheonEvWorkbook(fileResponse.body(), matcher.group(2));
    }

    private List<Map<String, String>> parseGeumcheonEvWorkbook(byte[] content, String referenceDateCompact) throws IOException {
        if (content == null || content.length == 0) throw new IllegalStateException("Official EV charger XLSX was empty.");
        List<Map<String, String>> rows = new ArrayList<>();
        DataFormatter formatter = new DataFormatter();
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(content))) {
            Sheet sheet = workbook.getSheetAt(0);
            Row header = sheet.getRow(0);
            Map<String, Integer> columns = new LinkedHashMap<>();
            for (int i = 0; i < header.getLastCellNum(); i += 1) columns.put(cellText(header, i, formatter), i);
            for (int rowIndex = 1; rowIndex <= sheet.getLastRowNum(); rowIndex += 1) {
                Row row = sheet.getRow(rowIndex);
                if (row == null) continue;
                String district = cellByHeader(row, columns, formatter, "시군구");
                String address = cellByHeader(row, columns, formatter, "주소");
                if (!containsGeumcheon(district) && !containsGeumcheon(address)) continue;
                Map<String, String> item = new LinkedHashMap<>();
                String operator = cellByHeader(row, columns, formatter, "운영기관");
                String name = cellByHeader(row, columns, formatter, "충전소");
                String chargerId = cellByHeader(row, columns, formatter, "충전기ID");
                item.put("sourceOriginalId", joinNaturalKey(joinNaturalKey(operator, name), chargerId));
                item.put("STAT_NM", name);
                item.put("ADDR", address);
                item.put("LAT", cellByHeader(row, columns, formatter, "위도"));
                item.put("LNG", cellByHeader(row, columns, formatter, "경도"));
                item.put("CHARGER_TYPE_NM", cellByHeader(row, columns, formatter, "충전기타입"));
                item.put("CAPACITY", cellByHeader(row, columns, formatter, "충전용량"));
                item.put("REFERENCE_DATE", referenceDateCompact.substring(0, 4) + "-"
                        + referenceDateCompact.substring(4, 6) + "-" + referenceDateCompact.substring(6, 8));
                item.put("source", "금천구·서울 열린데이터광장");
                rows.add(item);
            }
        }
        return rows;
    }

    private String cellByHeader(Row row, Map<String, Integer> columns, DataFormatter formatter, String header) {
        Integer index = columns.get(header);
        return index == null ? "" : numericCellText(row, index, formatter);
    }

    private static String firstNonBlankIgnoreCase(Map<String, String> row, String... keys) {
        for (String key : keys) {
            for (Map.Entry<String, String> entry : row.entrySet()) {
                if (entry.getKey().equalsIgnoreCase(key) && entry.getValue() != null && !entry.getValue().isBlank()) {
                    return entry.getValue().trim();
                }
            }
        }
        return null;
    }

    private static boolean containsGeumcheon(String value) {
        return value != null && value.contains("금천구");
    }

    private static String joinNaturalKey(String left, String right) {
        if (left == null || left.isBlank()) return right;
        if (right == null || right.isBlank()) return left;
        return left + ":" + right;
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
        return "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty"
                + "?serviceKey=" + normalizeKeyValue(dataGoKrApiKey)
                + "&returnType=json"
                + "&numOfRows=100"
                + "&pageNo=1"
                + "&stationName=" + URLEncoder.encode("금천구", StandardCharsets.UTF_8)
                + "&dataTerm=DAILY"
                + "&ver=1.3";
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
        String relayToken = normalizeKeyValue(wifiRelayToken);
        if (!relayToken.isBlank()) {
            masked = masked.replace(relayToken, "[redacted]");
        }
        String livingRelayToken = normalizeKeyValue(livingFacilityRelayToken);
        if (!livingRelayToken.isBlank()) {
            masked = masked.replace(livingRelayToken, "[redacted]");
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

    private CollectionRunResult unconfirmedSourceResult(PublicDataRepository.CollectorSpec spec) {
        Instant now = Instant.now();
        return new CollectionRunResult(
                spec.datasetKey(),
                "skipped",
                0,
                0,
                "Source contract is not confirmed; collector is disabled.",
                "-",
                now,
                now,
                Duration.ZERO
        );
    }

    private boolean beginCollectorRun() {
        return collectorRunning.compareAndSet(false, true);
    }

    /** syncAll 내 개별 수집 호출을 격리한다. 한 데이터셋 예외가 다음 수집을 막지 않는다. */
    private CollectionRunResult runSafely(String datasetKey, String triggeredBy, java.util.function.Supplier<CollectionRunResult> action) {
        try {
            return action.get();
        } catch (Exception error) {
            Instant now = Instant.now();
            String message = error.getMessage() == null || error.getMessage().isBlank()
                    ? error.getClass().getSimpleName()
                    : error.getMessage();
            log.error("Unexpected failure during syncAll for {}: {}", datasetKey, message, error);
            return new CollectionRunResult(
                    datasetKey, "failed", 0, 0,
                    "Public data collection failed unexpectedly.",
                    "-", now, now, Duration.ZERO
            );
        }
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

    private List<Map<String, String>> fetchAirQualityRowsWithStation(
            String requestUrl,
            String datasetName
    ) throws Exception {
        List<Map<String, String>> rows = fetchRowsWithRetry(requestUrl, datasetName);
        List<Map<String, String>> enriched = new ArrayList<>(rows.size());
        for (Map<String, String> row : rows) {
            Map<String, String> normalized = new LinkedHashMap<>(row);
            String stationName = normalized.get("stationName");
            if (stationName == null || stationName.isBlank()) {
                normalized.put("stationName", "금천구");
            }
            enriched.add(normalized);
        }
        return enriched;
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

    private String normalizeWifiRelayBaseUrl(String value) {
        return normalizeRelayBaseUrl(value, 18088, "WiFi");
    }

    private String normalizeRelayBaseUrl(String value, int defaultPort, String relayName) {
        String normalized = value == null || value.isBlank()
                ? "http://127.0.0.1:" + defaultPort : value.trim();
        URI uri = URI.create(normalized);
        String host = uri.getHost();
        boolean loopback = "127.0.0.1".equals(host) || "localhost".equalsIgnoreCase(host) || "::1".equals(host);
        if (!"http".equalsIgnoreCase(uri.getScheme()) || !loopback || uri.getPort() < 1024
                || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null) {
            throw new IllegalArgumentException(
                    relayName + " relay URL must be a loopback-only HTTP origin with an explicit internal port."
            );
        }
        String path = uri.getPath();
        if (path != null && !path.isBlank() && !"/".equals(path)) {
            throw new IllegalArgumentException(relayName + " relay URL must not contain a path.");
        }
        return normalized.endsWith("/") ? normalized.substring(0, normalized.length() - 1) : normalized;
    }

    private String seoulOpenApiBaseUrl() {
        return "https://openapi.seoul.go.kr/";
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
        HttpResponse<String> response = httpClient().send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
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
