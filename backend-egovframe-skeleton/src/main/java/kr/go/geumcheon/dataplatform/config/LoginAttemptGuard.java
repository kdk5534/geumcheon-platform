// 로그인 ID별 실패 횟수를 추적해 brute-force를 차단하는 인메모리 가드

package kr.go.geumcheon.dataplatform.config;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 관리자 로그인 무차별 대입(brute-force) 방어.
 * 동일 loginId로 MAX_ATTEMPTS회 실패 시 LOCK_DURATION_SECONDS 동안 추가 시도를 차단한다.
 * 재시작 시 상태가 초기화되므로 운영 환경에서는 Redis 같은 외부 저장소로 교체할 수 있다.
 */
@Component
public class LoginAttemptGuard {

    private static final int MAX_ATTEMPTS = 5;
    private static final long LOCK_DURATION_SECONDS = 900; // 15분

    private final ConcurrentHashMap<String, Attempt> attempts = new ConcurrentHashMap<>();

    /** 현재 loginId가 잠금 상태인지 반환한다. */
    public boolean isBlocked(String loginId) {
        if (loginId == null || loginId.isBlank()) {
            return false;
        }
        Attempt attempt = attempts.get(loginId);
        if (attempt == null) {
            return false;
        }
        if (attempt.lockedUntil() != null && Instant.now().isBefore(attempt.lockedUntil())) {
            return true;
        }
        // 잠금 만료 후 자동 해제
        if (attempt.lockedUntil() != null) {
            attempts.remove(loginId);
        }
        return false;
    }

    /** 로그인 실패를 기록하고, 임계값 초과 시 계정을 잠근다. */
    public void recordFailure(String loginId) {
        if (loginId == null || loginId.isBlank()) {
            return;
        }
        attempts.compute(loginId, (key, existing) -> {
            int count = existing == null ? 1 : existing.failureCount() + 1;
            Instant lockedUntil = count >= MAX_ATTEMPTS
                    ? Instant.now().plusSeconds(LOCK_DURATION_SECONDS)
                    : (existing != null ? existing.lockedUntil() : null);
            return new Attempt(count, lockedUntil);
        });
    }

    /** 로그인 성공 시 실패 기록을 초기화한다. */
    public void reset(String loginId) {
        if (loginId != null && !loginId.isBlank()) {
            attempts.remove(loginId);
        }
    }

    private record Attempt(int failureCount, Instant lockedUntil) {
    }
}
