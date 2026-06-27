package kr.go.geumcheon.dataplatform.admin;

public interface StagedUploadStore {

    StagedUploadSummary stage(String actor, UploadCommitRequest request, CsvUploadDraft draft);

    StagedUploadSummary linkChangeRequest(String stagedUploadId, String changeRequestId);

    StagedUploadMaterial requirePendingForRequest(String changeRequestId);

    StagedUploadSummary markApplying(String stagedUploadId);

    StagedUploadSummary markApplied(String stagedUploadId);

    StagedUploadSummary markRejected(String stagedUploadId);

    StagedUploadSummary markFailed(String stagedUploadId, String message);

    void discard(String stagedUploadId);
}
