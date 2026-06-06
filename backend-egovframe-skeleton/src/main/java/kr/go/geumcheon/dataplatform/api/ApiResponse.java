package kr.go.geumcheon.dataplatform.api;

import java.time.Instant;

public record ApiResponse<T>(
        boolean success,
        T data,
        String message,
        Instant timestamp,
        String sourceMode
) {
    public static <T> ApiResponse<T> ok(T data) {
        return ok(data, null);
    }

    public static <T> ApiResponse<T> ok(T data, String sourceMode) {
        return new ApiResponse<>(true, data, null, Instant.now(), sourceMode);
    }

    public static <T> ApiResponse<T> fail(String message) {
        return fail(message, null);
    }

    public static <T> ApiResponse<T> fail(String message, String sourceMode) {
        return new ApiResponse<>(false, null, message, Instant.now(), sourceMode);
    }
}
