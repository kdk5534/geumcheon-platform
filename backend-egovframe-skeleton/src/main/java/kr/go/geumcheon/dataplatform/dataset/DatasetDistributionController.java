package kr.go.geumcheon.dataplatform.dataset;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/public/datasets")
public class DatasetDistributionController {

    private final DatasetRegistry datasetRegistry;

    public DatasetDistributionController(DatasetRegistry datasetRegistry) {
        this.datasetRegistry = datasetRegistry;
    }

    @GetMapping("/{datasetKey}/download")
    public void download(@PathVariable String datasetKey) {
        datasetRegistry.getRequired(datasetKey);
        DatasetAccessPolicy policy = DatasetAccessPolicyRegistry.get(datasetKey);
        if (!policy.fileDownloadAllowed()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "File download is disabled until redistribution terms are confirmed."
            );
        }
        throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "Dataset file export is not implemented.");
    }

    @GetMapping("/{datasetKey}/external-api")
    public void externalApi(@PathVariable String datasetKey) {
        datasetRegistry.getRequired(datasetKey);
        DatasetAccessPolicy policy = DatasetAccessPolicyRegistry.get(datasetKey);
        if (!policy.externalApiRedistributionAllowed()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "External API redistribution is disabled until terms are confirmed."
            );
        }
        throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "External redistribution API is not implemented.");
    }
}
