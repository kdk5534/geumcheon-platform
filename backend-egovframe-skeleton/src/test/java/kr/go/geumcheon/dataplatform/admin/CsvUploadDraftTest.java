package kr.go.geumcheon.dataplatform.admin;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CsvUploadDraftTest {

    @Test
    void draftExpiresAtTheTtlBoundary() {
        CsvUploadDraft draft = new CsvUploadDraft(
                "upload-1",
                "facilities",
                "sample.csv",
                new byte[0],
                List.of("id"),
                List.of(List.of("FAC-001")),
                Instant.parse("2026-06-06T00:00:00Z")
        );

        Duration ttl = Duration.ofMinutes(15);

        assertThat(draft.isExpired(ttl, Instant.parse("2026-06-06T00:14:59Z"))).isFalse();
        assertThat(draft.isExpired(ttl, Instant.parse("2026-06-06T00:15:00Z"))).isTrue();
    }
}
