package kr.go.geumcheon.dataplatform.admin;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CsvUploadDraftTest {

    @TempDir
    Path tempDir;

    @Test
    void draftExpiresAtTheTtlBoundary() throws Exception {
        Path contentPath = Files.createTempFile(tempDir, "draft-", ".csv");
        Files.writeString(contentPath, "id\nFAC-001");
        CsvUploadDraft draft = new CsvUploadDraft(
                "upload-1",
                "facilities",
                "sample.csv",
                false,
                contentPath,
                Files.size(contentPath),
                CsvUploadDraft.sha256(Files.readAllBytes(contentPath)),
                List.of("id"),
                1,
                1,
                Instant.parse("2026-06-06T00:00:00Z")
        );

        Duration ttl = Duration.ofMinutes(15);

        assertThat(draft.isExpired(ttl, Instant.parse("2026-06-06T00:14:59Z"))).isFalse();
        assertThat(draft.isExpired(ttl, Instant.parse("2026-06-06T00:15:00Z"))).isTrue();
    }
}
