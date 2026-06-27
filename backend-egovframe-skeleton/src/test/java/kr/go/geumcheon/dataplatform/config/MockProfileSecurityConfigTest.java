package kr.go.geumcheon.dataplatform.config;

import kr.go.geumcheon.dataplatform.admin.AdminUploadController;
import kr.go.geumcheon.dataplatform.admin.AdminSessionController;
import kr.go.geumcheon.dataplatform.admin.AdminUploadStore;
import kr.go.geumcheon.dataplatform.admin.ExcelUploadParser;
import kr.go.geumcheon.dataplatform.admin.GovernanceStore;
import kr.go.geumcheon.dataplatform.admin.StagedUploadApprovalService;
import kr.go.geumcheon.dataplatform.admin.StagedUploadStore;
import kr.go.geumcheon.dataplatform.dataset.DatasetRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = {AdminUploadController.class, AdminSessionController.class})
@Import({SecurityConfig.class, DatasetRegistry.class, MockProfileSecurityConfigTest.TestSecurityBeans.class})
@ActiveProfiles("mock")
class MockProfileSecurityConfigTest {

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

    @Test
    void mockProfileStillRejectsAnonymousAdminRequests() throws Exception {
        mockMvc.perform(get("/api/admin/datasets"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void mockProfileAcceptsConfiguredSessionLogin() throws Exception {
        MvcResult login = mockMvc.perform(post("/api/admin/auth/login")
                        .contentType("application/json")
                        .content("{\"loginId\":\"admin\",\"password\":\"admin1234\"}"))
                .andExpect(status().isOk())
                .andReturn();
        MockHttpSession session = (MockHttpSession) login.getRequest().getSession(false);

        mockMvc.perform(get("/api/admin/datasets").session(session))
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
                            .password(passwordEncoder.encode("admin1234"))
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
