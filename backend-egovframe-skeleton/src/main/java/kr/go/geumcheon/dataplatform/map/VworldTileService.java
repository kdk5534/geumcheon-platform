package kr.go.geumcheon.dataplatform.map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;

@Service
public class VworldTileService {

    private static final Map<String, TileStyle> STYLES = Map.of(
            "base", new TileStyle("Base", "png", "image/png"),
            "satellite", new TileStyle("Satellite", "jpeg", "image/jpeg"),
            "hybrid", new TileStyle("Hybrid", "png", "image/png")
    );

    private volatile HttpClient httpClient;
    private final String apiKey;

    @Autowired
    public VworldTileService(@Value("${geumcheon.api-keys.vworld:}") String apiKey) {
        this(null, apiKey);
    }

    VworldTileService(HttpClient httpClient, String apiKey) {
        this.httpClient = httpClient;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
    }

    public boolean isConfigured() {
        return !apiKey.isBlank();
    }

    public TileResponse fetch(String style, int z, int y, int x) throws IOException, InterruptedException {
        if (!isConfigured()) {
            throw new IllegalStateException("VWorld API key is not configured.");
        }
        TileStyle tileStyle = resolveStyle(style);
        validateCoordinates(z, y, x);
        HttpRequest request = HttpRequest.newBuilder(buildUri(tileStyle, z, y, x))
                .timeout(Duration.ofSeconds(8))
                .header("Accept", tileStyle.contentType())
                .GET()
                .build();
        HttpResponse<byte[]> response = httpClient().send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() != 200 || response.body() == null || response.body().length == 0) {
            throw new IOException("VWorld tile request failed with status " + response.statusCode());
        }
        return new TileResponse(response.body(), tileStyle.contentType());
    }

    private HttpClient httpClient() {
        HttpClient current = httpClient;
        if (current != null) {
            return current;
        }
        synchronized (this) {
            if (httpClient == null) {
                httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();
            }
            return httpClient;
        }
    }

    URI buildUri(TileStyle style, int z, int y, int x) {
        return URI.create("https://api.vworld.kr/req/wmts/1.0.0/" + apiKey + "/"
                + style.layer() + "/" + z + "/" + y + "/" + x + "." + style.extension());
    }

    private TileStyle resolveStyle(String style) {
        TileStyle resolved = STYLES.get(String.valueOf(style).toLowerCase(Locale.ROOT));
        if (resolved == null) {
            throw new IllegalArgumentException("Unsupported VWorld tile style.");
        }
        return resolved;
    }

    private void validateCoordinates(int z, int y, int x) {
        if (z < 6 || z > 18) {
            throw new IllegalArgumentException("Tile zoom must be between 6 and 18.");
        }
        int maximum = (1 << z) - 1;
        if (x < 0 || y < 0 || x > maximum || y > maximum) {
            throw new IllegalArgumentException("Tile coordinates are outside the selected zoom.");
        }
    }

    record TileStyle(String layer, String extension, String contentType) {
    }

    public record TileResponse(byte[] body, String contentType) {
    }
}
