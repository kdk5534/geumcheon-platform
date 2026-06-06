package kr.go.geumcheon.dataplatform.admin;

import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ExcelUploadParserTest {

    private final ExcelUploadParser parser = new ExcelUploadParser();

    @Test
    void parseReadsFirstSheetAndTrimsBlankTrailingCells() throws Exception {
        byte[] content = createWorkbookBytes();

        ExcelUploadParser.ParsedExcel parsed = parser.parse(content);

        assertThat(parsed.rows()).containsExactly(
                List.of("id", "name", "latitude", "longitude"),
                List.of("FAC-001", "Geumcheon Health Center", "37.4568", "126.8954")
        );
        assertThat(parsed.warnings()).isEmpty();
    }

    private byte[] createWorkbookBytes() throws Exception {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            var firstSheet = workbook.createSheet("facilities");
            var header = firstSheet.createRow(0);
            header.createCell(0).setCellValue("id");
            header.createCell(1).setCellValue("name");
            header.createCell(2).setCellValue("latitude");
            header.createCell(3).setCellValue("longitude");

            var dataRow = firstSheet.createRow(1);
            dataRow.createCell(0).setCellValue("FAC-001");
            dataRow.createCell(1).setCellValue("Geumcheon Health Center");
            dataRow.createCell(2).setCellValue("37.4568");
            dataRow.createCell(3).setCellValue("126.8954");
            dataRow.createCell(4).setCellValue("");

            var ignoredSheet = workbook.createSheet("ignored");
            ignoredSheet.createRow(0).createCell(0).setCellValue("should-not-be-read");

            workbook.write(output);
            return output.toByteArray();
        }
    }
}
