package kr.go.geumcheon.dataplatform.admin;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class UploadDraftManagerTest {

    @TempDir
    Path tempDir;

    @Test
    void storeWritesTempFileAndDiscardDeletesIt() throws Exception {
        UploadDraftManager manager = new UploadDraftManager(Duration.ofMinutes(15), 5, tempDir);

        CsvUploadDraft draft = manager.store(
                "facilities",
                "sample.csv",
                false,
                "id,name\n1,A".getBytes(),
                List.of("id", "name"),
                1,
                2
        );

        assertThat(Files.exists(draft.contentPath())).isTrue();
        assertThat(draft.readContent()).isEqualTo("id,name\n1,A".getBytes());
        assertThat(draft.rowCount()).isEqualTo(1);
        assertThat(draft.columnCount()).isEqualTo(2);

        manager.discard(draft.uploadId());

        assertThat(Files.exists(draft.contentPath())).isFalse();
    }

    @Test
    void cleanupDeletesExpiredDraftFiles() throws Exception {
        UploadDraftManager manager = new UploadDraftManager(Duration.ofMillis(5), 5, tempDir);
        CsvUploadDraft draft = manager.store(
                "stores",
                "stores.csv",
                false,
                "name,address\nCafe,Addr".getBytes(),
                List.of("name", "address"),
                1,
                2
        );

        Thread.sleep(20);
        manager.cleanup();

        assertThat(manager.find(draft.uploadId())).isNull();
        assertThat(Files.exists(draft.contentPath())).isFalse();
    }

    @Test
    void storeTrimsOldestDraftWhenLimitIsExceeded() {
        UploadDraftManager manager = new UploadDraftManager(Duration.ofMinutes(15), 1, tempDir);
        CsvUploadDraft first = manager.store(
                "facilities",
                "first.csv",
                false,
                "id\n1".getBytes(),
                List.of("id"),
                1,
                1
        );

        CsvUploadDraft second = manager.store(
                "facilities",
                "second.csv",
                false,
                "id\n2".getBytes(),
                List.of("id"),
                1,
                1
        );

        assertThat(manager.find(first.uploadId())).isNull();
        assertThat(Files.exists(first.contentPath())).isFalse();
        assertThat(manager.find(second.uploadId())).isNotNull();
    }
}
