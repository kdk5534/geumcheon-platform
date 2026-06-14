package kr.go.geumcheon.dataplatform.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AdminCredentialGuardTest {

    @Test
    void allowsMockModeEvenWithPlaceholderPasswords() {
        AdminCredentialGuard guard = new AdminCredentialGuard("mock", "change-me", "change-me");

        assertThatCode(() -> guard.run(null)).doesNotThrowAnyException();
    }

    @Test
    void rejectsUnsafeAdminPasswordInDbMode() {
        AdminCredentialGuard guard = new AdminCredentialGuard("db", "change-me", "strong-db-password");

        assertThatThrownBy(() -> guard.run(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ADMIN_INITIAL_PASSWORD")
                .hasMessageContaining("DB_PASSWORD");
    }

    @Test
    void rejectsBlankAdminPasswordInDbMode() {
        AdminCredentialGuard guard = new AdminCredentialGuard("db", "   ", "strong-db-password");

        assertThatThrownBy(() -> guard.run(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ADMIN_INITIAL_PASSWORD");
    }

    @Test
    void rejectsUnsafeDbPasswordInDbMode() {
        AdminCredentialGuard guard = new AdminCredentialGuard("db", "strong-admin-password", "change-me");

        assertThatThrownBy(() -> guard.run(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ADMIN_INITIAL_PASSWORD")
                .hasMessageContaining("DB_PASSWORD");
    }
}
