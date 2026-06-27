package kr.go.geumcheon.dataplatform.dataset;

import java.time.Duration;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import kr.go.geumcheon.dataplatform.dataset.DatasetOperationalPolicy.TermsStatus;

import static kr.go.geumcheon.dataplatform.dataset.DatasetOperationalPolicy.OwnerStatus.ASSIGNED;
import static kr.go.geumcheon.dataplatform.dataset.DatasetOperationalPolicy.PrivacyRisk.LOW;
import static kr.go.geumcheon.dataplatform.dataset.DatasetOperationalPolicy.PrivacyRisk.REVIEW_REQUIRED;

public final class DatasetPolicyRegistry {

    private static final double DEFAULT_MAX_CHANGE_RATIO = 0.30d;
    private static final TermsStatus DEFAULT_TERMS_STATUS = TermsStatus.REVIEW_REQUIRED;
    private static final LocalDate POLICY_EFFECTIVE_FROM = LocalDate.of(2026, 6, 19);
    private static final LocalDate POLICY_REVIEW_DUE = LocalDate.of(2026, 9, 19);
    private static final String DATA_OWNER_ROLE = "데이터정책 담당부서";
    private static final String SYSTEM_OWNER_ROLE = "플랫폼 운영 담당";
    private static final String APPROVAL_OWNER_ROLE = "정보보안·개인정보 담당";
    private static final Set<String> UNCONFIRMED_SOURCE_KEYS = Set.of(
            "heat-shelters", "welfare-facilities", "civil-defense-shelters",
            "hospitals", "pharmacies", "childcare-centers"
    );
    private static final Set<String> CONFIRMED_TERMS_KEYS = Set.of("heat-shelters", "ev-chargers");
    private static final Map<String, DatasetOperationalPolicy> POLICIES = buildPolicies();

    private DatasetPolicyRegistry() {
    }

    public static DatasetOperationalPolicy getRequired(String datasetKey) {
        DatasetOperationalPolicy policy = POLICIES.get(datasetKey);
        if (policy == null) throw new IllegalArgumentException("Missing dataset policy: " + datasetKey);
        return policy;
    }

    public static List<DatasetOperationalPolicy> listAll() {
        return List.copyOf(POLICIES.values());
    }

