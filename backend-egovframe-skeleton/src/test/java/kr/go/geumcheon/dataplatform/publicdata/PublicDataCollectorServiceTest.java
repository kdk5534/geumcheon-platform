package kr.go.geumcheon.dataplatform.publicdata;

import com.fasterxml.jackson.databind.ObjectMapper;
import kr.go.geumcheon.dataplatform.dataset.DatasetRegistry;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.ByteArrayOutputStream;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class PublicDataCollectorServiceTest {

    private final JdbcPublicDataRepository repository = mock(JdbcPublicDataRepository.class);
    private final HttpClient httpClient = mock(HttpClient.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final DatasetRegistry datasetRegistry = new DatasetRegistry();

    @Test
    void syncStoresCollectsAllPagesAndMasksRequestUrl() throws Exception {
        UUID datasetId = UUID.randomUUID();
        when(repository.upsertDataset(any())).thenReturn(datasetId);
        when(repository.replaceStoreBusinesses(eq(datasetId), anyList())).thenReturn(3);
        when(repository.recordCollectionLog(eq(datasetId), anyString(), anyString(), any(), any(), any(Integer.class), any(Integer.class), any(), anyString(), anyString()))
                .thenReturn(UUID.randomUUID());
        HttpResponse<String> pageOneResponse = successResponse("""
                {
                  "body": {
                    "totalCount": "3",
                    "items": [
                      {"bizesId": "store-1", "bizesNm": "One"},
                      {"bizesId": "store-2", "bizesNm": "Two"}
                    ]
                  }
                }
                """);
        HttpResponse<String> pageTwoResponse = successResponse("""
                {
                  "body": {
                    "totalCount": "3",
                    "items": [
                      {"bizesId": "store-3", "bizesNm": "Three"}
                    ]
                  }
                }
                """);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(pageOneResponse)
                .thenReturn(pageTwoResponse);

        PublicDataCollectorService service = new PublicDataCollectorService(
                repository,
                datasetRegistry,
                objectMapper,
                "live-key",
                "seoul-key",
                true,
                5,
                0,
                0,
                2,
                10,
                0,
                httpClient
        );

        CollectionRunResult result = service.syncStores("manual");

        ArgumentCaptor<HttpRequest> requestCaptor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient, org.mockito.Mockito.times(2)).send(requestCaptor.capture(), any(HttpResponse.BodyHandler.class));
        assertThat(requestCaptor.getAllValues())
                .extracting(request -> request.uri().toString())
                .containsExactly(
                        "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius?ServiceKey=live-key&pageNo=1&numOfRows=2&type=json&cx=126.8954&cy=37.4568&x=126.8954&y=37.4568&radius=3000",
                        "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius?ServiceKey=live-key&pageNo=2&numOfRows=2&type=json&cx=126.8954&cy=37.4568&x=126.8954&y=37.4568&radius=3000"
                );

        ArgumentCaptor<List<Map<String, String>>> rowsCaptor = ArgumentCaptor.forClass(List.class);
        verify(repository).replaceStoreBusinesses(eq(datasetId), rowsCaptor.capture());
        assertThat(rowsCaptor.getValue())
                .extracting(row -> row.get("bizesId"))
                .containsExactly("store-1", "store-2", "store-3");

        ArgumentCaptor<String> loggedUrlCaptor = ArgumentCaptor.forClass(String.class);
        verify(repository).recordCollectionLog(eq(datasetId), eq("API"), eq("SUCCESS"), any(), any(), eq(3), eq(3), eq(null), loggedUrlCaptor.capture(), eq("manual"));
        assertThat(loggedUrlCaptor.getValue()).contains("https://apis.data.go.kr/");
        assertThat(loggedUrlCaptor.getValue()).contains("ServiceKey=[redacted]");
        assertThat(loggedUrlCaptor.getValue()).doesNotContain("live-key");

        assertThat(result.status()).isEqualTo("success");
        assertThat(result.fetchedCount()).isEqualTo(3);
        assertThat(result.savedCount()).isEqualTo(3);
        assertThat(result.requestUrl()).contains("ServiceKey=[redacted]");
        assertThat(result.requestUrl()).doesNotContain("live-key");
    }

    @Test
    void syncStoresSkipsWhenApiKeyIsMissing() {
        UUID datasetId = UUID.randomUUID();
        when(repository.upsertDataset(any())).thenReturn(datasetId);
        when(repository.recordCollectionLog(eq(datasetId), anyString(), anyString(), any(), any(), any(Integer.class), any(Integer.class), anyString(), anyString(), anyString()))
                .thenReturn(UUID.randomUUID());

        PublicDataCollectorService service = new PublicDataCollectorService(
                repository,
                datasetRegistry,
                objectMapper,
                " ",
                "seoul-key",
                true,
                5,
                0,
                0,
                500,
                200,
                0,
                httpClient
        );

        CollectionRunResult result = service.syncStores("manual");

        assertThat(result.status()).isEqualTo("skipped");
        assertThat(result.message()).contains("DATA_GO_KR_API_KEY is missing");
        verifyNoInteractions(httpClient);
        verify(repository, never()).replaceStoreBusinesses(any(), anyList());
    }

    @Test
    void syncStoresFailsBeforeReplaceWhenTotalPagesExceedConfiguredMaxPages() throws Exception {
        UUID datasetId = UUID.randomUUID();
        when(repository.upsertDataset(any())).thenReturn(datasetId);
        when(repository.recordCollectionLog(eq(datasetId), anyString(), anyString(), any(), any(), any(Integer.class), any(Integer.class), anyString(), anyString(), anyString()))
                .thenReturn(UUID.randomUUID());
        HttpResponse<String> firstPageResponse = successResponse("""
                {
                  "body": {
                    "totalCount": "5",
                    "items": [
                      {"bizesId": "store-1", "bizesNm": "One"},
                      {"bizesId": "store-2", "bizesNm": "Two"}
                    ]
                  }
                }
                """);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(firstPageResponse);

        PublicDataCollectorService service = new PublicDataCollectorService(
                repository,
                datasetRegistry,
                objectMapper,
                "live-key",
                "seoul-key",
                true,
                5,
                0,
                0,
                2,
                2,
                0,
                httpClient
        );

        CollectionRunResult result = service.syncStores("manual");

        ArgumentCaptor<String> errorMessageCaptor = ArgumentCaptor.forClass(String.class);
        verify(repository).recordCollectionLog(eq(datasetId), eq("API"), eq("FAILED"), any(), any(), eq(0), eq(0), errorMessageCaptor.capture(), anyString(), eq("manual"));
        assertThat(errorMessageCaptor.getValue()).contains("exceeding configured max pages 2");
        assertThat(errorMessageCaptor.getValue()).contains("before replacing stored rows");
        assertThat(result.status()).isEqualTo("failed");
        assertThat(result.message()).isEqualTo("Public data collection failed.");
        verify(repository, never()).replaceStoreBusinesses(any(), anyList());
    }

    @Test
    void syncDatasetReturnsSkippedWhenCollectorRoutineIsMissing() {
        PublicDataCollectorService service = new PublicDataCollectorService(
                repository,
                datasetRegistry,
                objectMapper,
                "live-key",
                "seoul-key",
                true,
                5,
                0,
                0,
                500,
                200,
                0,
                httpClient
        ) {
            @Override
            public List<PublicDataRepository.CollectorSpec> specs() {
                List<PublicDataRepository.CollectorSpec> specs = new ArrayList<>(super.specs());
                specs.add(new PublicDataRepository.CollectorSpec(
                        "custom-dataset",
                        "Custom dataset",
                        "custom",
                        "Custom source",
                        "https://example.com",
                        "manual",
                        "POINT",
                        "planned",
                        false,
                        "",
                        true,
                        "Custom"
                ));
                return specs;
            }
        };

        CollectionRunResult result = service.syncDataset("custom-dataset", "manual");

        assertThat(result.status()).isEqualTo("skipped");
        assertThat(result.message()).contains("No collector routine for datasetKey: custom-dataset");
        assertThat(result.message()).doesNotContain("already running");
        verifyNoInteractions(httpClient);
    }

    @Test
    void syncDatasetReturnsBusyWhileAnotherRunIsInProgress() throws Exception {
        UUID datasetId = UUID.randomUUID();
        CountDownLatch requestStarted = new CountDownLatch(1);
        CountDownLatch releaseRequest = new CountDownLatch(1);

        when(repository.upsertDataset(any())).thenReturn(datasetId);
        when(repository.replaceStoreBusinesses(eq(datasetId), anyList())).thenReturn(1);
        when(repository.recordCollectionLog(eq(datasetId), anyString(), anyString(), any(), any(), any(Integer.class), any(Integer.class), any(), anyString(), anyString()))
                .thenReturn(UUID.randomUUID());
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenAnswer(invocation -> {
                    requestStarted.countDown();
                    releaseRequest.await(2, TimeUnit.SECONDS);
                    return successResponse("""
                            {
                              "body": {
                                "totalCount": "1",
                                "items": [
                                  {"bizesId": "store-1", "bizesNm": "One"}
                                ]
                              }
                            }
                            """);
                });

        PublicDataCollectorService service = new PublicDataCollectorService(
                repository,
                datasetRegistry,
                objectMapper,
                "live-key",
                "seoul-key",
                true,
                5,
                0,
                0,
                500,
                200,
                0,
                httpClient
        );

        CompletableFuture<CollectionRunResult> firstRun = CompletableFuture.supplyAsync(() -> service.syncDataset("stores", "manual"));
        assertThat(requestStarted.await(2, TimeUnit.SECONDS)).isTrue();

        CollectionRunResult busyResult = service.syncDataset("stores", "manual");
        releaseRequest.countDown();

        assertThat(busyResult.status()).isEqualTo("skipped");
        assertThat(busyResult.message()).contains("already running");
        assertThat(firstRun.get(2, TimeUnit.SECONDS).status()).isEqualTo("success");
    }

    @Test
    void wifiCollectorSkipsWithoutRelayTokenAndMakesNoExternalRequest() {
        UUID datasetId = UUID.randomUUID();
        when(repository.upsertDataset(any())).thenReturn(datasetId);
        when(repository.recordCollectionLog(eq(datasetId), anyString(), anyString(), any(), any(), any(Integer.class), any(Integer.class), any(), anyString(), anyString()))
                .thenReturn(UUID.randomUUID());

        PublicDataCollectorService service = new PublicDataCollectorService(
                repository,
                datasetRegistry,
                objectMapper,
                "data-key",
                "seoul-secret",
                true,
                5,
                0,
                0,
                500,
                200,
                0,
                httpClient
        );

        List<String> keys = List.of("public-wifi");
        List<CollectionRunResult> results = keys.stream()
                .map(key -> service.syncDataset(key, "manual"))
                .toList();
        assertThat(results).extracting(CollectionRunResult::status).containsOnly("skipped");
        assertThat(results).extracting(CollectionRunResult::message)
                .allSatisfy(message -> assertThat(message).contains("WIFI_RELAY_TOKEN is missing"));
        verifyNoInteractions(httpClient);
    }

    @Test
    void wifiCollectorAcceptsOnlyAuthenticatedLoopbackRelayRows() throws Exception {
        UUID datasetId = UUID.randomUUID();
        when(repository.upsertDataset(any())).thenReturn(datasetId);
        when(repository.replaceFacilitySnapshot(eq(datasetId), eq("WIFI"), anyList())).thenReturn(2);
        when(repository.recordCollectionLog(eq(datasetId), anyString(), anyString(), any(), any(), any(Integer.class), any(Integer.class), any(), anyString(), anyString()))
                .thenReturn(UUID.randomUUID());
        HttpResponse<String> response = successResponse("""
                {
                  "service":"TbPublicWifiInfo_GC",
                  "status":"SUCCESS",
                  "sourceCount":2,
                  "validCount":2,
                  "rows":[
                    {"X_SWIFI_WRDNFC_NO":"wifi-1","X_SWIFI_MAIN_NM":"AP 1","ADDR":"금천구 테스트로 1","LAT":"37.4568","LNT":"126.8954","district":"금천구","sourceService":"TbPublicWifiInfo_GC"},
                    {"X_SWIFI_WRDNFC_NO":"wifi-2","X_SWIFI_MAIN_NM":"AP 2","ADDR":"금천구 테스트로 2","LAT":"37.4668","LNT":"126.8854","district":"금천구","sourceService":"TbPublicWifiInfo_GC"}
                  ]
                }
                """);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);

        String relayToken = "relay-token-with-at-least-32-characters";
        PublicDataCollectorService service = new PublicDataCollectorService(
                repository, datasetRegistry, objectMapper,
                "data-key", "seoul-key", true,
                5, 0, 0, false,
                500, 200, 0,
                "http://127.0.0.1:18088", relayToken, httpClient
        );

        CollectionRunResult result = service.syncDataset("public-wifi", "manual");

        ArgumentCaptor<HttpRequest> requestCaptor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient).send(requestCaptor.capture(), any(HttpResponse.BodyHandler.class));
        assertThat(requestCaptor.getValue().uri().toString())
                .isEqualTo("http://127.0.0.1:18088/v1/public-wifi");
        assertThat(requestCaptor.getValue().headers().firstValue("X-Relay-Token")).contains(relayToken);
        assertThat(result.status()).isEqualTo("success");
        assertThat(result.savedCount()).isEqualTo(2);
        assertThat(result.requestUrl()).doesNotContain(relayToken).doesNotContain("seoul-key");
        verify(repository).replaceFacilitySnapshot(
                eq(datasetId), eq("WIFI"),
                argThat(rows -> rows.size() == 2 && rows.stream().allMatch(row -> "금천구".equals(row.get("district"))))
        );
    }

    @Test
    void wifiCollectorRejectsDuplicateRelayRowsAndPreservesSnapshot() throws Exception {
        UUID datasetId = UUID.randomUUID();
        when(repository.upsertDataset(any())).thenReturn(datasetId);
        when(repository.recordCollectionLog(eq(datasetId), anyString(), anyString(), any(), any(), any(Integer.class), any(Integer.class), any(), anyString(), anyString()))
                .thenReturn(UUID.randomUUID());
        HttpResponse<String> response = successResponse("""
                {"status":"SUCCESS","rows":[
                  {"X_SWIFI_WRDNFC_NO":"same","X_SWIFI_MAIN_NM":"AP 1","LAT":"37.4568","LNT":"126.8954","district":"금천구","sourceService":"TbPublicWifiInfo_GC"},
                  {"X_SWIFI_WRDNFC_NO":"same","X_SWIFI_MAIN_NM":"AP 2","LAT":"37.4668","LNT":"126.8854","district":"금천구","sourceService":"TbPublicWifiInfo_GC"}
                ]}
                """);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);
        PublicDataCollectorService service = new PublicDataCollectorService(
                repository, datasetRegistry, objectMapper,
                "data-key", "seoul-key", true,
                5, 0, 0, false,
                500, 200, 0,
                "http://127.0.0.1:18088", "relay-token-with-at-least-32-characters", httpClient
        );

        CollectionRunResult result = service.syncDataset("public-wifi", "manual");

        assertThat(result.status()).isEqualTo("failed");
        verify(repository, never()).replaceFacilitySnapshot(eq(datasetId), eq("WIFI"), anyList());
    }

    @Test
    void wifiCollectorReportsSafeRelayTimeoutAndPreservesSnapshot() throws Exception {
        UUID datasetId = UUID.randomUUID();
        when(repository.upsertDataset(any())).thenReturn(datasetId);
        when(repository.recordCollectionLog(eq(datasetId), anyString(), anyString(), any(), any(), any(Integer.class), any(Integer.class), any(), anyString(), anyString()))
                .thenReturn(UUID.randomUUID());
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(503);
        when(response.body()).thenReturn("{\"status\":\"FAILED\",\"errorCode\":\"TIMEOUT\"}");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);
        PublicDataCollectorService service = new PublicDataCollectorService(
                repository, datasetRegistry, objectMapper,
                "data-key", "seoul-key", true,
                5, 0, 0, false,
                500, 200, 0,
                "http://127.0.0.1:18088", "relay-token-with-at-least-32-characters", httpClient
        );

        CollectionRunResult result = service.syncDataset("public-wifi", "manual");

        assertThat(result.status()).isEqualTo("failed");
        assertThat(result.message()).isEqualTo("Public data collection failed.");
        verify(repository).recordCollectionLog(
                eq(datasetId), eq("API"), eq("FAILED"), any(), any(), eq(0), eq(0),
                argThat(message -> message.contains("TIMEOUT")
                        && !message.contains("relay-token") && !message.contains("seoul-key")),
                eq("http://127.0.0.1:18088/v1/public-wifi"), eq("manual")
        );
        verify(repository, never()).replaceFacilitySnapshot(eq(datasetId), eq("WIFI"), anyList());
    }

    @Test
    void wifiRelayUrlMustStayOnExplicitLoopbackPort() {
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> new PublicDataCollectorService(
                repository, datasetRegistry, objectMapper,
                "data-key", "seoul-key", true,
                5, 0, 0, false,
                500, 200, 0,
                "http://example.com:18088", "relay-token-with-at-least-32-characters", httpClient
        )).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("loopback-only");
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void bikeStationsUseLatestOfficialHttpsWorkbookAndKeepOnlyGeumcheonRows() throws Exception {
        UUID datasetId = UUID.randomUUID();
        when(repository.upsertDataset(any())).thenReturn(datasetId);
        when(repository.latestSuccessfulSourceCount(datasetId)).thenReturn(127);
        when(repository.replaceFacilitySnapshot(eq(datasetId), eq("BIKE"), anyList())).thenReturn(2);
        when(repository.recordCollectionLog(eq(datasetId), anyString(), anyString(), any(), any(), any(Integer.class), any(Integer.class), any(), anyString(), anyString()))
                .thenReturn(UUID.randomUUID());

        HttpResponse<String> pageResponse = successResponse("""
                <span onclick="javascript:downloadFile('23');">공공자전거 대여소 정보(25.12월 기준).xlsx</span>
                """);
        HttpResponse<byte[]> workbookResponse = mock(HttpResponse.class);
        when(workbookResponse.statusCode()).thenReturn(200);
        when(workbookResponse.body()).thenReturn(bikeWorkbook());
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn((HttpResponse) pageResponse)
                .thenReturn((HttpResponse) workbookResponse);

        PublicDataCollectorService service = new PublicDataCollectorService(
                repository, datasetRegistry, objectMapper,
                "data-key", "", true,
                5, 0, 0, 500, 200, 0, httpClient
        );

        CollectionRunResult result = service.syncDataset("bike-stations", "manual");

        ArgumentCaptor<HttpRequest> requestCaptor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient, org.mockito.Mockito.times(2)).send(requestCaptor.capture(), any(HttpResponse.BodyHandler.class));
        assertThat(requestCaptor.getAllValues()).extracting(request -> request.uri().toString())
                .containsExactly(
                        "https://data.seoul.go.kr/dataList/OA-13252/A/1/datasetView.do",
                        "https://datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do?&useCache=false"
                );
        assertThat(requestCaptor.getAllValues().get(1).method()).isEqualTo("POST");

        ArgumentCaptor<List<Map<String, String>>> rowsCaptor = ArgumentCaptor.forClass(List.class);
        verify(repository).replaceFacilitySnapshot(eq(datasetId), eq("BIKE"), rowsCaptor.capture());
        assertThat(rowsCaptor.getValue()).hasSize(2)
                .allSatisfy(row -> assertThat(row.get("district")).isEqualTo("금천구"));
        assertThat(rowsCaptor.getValue()).extracting(row -> row.get("stationId"))
                .containsExactly("1701", "1702");
        assertThat(rowsCaptor.getValue().get(0))
                .containsEntry("stationName", "가산디지털단지역")
                .containsEntry("rackTotCnt", "15")
                .containsEntry("stationLatitude", "37.481")
                .containsEntry("stationLongitude", "126.882");
        assertThat(result.status()).isEqualTo("success");
        assertThat(result.fetchedCount()).isEqualTo(2);
        assertThat(result.requestUrl()).isEqualTo("https://data.seoul.go.kr/dataList/OA-13252/A/1/datasetView.do");
    }

    @Test
    void approvedAirQualityCollectorUsesDataGoKrHttpsAndMasksTheKey() throws Exception {
        UUID datasetId = UUID.randomUUID();
        when(repository.upsertDataset(any())).thenReturn(datasetId);
        when(repository.replaceAirQualitySnapshot(eq(datasetId), anyList())).thenReturn(1);
        when(repository.recordCollectionLog(eq(datasetId), anyString(), anyString(), any(), any(), any(Integer.class), any(Integer.class), any(), anyString(), anyString()))
                .thenReturn(UUID.randomUUID());
        HttpResponse<String> response = successResponse("""
                {"row":[{"MSRSTE_NM":"금천구","MSRDT":"202606192300","PM10":"20","PM25":"10"}]}
                """);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(response);

        PublicDataCollectorService service = new PublicDataCollectorService(
                repository, datasetRegistry, objectMapper,
                "data-key", "seoul-secret", true,
                5, 0, 0, true,
                500, 200, 0, httpClient
        );

        CollectionRunResult result = service.syncDataset("air-quality", "manual");

        assertThat(result.status()).isEqualTo("success");
        verify(repository).replaceAirQualitySnapshot(
                eq(datasetId),
                argThat(rows -> rows.size() == 1 && "금천구".equals(rows.get(0).get("stationName")))
        );
        assertThat(result.requestUrl()).startsWith("https://apis.data.go.kr/B552584/");
        assertThat(result.requestUrl()).contains("[redacted]").doesNotContain("data-key");
        ArgumentCaptor<HttpRequest> requestCaptor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient).send(requestCaptor.capture(), any(HttpResponse.BodyHandler.class));
        assertThat(requestCaptor.getValue().uri().toString())
                .startsWith("https://apis.data.go.kr/B552584/")
                .contains("serviceKey=data-key");
    }

    @Test
    void emptyResponseFailsBeforeReplacingExistingSnapshot() throws Exception {
        UUID datasetId = UUID.randomUUID();
        when(repository.upsertDataset(any())).thenReturn(datasetId);
        when(repository.recordCollectionLog(eq(datasetId), anyString(), anyString(), any(), any(), any(Integer.class), any(Integer.class), any(), anyString(), anyString()))
                .thenReturn(UUID.randomUUID());
        HttpResponse<String> emptyResponse = successResponse("""
                {"body":{"totalCount":"0","items":[]}}
                """);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(emptyResponse);

        PublicDataCollectorService service = new PublicDataCollectorService(
                repository, datasetRegistry, objectMapper,
                "data-key", "seoul-key", true,
                5, 0, 0, 500, 200, 0, httpClient
        );

        CollectionRunResult result = service.syncStores("manual");

        assertThat(result.status()).isEqualTo("failed");
        assertThat(result.message()).isEqualTo("Public data collection failed.");
        verify(repository, never()).replaceStoreBusinesses(any(), anyList());
        verify(repository).recordCollectionLog(
                eq(datasetId), eq("API"), eq("FAILED"), any(), any(),
                eq(0), eq(0), eq("No 상가업소 정보 records were returned from the API."),
                anyString(), eq("manual")
        );
        assertThat(result.requestUrl()).startsWith("https://apis.data.go.kr/");
    }

    @Test
    void heatShelterSourceIsRecordedButCollectionStaysDisabledWithoutSeparateCredential() {
        when(repository.upsertDataset(any())).thenReturn(UUID.randomUUID());
        PublicDataCollectorService service = new PublicDataCollectorService(
                repository, datasetRegistry, objectMapper,
                "data-key", "seoul-key", true,
                5, 0, 0, 500, 200, 0, httpClient
        );

        CollectionRunResult result = service.syncDataset("heat-shelters", "manual");

        assertThat(result.status()).isEqualTo("skipped");
        assertThat(result.message()).contains("Collection disabled");
        verifyNoInteractions(httpClient);
    }

    @Test
    void schoolZonesUseOfficialRepresentativePointsAndFilterToGeumcheon() throws Exception {
        UUID datasetId = UUID.randomUUID();
        when(repository.upsertDataset(any())).thenReturn(datasetId);
        when(repository.replaceFacilitySnapshot(eq(datasetId), eq("SCHOOL_ZONE"), anyList())).thenReturn(1);
        HttpResponse<String> schoolResponse = successResponse("""
                {"response":{"body":{"items":[
                  {"TRGET_FCLTY_NM":"금천초등학교","RDNMADR":"서울특별시 금천구 시흥대로 1","LATITUDE":"37.45","LONGITUDE":"126.90","INSTITUTION_NM":"서울특별시 금천구"},
                  {"TRGET_FCLTY_NM":"구로초등학교","RDNMADR":"서울특별시 구로구 구로로 1","LATITUDE":"37.50","LONGITUDE":"126.88","INSTITUTION_NM":"서울특별시 구로구"}
                ]}}}
                """);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(schoolResponse);
        PublicDataCollectorService service = new PublicDataCollectorService(
                repository, datasetRegistry, objectMapper,
                "data-key", "seoul-key", true,
                5, 0, 0, 500, 200, 0, httpClient
        );

        CollectionRunResult result = service.syncSchoolZones("manual");

        ArgumentCaptor<List<Map<String, String>>> rows = ArgumentCaptor.forClass(List.class);
        verify(repository).replaceFacilitySnapshot(eq(datasetId), eq("SCHOOL_ZONE"), rows.capture());
        assertThat(rows.getValue()).singleElement().satisfies(row ->
                assertThat(row.get("TRGET_FCLTY_NM")).isEqualTo("금천초등학교")
        );
        assertThat(result.status()).isEqualTo("success");
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void evCollectorStoresLocationAndChargingSpecificationWithoutRealtimeStatus() throws Exception {
        UUID datasetId = UUID.randomUUID();
        when(repository.upsertDataset(any())).thenReturn(datasetId);
        when(repository.replaceFacilitySnapshot(eq(datasetId), eq("EV_CHARGER"), anyList())).thenReturn(1);
        HttpResponse<String> pageResponse = successResponse("""
                <span onclick="javascript:downloadFile('5');">서울특별시 금천구_전기차충전소 정보_20250228.xlsx</span>
                """);
        HttpResponse<byte[]> workbookResponse = mock(HttpResponse.class);
        when(workbookResponse.statusCode()).thenReturn(200);
        when(workbookResponse.body()).thenReturn(evWorkbook());
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn((HttpResponse) pageResponse)
                .thenReturn((HttpResponse) workbookResponse);
        PublicDataCollectorService service = new PublicDataCollectorService(
                repository, datasetRegistry, objectMapper,
                "data-key", "seoul-key", true,
                5, 0, 0, 500, 200, 0, httpClient
        );

        CollectionRunResult result = service.syncEvChargers("manual");

        ArgumentCaptor<List<Map<String, String>>> rows = ArgumentCaptor.forClass(List.class);
        verify(repository).replaceFacilitySnapshot(eq(datasetId), eq("EV_CHARGER"), rows.capture());
        assertThat(rows.getValue()).singleElement().satisfies(row -> {
            assertThat(row).containsEntry("sourceOriginalId", "서울시:금천 충전소:01");
            assertThat(row).containsEntry("CHARGER_TYPE_NM", "DC콤보");
            assertThat(row).containsEntry("CAPACITY", "100kW");
            assertThat(row).containsEntry("REFERENCE_DATE", "2025-02-28");
            assertThat(row).doesNotContainKeys("충전기상태", "stat", "statUpdDt");
        });
        assertThat(result.status()).isEqualTo("success");
    }

    @SuppressWarnings("unchecked")
    private HttpResponse<String> successResponse(String body) {
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.body()).thenReturn(body);
        return response;
    }

    private byte[] bikeWorkbook() throws Exception {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("대여소현황");
            addBikeRow(sheet.createRow(5), 1701, " 가산디지털단지역 ", "금천구", 37.481, 126.882, 10, 5);
            addBikeRow(sheet.createRow(6), 1702, "금천구청역", "금천구", 37.456, 126.895, 0, 12);
            addBikeRow(sheet.createRow(7), 9999, "구로역", "구로구", 37.503, 126.882, 20, 0);
            workbook.write(output);
            return output.toByteArray();
        }
    }

    private byte[] evWorkbook() throws Exception {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("전기차충전소");
            String[] headers = {
                    "운영기관", "충전소", "충전기ID", "충전기타입", "충전기상태", "시설구분(대)",
                    "시설구분(소)", "지역", "시군구", "주소", "지번 주소", "상세위치", "이용가능시간",
                    "이용자 제한", "충전용량", "위도", "경도"
            };
            var header = sheet.createRow(0);
            for (int i = 0; i < headers.length; i += 1) header.createCell(i).setCellValue(headers[i]);
            addEvRow(sheet.createRow(1), "서울시", "금천 충전소", "01", "DC콤보", "충전중",
                    "금천구", "서울특별시 금천구 가산로 1", "100kW", 37.47, 126.89);
            addEvRow(sheet.createRow(2), "서울시", "구로 충전소", "01", "AC완속", "사용가능",
                    "구로구", "서울특별시 구로구 구로로 1", "7kW", 37.50, 126.88);
            workbook.write(output);
            return output.toByteArray();
        }
    }

    private void addEvRow(
            org.apache.poi.ss.usermodel.Row row,
            String operator,
            String station,
            String chargerId,
            String chargerType,
            String realtimeStatus,
            String district,
            String address,
            String capacity,
            double latitude,
            double longitude
    ) {
        row.createCell(0).setCellValue(operator);
        row.createCell(1).setCellValue(station);
        row.createCell(2).setCellValue(chargerId);
        row.createCell(3).setCellValue(chargerType);
        row.createCell(4).setCellValue(realtimeStatus);
        row.createCell(8).setCellValue(district);
        row.createCell(9).setCellValue(address);
        row.createCell(14).setCellValue(capacity);
        row.createCell(15).setCellValue(latitude);
        row.createCell(16).setCellValue(longitude);
    }

    @Test
    @SuppressWarnings("unchecked")
    void museumStandardApiFiltersToGeumcheonByInsttNmAndIncludesCoordinates() throws Exception {
        UUID datasetId = UUID.randomUUID();
        when(repository.upsertDataset(any())).thenReturn(datasetId);
        when(repository.replaceFacilitySnapshot(eq(datasetId), eq("MUSEUM"), anyList())).thenReturn(1);
        // insttNm 필드로 금천구 필터 — "서울특별시 금천구" 1건 + "서울특별시 종로구" 1건
        HttpResponse<String> apiResponse = successResponse("""
                {"response":{"body":{"items":[
                  {
                    "fcltyNm": "금천문화예술회관",
                    "fcltyType": "공립",
                    "rdnmadr": "서울특별시 금천구 시흥대로 168",
                    "lnmadr": "",
                    "insttNm": "서울특별시 금천구",
                    "latitude": "37.4562",
                    "longitude": "126.8971"
                  },
                  {
                    "fcltyNm": "종로박물관",
                    "fcltyType": "사립",
                    "rdnmadr": "서울특별시 종로구 평창로 1",
                    "lnmadr": "",
                    "insttNm": "서울특별시 종로구",
                    "latitude": "37.6100",
                    "longitude": "126.9700"
                  }
                ]}}}
                """);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(apiResponse);
        PublicDataCollectorService service = new PublicDataCollectorService(
                repository, datasetRegistry, objectMapper,
                "data-key", "seoul-key", true,
                5, 0, 0, 500, 200, 0, httpClient
        );

        CollectionRunResult result = service.syncMuseums("manual");

        ArgumentCaptor<List<Map<String, String>>> rows = ArgumentCaptor.forClass(List.class);
        verify(repository).replaceFacilitySnapshot(eq(datasetId), eq("MUSEUM"), rows.capture());
        assertThat(rows.getValue()).hasSize(1);
        Map<String, String> row = rows.getValue().get(0);
        assertThat(row.get("fcltyNm")).isEqualTo("금천문화예술회관");
        assertThat(row.get("insttNm")).contains("금천구");
        assertThat(row.get("latitude")).isEqualTo("37.4562");
        assertThat(row.get("longitude")).isEqualTo("126.8971");
        assertThat(result.status()).isEqualTo("success");
    }

    @Test
    @SuppressWarnings("unchecked")
    void libraryStandardApiFiltersToGeumcheonAndIncludesCoordinates() throws Exception {
        UUID datasetId = UUID.randomUUID();
        when(repository.upsertDataset(any())).thenReturn(datasetId);
        when(repository.replaceFacilitySnapshot(eq(datasetId), eq("LIBRARY"), anyList())).thenReturn(1);
        // data.go.kr 표준데이터 응답: 금천구 도서관 1건 + 관악구 도서관 1건 (금천구만 저장돼야 함)
        HttpResponse<String> apiResponse = successResponse("""
                {"response":{"body":{"items":[
                  {
                    "LBRRY_NM": "독산도서관",
                    "RDNMADR": "서울특별시 금천구 독산로 12",
                    "LNMADR": "서울특별시 금천구 독산동 250",
                    "LBRRY_SE_NM": "공공도서관",
                    "LATITUDE": "37.4685",
                    "LONGITUDE": "126.9003"
                  },
                  {
                    "LBRRY_NM": "관악구립도서관",
                    "RDNMADR": "서울특별시 관악구 봉천로 1",
                    "LNMADR": "서울특별시 관악구 봉천동 100",
                    "LBRRY_SE_NM": "공공도서관",
                    "LATITUDE": "37.4800",
                    "LONGITUDE": "126.9500"
                  }
                ]}}}
                """);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(apiResponse);
        PublicDataCollectorService service = new PublicDataCollectorService(
                repository, datasetRegistry, objectMapper,
                "data-key", "seoul-key", true,
                5, 0, 0, 500, 200, 0, httpClient
        );

        CollectionRunResult result = service.syncLibraries("manual");

        ArgumentCaptor<List<Map<String, String>>> rows = ArgumentCaptor.forClass(List.class);
        verify(repository).replaceFacilitySnapshot(eq(datasetId), eq("LIBRARY"), rows.capture());
        assertThat(rows.getValue()).hasSize(1);
        Map<String, String> row = rows.getValue().get(0);
        assertThat(row.get("LBRRY_NM")).isEqualTo("독산도서관");
        assertThat(row.get("RDNMADR")).contains("금천구");
        assertThat(row.get("LATITUDE")).isEqualTo("37.4685");
        assertThat(row.get("LONGITUDE")).isEqualTo("126.9003");
        assertThat(result.status()).isEqualTo("success");
    }

    @Test
    @SuppressWarnings("unchecked")
    void parkStandardApiFiltersToGeumcheonAndIncludesCoordinates() throws Exception {
        UUID datasetId = UUID.randomUUID();
        when(repository.upsertDataset(any())).thenReturn(datasetId);
        when(repository.replaceFacilitySnapshot(eq(datasetId), eq("PARK"), anyList())).thenReturn(1);
        // data.go.kr 표준데이터 응답: 금천구 공원 1건 + 동작구 공원 1건 (금천구만 저장돼야 함)
        HttpResponse<String> apiResponse = successResponse("""
                {"response":{"body":{"items":[
                  {
                    "PARK_NM": "가산공원",
                    "RDNMADR": "서울특별시 금천구 가산디지털1로 60",
                    "LNMADR": "서울특별시 금천구 가산동 505",
                    "PARK_SE": "어린이공원",
                    "LATITUDE": "37.4789",
                    "LONGITUDE": "126.8820"
                  },
                  {
                    "PARK_NM": "동작공원",
                    "RDNMADR": "서울특별시 동작구 사당로 1",
                    "LNMADR": "서울특별시 동작구 사당동 100",
                    "PARK_SE": "근린공원",
                    "LATITUDE": "37.4900",
                    "LONGITUDE": "126.9600"
                  }
                ]}}}
                """);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(apiResponse);
        PublicDataCollectorService service = new PublicDataCollectorService(
                repository, datasetRegistry, objectMapper,
                "data-key", "seoul-key", true,
                5, 0, 0, 500, 200, 0, httpClient
        );

        CollectionRunResult result = service.syncParks("manual");

        ArgumentCaptor<List<Map<String, String>>> rows = ArgumentCaptor.forClass(List.class);
        verify(repository).replaceFacilitySnapshot(eq(datasetId), eq("PARK"), rows.capture());
        assertThat(rows.getValue()).hasSize(1);
        Map<String, String> row = rows.getValue().get(0);
        assertThat(row.get("PARK_NM")).isEqualTo("가산공원");
        assertThat(row.get("RDNMADR")).contains("금천구");
        assertThat(row.get("LATITUDE")).isEqualTo("37.4789");
        assertThat(row.get("LONGITUDE")).isEqualTo("126.8820");
        assertThat(result.status()).isEqualTo("success");
    }

    @Test
    @SuppressWarnings("unchecked")
    void traditionalMarketStandardApiFiltersToGeumcheonAndIncludesCoordinates() throws Exception {
        UUID datasetId = UUID.randomUUID();
        when(repository.upsertDataset(any())).thenReturn(datasetId);
        when(repository.replaceFacilitySnapshot(eq(datasetId), eq("TRADITIONAL_MARKET"), anyList())).thenReturn(1);
        // data.go.kr 표준데이터 응답: 금천구 시장 1건 + 구로구 시장 1건 (금천구만 저장돼야 함)
        HttpResponse<String> apiResponse = successResponse("""
                {"response":{"body":{"items":[
                  {
                    "mrktNm": "가산시장",
                    "rdnmadr": "서울특별시 금천구 가산디지털1로 168",
                    "lnmadr": "서울특별시 금천구 가산동 345",
                    "mrktType": "일반시장(상설)",
                    "storNumber": "42",
                    "latitude": "37.4768",
                    "longitude": "126.8815"
                  },
                  {
                    "mrktNm": "구로시장",
                    "rdnmadr": "서울특별시 구로구 구로동로 1",
                    "lnmadr": "서울특별시 구로구 구로동 100",
                    "mrktType": "일반시장(상설)",
                    "storNumber": "10",
                    "latitude": "37.5000",
                    "longitude": "126.8800"
                  }
                ]}}}
                """);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(apiResponse);
        PublicDataCollectorService service = new PublicDataCollectorService(
                repository, datasetRegistry, objectMapper,
                "data-key", "seoul-key", true,
                5, 0, 0, 500, 200, 0, httpClient
        );

        CollectionRunResult result = service.syncTraditionalMarkets("manual");

        ArgumentCaptor<List<Map<String, String>>> rows = ArgumentCaptor.forClass(List.class);
        verify(repository).replaceFacilitySnapshot(eq(datasetId), eq("TRADITIONAL_MARKET"), rows.capture());
        // 금천구 1건만 저장, 구로구 제외
        assertThat(rows.getValue()).hasSize(1);
        Map<String, String> row = rows.getValue().get(0);
        assertThat(row.get("mrktNm")).isEqualTo("가산시장");
        assertThat(row.get("rdnmadr")).contains("금천구");
        assertThat(row.get("latitude")).isEqualTo("37.4768");
        assertThat(row.get("longitude")).isEqualTo("126.8815");
        assertThat(row.get("mrktType")).isEqualTo("일반시장(상설)");
        assertThat(result.status()).isEqualTo("success");
    }

    @Test
    @SuppressWarnings("unchecked")
    void knowledgeIndustryCenterApiFiltersToGeumcheonAndNormalizesFields() throws Exception {
        UUID datasetId = UUID.randomUUID();
        when(repository.upsertDataset(any())).thenReturn(datasetId);
        when(repository.replaceFacilitySnapshot(eq(datasetId), eq("KNOWLEDGE_INDUSTRY_CENTER"), anyList())).thenReturn(1);
        // odcloud API 응답: 금천구 1건 + 구로구 1건 (금천구만 저장돼야 함)
        HttpResponse<String> apiResponse = successResponse("""
                {
                  "page": 1, "perPage": 2000, "totalCount": 2, "currentCount": 2,
                  "data": [
                    {
                      "시도": "서울특별시", "시군구": "금천구",
                      "지식산업센터명": "금천첨단R&D산업센터",
                      "공장대표주소(도로명)": "서울특별시 금천구 가산디지털1로 168",
                      "공장대표주소(지번)": "서울특별시 금천구 가산동 691-14",
                      "입지구분": "도시형공장지역", "단지명": "G밸리",
                      "상태": "완공", "건축면적(제곱미터)": "49834", "설치자": "금천구"
                    },
                    {
                      "시도": "서울특별시", "시군구": "구로구",
                      "지식산업센터명": "구로테크밸리",
                      "공장대표주소(도로명)": "서울특별시 구로구 디지털로 1",
                      "공장대표주소(지번)": "", "입지구분": "", "단지명": "",
                      "상태": "완공", "건축면적(제곱미터)": "12000", "설치자": ""
                    }
                  ]
                }
                """);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(apiResponse);
        PublicDataCollectorService service = new PublicDataCollectorService(
                repository, datasetRegistry, objectMapper,
                "data-key", "seoul-key", true,
                5, 0, 0, 500, 200, 0, httpClient
        );

        CollectionRunResult result = service.syncKnowledgeIndustryCenters("manual");

        ArgumentCaptor<List<Map<String, String>>> rows = ArgumentCaptor.forClass(List.class);
        verify(repository).replaceFacilitySnapshot(eq(datasetId), eq("KNOWLEDGE_INDUSTRY_CENTER"), rows.capture());
        // 금천구 1건만 저장, 구로구 제외
        assertThat(rows.getValue()).hasSize(1);
        Map<String, String> row = rows.getValue().get(0);
        assertThat(row.get("STAT_NM")).isEqualTo("금천첨단R&D산업센터");
        assertThat(row.get("ADDR")).contains("금천구");
        assertThat(row.get("입지구분")).isEqualTo("도시형공장지역");
        assertThat(row.get("건축연면적")).isEqualTo("49834");
        assertThat(row.get("source")).isEqualTo("공공데이터포털 한국산업단지공단 전국지식산업센터현황");
        // vworldApiKey가 null(테스트 생성자)이므로 지오코딩 건너뜀 → LAT/LNG 키 없음
        assertThat(row).doesNotContainKey("LAT");
        assertThat(result.status()).isEqualTo("success");
    }

    private void addBikeRow(
            org.apache.poi.ss.usermodel.Row row,
            int id,
            String name,
            String district,
            double latitude,
            double longitude,
            int lcdRacks,
            int qrRacks
    ) {
        row.createCell(0).setCellValue(id);
        row.createCell(1).setCellValue(name);
        row.createCell(2).setCellValue(district);
        row.createCell(3).setCellValue("서울특별시 " + district + " 테스트로 1");
        row.createCell(4).setCellValue(latitude);
        row.createCell(5).setCellValue(longitude);
        row.createCell(7).setCellValue(lcdRacks);
        row.createCell(8).setCellValue(qrRacks);
        row.createCell(9).setCellValue(qrRacks > 0 ? "QR" : "LCD");
    }
}
