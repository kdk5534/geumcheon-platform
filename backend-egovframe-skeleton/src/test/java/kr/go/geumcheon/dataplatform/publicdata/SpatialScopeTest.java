package kr.go.geumcheon.dataplatform.publicdata;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SpatialScopeTest {

    @Test
    void defaultsToGeumcheonOnly() {
        MapQuery query = MapQuery.defaults();

        assertThat(query.spatialScopes()).containsExactly("GEUMCHEON");
    }

    @Test
    void acceptsGeumcheonAndBorderAreaForCommercialAnalysis() {
        MapQuery query = new MapQuery(
                null, null, null, null, null,
                "GEUMCHEON,BORDER_AREA",
                0, 200
        );

        assertThat(query.spatialScopes()).containsExactly("GEUMCHEON", "BORDER_AREA");
    }

    @Test
    void rejectsUnknownScope() {
        assertThatThrownBy(() -> SpatialScope.parseQuery("UNKNOWN"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}

