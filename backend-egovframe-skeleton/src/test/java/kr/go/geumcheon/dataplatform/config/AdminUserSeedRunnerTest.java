package kr.go.geumcheon.dataplatform.config;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class AdminUserSeedRunnerTest {

    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);

    @Test
    void rejectsBlankInitialPasswordBeforeDatabaseAccess() {
        AdminUserSeedRunner runner = new AdminUserSeedRunner(
                jdbcTemplate,
                passwordEncoder,
                "admin",
                "   ",
                "초기 관리자",
                ""
        );

        assertThatThrownBy(() -> runner.run(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ADMIN_INITIAL_PASSWORD");

        verifyNoInteractions(jdbcTemplate, passwordEncoder);
    }

    @Test
    void rejectsPlaceholderInitialPasswordBeforeDatabaseAccess() {
        AdminUserSeedRunner runner = new AdminUserSeedRunner(
                jdbcTemplate,
                passwordEncoder,
                "admin",
                "change-me",
                "초기 관리자",
                ""
        );

        assertThatThrownBy(() -> runner.run(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ADMIN_INITIAL_PASSWORD");

        verifyNoInteractions(jdbcTemplate, passwordEncoder);
    }
}
