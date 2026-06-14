package kr.go.geumcheon.dataplatform.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@Profile("!mock")
public class AdminUserSeedRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;
    private final String loginId;
    private final String password;
    private final String adminName;
    private final String email;

    public AdminUserSeedRunner(
            JdbcTemplate jdbcTemplate,
            PasswordEncoder passwordEncoder,
            @Value("${ADMIN_INITIAL_LOGIN_ID:admin}") String loginId,
            @Value("${ADMIN_INITIAL_PASSWORD:change-me}") String password,
            @Value("${ADMIN_INITIAL_NAME:초기 관리자}") String adminName,
            @Value("${ADMIN_INITIAL_EMAIL:}") String email
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.passwordEncoder = passwordEncoder;
        this.loginId = loginId;
        this.password = password;
        this.adminName = adminName;
        this.email = email;
    }

    @Override
    public void run(ApplicationArguments args) {
        validateInitialAdminCredentials();

        Integer existingCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM admin_user WHERE login_id = ?",
                Integer.class,
                loginId
        );
        if (existingCount != null && existingCount > 0) {
            return;
        }

        jdbcTemplate.update("""
                INSERT INTO admin_user (
                    login_id,
                    password_hash,
                    admin_name,
                    email,
                    role_code,
                    is_active
                )
                VALUES (?, ?, ?, ?, 'ADMIN', TRUE)
                """,
                loginId,
                passwordEncoder.encode(password),
                adminName,
                nullIfBlank(email)
        );
    }

    private void validateInitialAdminCredentials() {
        if (loginId == null || loginId.isBlank()) {
            throw new IllegalStateException("Set ADMIN_INITIAL_LOGIN_ID before seeding the initial admin user.");
        }
        if (isUnsafePassword(password)) {
            throw new IllegalStateException(
                    "Set a non-default ADMIN_INITIAL_PASSWORD before seeding the initial admin user."
            );
        }
    }

    private boolean isUnsafePassword(String value) {
        if (value == null || value.isBlank()) {
            return true;
        }
        return "admin1234".equals(value) || "change-me".equalsIgnoreCase(value);
    }

    private String nullIfBlank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
