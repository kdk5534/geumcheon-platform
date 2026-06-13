package kr.go.geumcheon.dataplatform.admin;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class CsvParser {

    public String decode(byte[] bytes) {
        String utf8Text = decodeText(bytes, StandardCharsets.UTF_8);
        if (!looksMisdecoded(utf8Text)) {
            return stripBom(utf8Text);
        }

        String koreanText = decodeText(bytes, Charset.forName("MS949"));
        return stripBom(looksMisdecoded(koreanText) ? utf8Text : koreanText);
    }

    public List<List<String>> parse(String text) {
        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false;

        for (int index = 0; index < text.length(); index += 1) {
            char current = text.charAt(index);
            char next = index + 1 < text.length() ? text.charAt(index + 1) : '\0';

            if (current == '"' && quoted && next == '"') {
                cell.append('"');
                index += 1;
            } else if (current == '"') {
                quoted = !quoted;
            } else if (current == ',' && !quoted) {
                row.add(cell.toString().trim());
                cell.setLength(0);
            } else if ((current == '\n' || current == '\r') && !quoted) {
                if (current == '\r' && next == '\n') {
                    index += 1;
                }
                row.add(cell.toString().trim());
                addRowIfNotEmpty(rows, row);
                row = new ArrayList<>();
                cell.setLength(0);
            } else {
                cell.append(current);
            }
        }

        if (!row.isEmpty() || cell.length() > 0) {
            row.add(cell.toString().trim());
            addRowIfNotEmpty(rows, row);
        }

        return rows;
    }

    private String decodeText(byte[] bytes, Charset charset) {
        try {
            return charset.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes))
                    .toString();
        } catch (CharacterCodingException error) {
            return new String(bytes, charset);
        }
    }

    private boolean looksMisdecoded(String text) {
        return text.indexOf('\uFFFD') >= 0;
    }

    private String stripBom(String text) {
        return text.startsWith("\uFEFF") ? text.substring(1) : text;
    }

    private void addRowIfNotEmpty(List<List<String>> rows, List<String> row) {
        boolean hasValue = row.stream().anyMatch(value -> !value.isBlank());
        if (hasValue) {
            rows.add(row);
        }
    }
}
