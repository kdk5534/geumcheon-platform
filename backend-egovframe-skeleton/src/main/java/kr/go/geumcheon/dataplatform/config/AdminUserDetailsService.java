package kr.go.geumcheon.dataplatform.config;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;

@Service
@Profile("!mock")
public class AdminUserDetailsService implements UserDetailsService {

    private final JdbcTemplate jdbcTemplate;

    public AdminUserDetailsService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        List<AdminUserRecord> users = jdbcTemplate.query("""
                SELECT
                    login_id,
                    password_hash,
                    role_code,
                    is_active
                FROM admin_user
                WHERE login_id = ?
                """,
                (rs, rowNum) -> new AdminUserRecord(
                        rs.getString("login_id"),
                        rs.getString("password_hash"),
                        rs.getString("role_code"),
                        rs.getBoolean("is_active")
                ),
                username
        );

        if (users.isEmpty()) {
            throw new UsernameNotFoundException("Admin user was not found: " + username);
        }

        AdminUserRecord user = users.get(0);
        if (!user.active()) {
            throw new DisabledException("Admin user is inactive: " + username);
        }

        return User.withUsername(user.loginId())
                .password(user.passwordHash())
                .authorities(new SimpleGrantedAuthority(toRoleAuthority(user.roleCode())))
                .build();
    }

    private String toRoleAuthority(String roleCode) {
        String normalized = roleCode == null || roleCode.isBlank()
                ? "ADMIN"
                : roleCode.trim().toUpperCase(Locale.ROOT);
        return normalized.startsWith("ROLE_") ? normalized : "ROLE_" + normalized;
    }

    private record AdminUserRecord(
            String loginId,
            String passwordHash,
            String roleCode,
            boolean active
    ) {
    }
}
