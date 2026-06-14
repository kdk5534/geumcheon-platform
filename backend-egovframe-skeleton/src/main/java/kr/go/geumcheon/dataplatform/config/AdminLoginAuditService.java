package kr.go.geumcheon.dataplatform.config;

import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

@Component
@Profile("!mock")
public class AdminLoginAuditService {

    private final JdbcTemplate jdbcTemplate;

    public AdminLoginAuditService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @EventListener
    public void handleAuthenticationSuccess(AuthenticationSuccessEvent event) {
        Authentication authentication = event.getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return;
        }

        String loginId = extractLoginId(authentication);
        if (loginId == null || loginId.isBlank()) {
            return;
        }

        jdbcTemplate.update("""
                UPDATE admin_user
                SET last_login_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE login_id = ?
                """, loginId);
    }

    private String extractLoginId(Authentication authentication) {
        Object principal = authentication.getPrincipal();
        if (principal instanceof UserDetails userDetails) {
            return userDetails.getUsername();
        }
        return authentication.getName();
    }
}
