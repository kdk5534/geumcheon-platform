package kr.go.geumcheon.dataplatform.publicdata;

import com.fasterxml.jackson.databind.ObjectMapper;
import kr.go.geumcheon.dataplatform.dataset.DatasetRegistry;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

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

    @SuppressWarnings("unchecked")
    private HttpResponse<String> successResponse(String body) {
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.body()).thenReturn(body);
        return response;
    }
}
