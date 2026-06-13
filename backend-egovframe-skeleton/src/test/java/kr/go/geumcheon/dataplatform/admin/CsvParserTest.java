package kr.go.geumcheon.dataplatform.admin;

import org.junit.jupiter.api.Test;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CsvParserTest {

    private final CsvParser parser = new CsvParser();

    @Test
    void decodeRemovesBomAndParsesQuotedCsv() {
        byte[] bytes = ("\uFEFFname,address\n\"Geumcheon, Cafe\",\"Siheung-daero 1\"")
                .getBytes(StandardCharsets.UTF_8);

        List<List<String>> rows = parser.parse(parser.decode(bytes));

        assertThat(rows).containsExactly(
                List.of("name", "address"),
                List.of("Geumcheon, Cafe", "Siheung-daero 1")
        );
    }

    @Test
    void decodeFallsBackToMs949WhenUtf8LooksBroken() {
        byte[] bytes = "가산동,24000".getBytes(Charset.forName("MS949"));

        String decoded = parser.decode(bytes);

        assertThat(decoded).isEqualTo("가산동,24000");
    }
}