    private static Map<String, DatasetOperationalPolicy> buildPolicies() {
        Map<String, DatasetOperationalPolicy> policies = new LinkedHashMap<>();
        add(policies, policy("facilities", "id", 1, 100_000, Duration.ofDays(30), Duration.ofDays(90), false, REVIEW_REQUIRED));
        add(policies, policy("stores", "bizesId", 1, 100_000, Duration.ofDays(1), Duration.ofDays(30), true, LOW));
        add(policies, policy("air-quality", "stationName+measuredAt", 1, 100, Duration.ofHours(3), Duration.ofDays(7), true, LOW));
        add(policies, policy("bike-stations", "stationId", 1, 10_000, Duration.ofDays(210), Duration.ofDays(730), true, LOW));
        add(policies, policy("cctv-stations", "sourceOriginalId|name+address", 1, 50_000, Duration.ofDays(30), Duration.ofDays(180), false, LOW));
        add(policies, policy("parking-lots", "sourceOriginalId|name+address", 1, 10_000, Duration.ofDays(7), Duration.ofDays(90), true, LOW));
        add(policies, policy("parking-spaces", "sourceOriginalId+coordinate", 1, 50_000, Duration.ofDays(365), Duration.ofDays(3650), false, LOW));
        add(policies, policy("population", "areaName+baseDate", 1, 10_000, Duration.ofDays(45), Duration.ofDays(180), true, REVIEW_REQUIRED));
        add(policies, policy("public-wifi", "sourceOriginalId|name+address", 1, 50_000, Duration.ofDays(1), Duration.ofDays(180), true, LOW));
        add(policies, policy("heat-shelters", "sourceOriginalId|name+address", 1, 10_000, Duration.ofDays(365), Duration.ofDays(730), false, LOW));
        add(policies, policy("school-zones", "name+address", 1, 10_000, Duration.ofDays(210), Duration.ofDays(730), true, LOW));
        add(policies, policy("ev-chargers", "operator+stationName+chargerId", 1, 20_000, Duration.ofDays(365), Duration.ofDays(730), true, LOW));
        add(policies, policy("welfare-facilities", "sourceOriginalId|name+address", 1, 10_000, Duration.ofDays(30), Duration.ofDays(365), true, LOW));
        add(policies, policy("civil-defense-shelters", "sourceOriginalId|name+address", 1, 10_000, Duration.ofDays(30), Duration.ofDays(365), true, LOW));
        add(policies, policy("hospitals", "sourceOriginalId|name+address", 1, 10_000, Duration.ofDays(7), Duration.ofDays(180), true, LOW));
        add(policies, policy("pharmacies", "sourceOriginalId|name+address", 1, 10_000, Duration.ofDays(7), Duration.ofDays(180), true, LOW));
        add(policies, policy("childcare-centers", "sourceOriginalId|name+address", 1, 10_000, Duration.ofDays(30), Duration.ofDays(365), true, LOW));
        // Phase 1 — 안전·환경 신규
        add(policies, policy("street-lights", "name+address", 1, 10000, Duration.ofDays(365), Duration.ofDays(1825), true, LOW));
        add(policies, policy("fire-hydrants", "name+address", 1, 2000, Duration.ofDays(365), Duration.ofDays(1825), true, LOW));
        // Phase 1 — 생활편의·문화 신규
        add(policies, policy("museums", "name+address", 1, 200, Duration.ofDays(365), Duration.ofDays(1825), true, LOW));
        add(policies, policy("libraries", "name+address", 1, 500, Duration.ofDays(365), Duration.ofDays(1825), true, LOW));
        add(policies, policy("parks", "name+address", 1, 1000, Duration.ofDays(365), Duration.ofDays(1825), true, LOW));
        // Phase 1 — 산업·상권(G밸리 특화) 신규
        add(policies, policy("traditional-markets", "name+address", 1, 500, Duration.ofDays(365), Duration.ofDays(1825), true, LOW));
        add(policies, policy("knowledge-industry-center", "name+address", 1, 500, Duration.ofDays(365), Duration.ofDays(1825), true, LOW));
        return Map.copyOf(policies);
    }

    private static DatasetOperationalPolicy policy(
            String key,
            String naturalKey,
            int minimumRows,
            int maximumRows,
            Duration freshnessSla,
            Duration retention,
            boolean enabled,
            DatasetOperationalPolicy.PrivacyRisk privacyRisk
    ) {
        return new DatasetOperationalPolicy(
                key,
                naturalKey,
                minimumRows,
                maximumRows,
                DEFAULT_MAX_CHANGE_RATIO,
                freshnessSla,
                retention,
                enabled,
                UNCONFIRMED_SOURCE_KEYS.contains(key)
                        ? DatasetOperationalPolicy.TechnicalStatus.DRAFT
                        : DatasetOperationalPolicy.TechnicalStatus.PROVISIONALLY_APPROVED,
                POLICY_EFFECTIVE_FROM,
                POLICY_REVIEW_DUE,
                CONFIRMED_TERMS_KEYS.contains(key) ? TermsStatus.CONFIRMED : DEFAULT_TERMS_STATUS,
                privacyRisk,
                ASSIGNED,
                DATA_OWNER_ROLE,
                SYSTEM_OWNER_ROLE,
                APPROVAL_OWNER_ROLE
        );
    }

    private static void add(Map<String, DatasetOperationalPolicy> policies, DatasetOperationalPolicy policy) {
        if (policies.put(policy.datasetKey(), policy) != null) {
            throw new IllegalStateException("Duplicate dataset policy: " + policy.datasetKey());
        }
    }
}
