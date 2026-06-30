package kr.go.geumcheon.dataplatform.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class AdminAuthConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    @Profile("mock")
    public UserDetailsService mockAdminUserDetailsService(
            PasswordEncoder passwordEncoder,
            @Value("${spring.security.user.name:admin}") String loginId,
            @Value("${spring.security.user.password:admin1234}") String password
    ) {
        return new InMemoryUserDetailsManager(User.withUsername(loginId)
                .password(passwordEncoder.encode(password))
                .roles("ADMIN")
                .build());
    }
}
