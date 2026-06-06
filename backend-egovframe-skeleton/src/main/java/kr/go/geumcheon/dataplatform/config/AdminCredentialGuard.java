package kr.go.geumcheon.dataplatform.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class AdminCredentialGuard implements ApplicationRunner {

    private final String runtimeMode;
    private final String adminPassword;
    private final String dbPassword;

    public AdminCredentialGuard(
            @Value("${geumcheon.runtime.mode:db}") String runtimeMode,
            @Value("${spring.security.user.password:}") String adminPassword,
            @Value("${spring.datasource.password:}") String dbPassword
    ) {
        this.runtimeMode = runtimeMode;
        this.adminPassword = adminPassword;
        this.dbPassword = dbPassword;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (isMockMode()) {
            return;
        }

        if (isUnsafePassword(adminPassword) || isUnsafePassword(dbPassword)) {
            throw new IllegalStateException(
                    "Set non-default ADMIN_INITIAL_PASSWORD and DB_PASSWORD before starting DB or production mode."
            );
        }
    }

    private boolean isMockMode() {
        return "mock".equalsIgnoreCase(runtimeMode);
    }

    private boolean isUnsafePassword(String value) {
        if (value == null || value.isBlank()) {
            return true;
        }
        return "admin1234".equals(value) || "change-me".equalsIgnoreCase(value);
    }
}
