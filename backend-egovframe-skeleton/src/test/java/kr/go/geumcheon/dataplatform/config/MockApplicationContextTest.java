package kr.go.geumcheon.dataplatform.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("mock")
class MockApplicationContextTest {

    @Test
    void applicationContextStartsWithMockProfile() {
    }
}
