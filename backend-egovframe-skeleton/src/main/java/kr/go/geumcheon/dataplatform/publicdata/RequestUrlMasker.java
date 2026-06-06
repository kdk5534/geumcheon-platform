package kr.go.geumcheon.dataplatform.publicdata;

final class RequestUrlMasker {

    private RequestUrlMasker() {
    }

    static String mask(String requestUrl) {
        if (requestUrl == null || requestUrl.isBlank()) {
            return requestUrl;
        }
        String masked = requestUrl.replaceAll("(?i)(ServiceKey=)([^&]*)", "$1[redacted]");
        return masked.replaceAll("(?i)(https?://openapi\\.seoul\\.go\\.kr:8088/)([^/]*)(/json/)", "$1[redacted]$3");
    }
}
