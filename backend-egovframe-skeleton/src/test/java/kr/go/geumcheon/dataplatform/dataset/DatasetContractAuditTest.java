package kr.go.geumcheon.dataplatform.dataset;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DatasetContractAuditTest {

    @Test
    void currentRegistryHasNoBlockingRepresentableContractIssues() {
        List<DatasetContractAudit.ContractIssue> issues = DatasetContractAudit.audit(new DatasetRegistry().listAll());

        assertThat(issues).noneMatch(DatasetContractAudit.ContractIssue::blocking);
        assertThat(issues)
                .filteredOn(issue -> "sourceContract".equals(issue.field()))
                .isEmpty();
    }

    @Test
    void publicUnconfirmedSourceIsBlocking() {
        DatasetDefinition candidate = new DatasetDefinition(
                "candidate", "후보", "생활", "기관", "수시", "소스 미확정",
                true, "API", false, false, true,
                List.of("name"), List.of(new DatasetFieldDefinition("name", "이름")),
                "https://example.test/detail", "POINT", "EXAMPLE_API_KEY", "생활지도"
        );

        assertThat(DatasetContractAudit.audit(List.of(candidate)))
                .anySatisfy(issue -> {
                    assertThat(issue.field()).isEqualTo("sourceContract");
                    assertThat(issue.blocking()).isTrue();
                });
    }
}
