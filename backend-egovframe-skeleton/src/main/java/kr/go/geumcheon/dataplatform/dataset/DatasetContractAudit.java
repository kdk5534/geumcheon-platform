package kr.go.geumcheon.dataplatform.dataset;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class DatasetContractAudit {

    private DatasetContractAudit() {
    }

    public static List<ContractIssue> audit(List<DatasetDefinition> definitions) {
        List<ContractIssue> issues = new ArrayList<>();
        Set<String> keys = new HashSet<>();

        for (DatasetDefinition definition : definitions) {
            String key = definition.datasetKey();
            if (isBlank(key) || !keys.add(key)) {
                issues.add(new ContractIssue(key, "datasetKey", "Dataset key is blank or duplicated.", true));
            }
            requireText(issues, key, "datasetName", definition.datasetName());
            requireText(issues, key, "domain", definition.domain());
            requireText(issues, key, "sourceName", definition.sourceName());
            requireText(issues, key, "refreshCycle", definition.refreshCycle());
            requireText(issues, key, "targetScreen", definition.targetScreen());

            if (definition.authKeyRequired()) {
                requireText(issues, key, "envVarName", definition.envVarName());
                requireText(issues, key, "spatialType", definition.spatialType());
                if (!"소스 미확정".equals(definition.apiStatus()) && !isHttpsDetailUrl(definition.sourceUrl())) {
                    issues.add(new ContractIssue(key, "sourceUrl", "Public API source URL must be an HTTPS detail page.", true));
                }
            }

            Set<String> fieldKeys = definition.allowedFields().stream().collect(java.util.stream.Collectors.toSet());
            for (String requiredField : definition.requiredFields()) {
                if (!fieldKeys.contains(requiredField)) {
                    issues.add(new ContractIssue(key, "requiredFields", "Required field is not defined: " + requiredField, true));
                }
            }

            if ("소스 미확정".equals(definition.apiStatus())) {
                issues.add(new ContractIssue(key, "sourceContract", "Official source contract is not confirmed.", definition.publicVisible()));
            }
        }

        return List.copyOf(issues);
    }

    private static void requireText(List<ContractIssue> issues, String key, String field, String value) {
        if (isBlank(value)) {
            issues.add(new ContractIssue(key, field, "Required contract value is missing.", true));
        }
    }

    private static boolean isHttpsDetailUrl(String value) {
        if (isBlank(value)) return false;
        try {
            URI uri = URI.create(value);
            String path = uri.getPath();
            return "https".equalsIgnoreCase(uri.getScheme())
                    && uri.getHost() != null
                    && path != null
                    && !path.isBlank()
                    && !"/".equals(path);
        } catch (IllegalArgumentException error) {
            return false;
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    public record ContractIssue(String datasetKey, String field, String message, boolean blocking) {
    }
}
