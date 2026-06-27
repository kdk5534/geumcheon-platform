package kr.go.geumcheon.dataplatform.map;

import org.junit.jupiter.api.Test;

import java.net.http.HttpClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class VworldTileServiceTest {

    @Test
    void reportsWhetherServerSideKeyIsConfigured() {
        assertThat(new VworldTileService(mock(HttpClient.class), "").isConfigured()).isFalse();
        assertThat(new VworldTileService(mock(HttpClient.class), "server-key").isConfigured()).isTrue();
    }

    @Test
    void rejectsUnsupportedStyleBeforeNetworkRequest() {
        VworldTileService service = new VworldTileService(mock(HttpClient.class), "server-key");

        assertThatThrownBy(() -> service.fetch("unknown", 13, 3170, 6990))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unsupported");
    }

    @Test
    void rejectsCoordinatesOutsideZoomGrid() {
        VworldTileService service = new VworldTileService(mock(HttpClient.class), "server-key");

        assertThatThrownBy(() -> service.fetch("base", 13, 9000, 9000))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("outside");
    }
}
