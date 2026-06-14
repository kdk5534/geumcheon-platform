package kr.go.geumcheon.dataplatform.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class AdminAuthConfig {

    @Bean
    @Profile("!mock")
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
