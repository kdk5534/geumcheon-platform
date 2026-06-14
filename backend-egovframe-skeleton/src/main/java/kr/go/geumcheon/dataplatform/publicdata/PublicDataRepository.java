package kr.go.geumcheon.dataplatform.publicdata;

import kr.go.geumcheon.dataplatform.dataset.DatasetSummary;
import kr.go.geumcheon.dataplatform.facility.FacilitySummary;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface PublicDataRepository {

    List<DatasetSummary> listDatasets();

    List<FacilitySummary> listFacilities();

    List<StoreSummary> listStores();

    List<AirQualitySummary> listAirQuality();

    List<ApiSourceSummary> listApiSources(List<CollectorSpec> specs);

    List<ApiLogSummary> recentApiLogs(List<CollectorSpec> specs);

    Map<String, DatasetRegistryEntry> loadDatasetRegistryEntries(List<CollectorSpec> specs);

    UUID upsertDataset(CollectorSpec spec);

    UUID ensureIndicator(String indicatorKey, String indicatorName, String domain, String unit, String description, UUID datasetId);

    int replaceStoreBusinesses(UUID datasetId, List<Map<String, String>> rows);

    int replaceAirQualitySnapshot(UUID datasetId, List<Map<String, String>> rows);

    UUID recordCollectionLog(
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
    );

    record DatasetRegistryEntry(
            String datasetKey,
            String datasetName,
            String domain,
            String sourceName,
            String sourceUrl,
            String refreshCycle,
            String apiStatus,
            boolean authKeyRequired,
            String envVarName,
            ApiLogSummary latestLog
    ) {
    }

    record CollectorSpec(
            String datasetKey,
            String datasetName,
            String domain,
            String sourceName,
            String sourceUrl,
            String refreshCycle,
            String spatialType,
            String apiStatus,
            boolean authKeyRequired,
            String envVarName,
            boolean apiKeyPresent,
            String targetScreen
    ) {
    }
}
