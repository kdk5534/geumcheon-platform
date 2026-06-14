package kr.go.geumcheon.dataplatform.config;

import kr.go.geumcheon.dataplatform.admin.AdminUploadController;
import kr.go.geumcheon.dataplatform.admin.AdminUploadStore;
import kr.go.geumcheon.dataplatform.admin.ExcelUploadParser;
import kr.go.geumcheon.dataplatform.dataset.DatasetRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AdminUploadController.class)
@Import({SecurityConfig.class, DatasetRegistry.class})
@ActiveProfiles("mock")
class MockProfileSecurityConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AdminUploadStore adminUploadStore;

    @MockitoBean
    private ExcelUploadParser excelUploadParser;

    @Test
    void mockProfileStillRejectsAnonymousAdminRequests() throws Exception {
        mockMvc.perform(get("/api/admin/datasets"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void mockProfileStillAcceptsConfiguredBasicAuth() throws Exception {
        mockMvc.perform(get("/api/admin/datasets")
                        .with(SecurityMockMvcRequestPostProcessors.httpBasic("admin", "admin1234")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }
}
