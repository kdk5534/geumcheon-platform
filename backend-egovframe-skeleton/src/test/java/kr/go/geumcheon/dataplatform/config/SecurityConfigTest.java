package kr.go.geumcheon.dataplatform.config;

import kr.go.geumcheon.dataplatform.admin.AdminUploadController;
import kr.go.geumcheon.dataplatform.admin.AdminUploadStore;
import kr.go.geumcheon.dataplatform.admin.ExcelUploadParser;
import kr.go.geumcheon.dataplatform.dataset.DatasetRegistry;
import kr.go.geumcheon.dataplatform.publicdata.JdbcPublicDataRepository;
import kr.go.geumcheon.dataplatform.publicdata.PublicDataCollectorService;
import kr.go.geumcheon.dataplatform.publicdata.PublicDataController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = {AdminUploadController.class, PublicDataController.class})
@Import({SecurityConfig.class, DatasetRegistry.class, SecurityConfigTest.TestSecurityBeans.class})
@TestPropertySource(properties = "geumcheon.security.cors.allowed-origins=http://localhost:3000")
class SecurityConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AdminUploadStore adminUploadStore;

    @MockitoBean
    private ExcelUploadParser excelUploadParser;

    @MockitoBean
    private PublicDataCollectorService collectorService;

    @MockitoBean
    private JdbcPublicDataRepository repository;

    @BeforeEach
    void setUp() {
        when(repository.listStores()).thenReturn(List.of());
    }

    @Test
    void publicApiAllowsAnonymousAccess() throws Exception {
        mockMvc.perform(get("/api/public/stores"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void adminApiRejectsAnonymousAccess() throws Exception {
        mockMvc.perform(get("/api/admin/datasets"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void adminApiAllowsAuthenticatedAccess() throws Exception {
        mockMvc.perform(get("/api/admin/datasets").with(httpBasic("admin", "secret-pass")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @TestConfiguration
    static class TestSecurityBeans {

        @Bean
        PasswordEncoder passwordEncoder() {
            return new BCryptPasswordEncoder();
        }

        @Bean
        UserDetailsService userDetailsService(PasswordEncoder passwordEncoder) {
            return new InMemoryUserDetailsManager(
                    User.withUsername("admin")
                            .password(passwordEncoder.encode("secret-pass"))
                            .roles("ADMIN")
                            .build()
            );
        }
    }
}
