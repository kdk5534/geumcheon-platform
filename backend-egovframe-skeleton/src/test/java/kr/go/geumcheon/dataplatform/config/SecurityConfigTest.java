package kr.go.geumcheon.dataplatform.config;

import kr.go.geumcheon.dataplatform.admin.AdminUploadController;
import kr.go.geumcheon.dataplatform.admin.AdminSessionController;
import kr.go.geumcheon.dataplatform.admin.AdminUploadStore;
import kr.go.geumcheon.dataplatform.admin.ExcelUploadParser;
import kr.go.geumcheon.dataplatform.admin.GovernanceStore;
import kr.go.geumcheon.dataplatform.admin.StagedUploadApprovalService;
import kr.go.geumcheon.dataplatform.admin.StagedUploadStore;
import kr.go.geumcheon.dataplatform.dataset.DatasetRegistry;
import kr.go.geumcheon.dataplatform.publicdata.JdbcPublicDataRepository;
import kr.go.geumcheon.dataplatform.publicdata.MapQuery;
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
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

@WebMvcTest(controllers = {AdminUploadController.class, AdminSessionController.class, PublicDataController.class})
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
    private StagedUploadStore stagedUploadStore;

    @MockitoBean
    private GovernanceStore governanceStore;

    @MockitoBean
    private StagedUploadApprovalService stagedUploadApprovalService;

    @MockitoBean
    private PublicDataCollectorService collectorService;

    @MockitoBean
    private JdbcPublicDataRepository repository;

    @BeforeEach
    void setUp() {
        when(repository.listStores(MapQuery.defaults())).thenReturn(List.of());
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
        MvcResult login = mockMvc.perform(post("/api/admin/auth/login")
                        .contentType("application/json")
                        .content("{\"loginId\":\"admin\",\"password\":\"secret-pass\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.loginId").value("admin"))
                .andReturn();
        MockHttpSession session = (MockHttpSession) login.getRequest().getSession(false);

        mockMvc.perform(get("/api/admin/datasets").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void basicAuthenticationIsNoLongerAccepted() throws Exception {
        mockMvc.perform(get("/api/admin/datasets")
                        .header("Authorization", "Basic YWRtaW46c2VjcmV0LXBhc3M="))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void operatorCannotDirectlyCommitPublicUpload() throws Exception {
        mockMvc.perform(post("/api/admin/uploads/commit")
                        .with(user("operator").roles("OPERATOR"))
                        .with(csrf())
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void reviewerCanReachUploadCommitValidation() throws Exception {
        mockMvc.perform(post("/api/admin/uploads/commit")
                        .with(user("reviewer").roles("REVIEWER"))
                        .with(csrf())
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isBadRequest());
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

        @Bean
        LoginAttemptGuard loginAttemptGuard() {
            return new LoginAttemptGuard();
        }
    }
}
