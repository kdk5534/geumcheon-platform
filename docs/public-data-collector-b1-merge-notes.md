# Public Data Collector B1 Merge Notes

This note is for the final merge with the B1 branch that introduces `PublicDataRepository` and `DatasetRegistry`.

## Keep these A1/A2 changes during merge

Files that will likely conflict:

- `backend-egovframe-skeleton/src/main/java/kr/go/geumcheon/dataplatform/publicdata/PublicDataCollectorService.java`
- `backend-egovframe-skeleton/src/test/java/kr/go/geumcheon/dataplatform/publicdata/PublicDataCollectorServiceTest.java`
- `backend-egovframe-skeleton/src/main/resources/application.yml`
- `backend-egovframe-skeleton/src/main/resources/application-mock.yml`
- `.env.example`
- `README.md`
- `docs/p4-public-data-sync.md`
- `docs/project-roadmap.md`

## Merge checklist for `PublicDataCollectorService`

1. Keep the `HttpClient` injection seam.
   - Preserve the package-private constructor that accepts `HttpClient`.
   - Preserve the production constructor path that calls `buildHttpClient(timeoutSeconds)`.

2. Keep the store pagination settings.
   - `geumcheon.collector.store-page-size`
   - `geumcheon.collector.store-max-pages`
   - `geumcheon.collector.store-page-delay-millis`

3. Keep the full-page collection loop for stores.
   - Preserve `fetchStoreRowsWithRetry(...)`
   - Preserve `fetchStorePageWithRetry(...)`
   - Preserve `calculateStoreTotalPages(...)`
   - Preserve `extractRequiredTotalCount(...)`
   - Preserve the `pageNo` + `totalCount` logic and the `sleepBetweenStorePages(...)` pause

4. Keep the fail-fast behavior when `storeMaxPages` is too small.
   - The run must fail before `replaceStoreBusinesses(...)` is called.
   - Preserve the message: `so collection stops before replacing stored rows`

5. Keep HTTPS API URLs.
   - `https://apis.data.go.kr/...`
   - `https://openAPI.seoul.go.kr:8088/...`

6. Keep the `syncDataset()` default branch as skipped.
   - Preserve: `No collector routine for datasetKey: ...`

## Type-level adjustments after B1 merge

When B1 is merged, apply these mechanical replacements:

- Replace `JdbcPublicDataRepository repository` with `PublicDataRepository repository`
- Replace `JdbcPublicDataRepository.CollectorSpec` with the B1 collector spec type or `DatasetRegistry` entry type used there
- If B1 moves dataset specs into `DatasetRegistry`, keep the current store/air-quality routing logic but read specs from `DatasetRegistry`
- Update `PublicDataCollectorServiceTest` to mock `PublicDataRepository` instead of `JdbcPublicDataRepository`

## Regression tests to preserve

- `syncStoresCollectsAllPagesAndMasksRequestUrl`
- `syncStoresSkipsWhenApiKeyIsMissing`
- `syncStoresFailsBeforeReplaceWhenTotalPagesExceedConfiguredMaxPages`
- `syncDatasetReturnsSkippedWhenCollectorRoutineIsMissing`
- `syncDatasetReturnsBusyWhileAnotherRunIsInProgress`
