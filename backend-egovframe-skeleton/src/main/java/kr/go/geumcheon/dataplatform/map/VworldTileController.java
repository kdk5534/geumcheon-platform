package kr.go.geumcheon.dataplatform.map;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;

@RestController
@RequestMapping("/api/public/map")
public class VworldTileController {

    private final VworldTileService tileService;

    public VworldTileController(VworldTileService tileService) {
        this.tileService = tileService;
    }

    @GetMapping("/status")
    public Map<String, Object> status() {
        return Map.of(
                "provider", "VWorld",
                "configured", tileService.isConfigured(),
                "styles", new String[] { "base", "satellite", "hybrid" }
        );
    }

    @GetMapping("/tiles/{style}/{z}/{y}/{x}")
    public ResponseEntity<?> tile(
            @PathVariable String style,
            @PathVariable int z,
            @PathVariable int y,
            @PathVariable int x
    ) {
        try {
            VworldTileService.TileResponse tile = tileService.fetch(style, z, y, x);
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(tile.contentType()))
                    .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
                    .body(tile.body());
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("message", error.getMessage()));
        } catch (IllegalStateException error) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("message", "VWorld map is not configured."));
        } catch (IOException error) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("message", "VWorld map is temporarily unavailable."));
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("message", "VWorld map request was interrupted."));
        }
    }
}
