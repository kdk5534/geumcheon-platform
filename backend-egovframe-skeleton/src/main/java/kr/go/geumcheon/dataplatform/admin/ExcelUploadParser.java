package kr.go.geumcheon.dataplatform.admin;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.FormulaEvaluator;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Component
public class ExcelUploadParser {

    private static final int MAX_ROWS = 10_000;
    private static final int MAX_COLUMNS = 100;

    public ParsedExcel parse(byte[] content) {
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(content))) {
            if (workbook.getNumberOfSheets() == 0) {
                return new ParsedExcel(List.of(), List.of("Excel 워크북에 시트가 없습니다."));
            }

            Sheet sheet = workbook.getSheetAt(0);
            DataFormatter formatter = new DataFormatter();
            FormulaEvaluator evaluator = workbook.getCreationHelper().createFormulaEvaluator();
            List<List<String>> rows = new ArrayList<>();
            List<String> warnings = new ArrayList<>();
            int lastRow = Math.min(sheet.getLastRowNum(), MAX_ROWS - 1);
            boolean truncatedRows = sheet.getLastRowNum() >= MAX_ROWS;
            boolean truncatedColumns = false;

            for (int rowIndex = 0; rowIndex <= lastRow; rowIndex += 1) {
                Row row = sheet.getRow(rowIndex);
                if (row == null) {
                    continue;
                }

                RowResult result = readRow(row, formatter, evaluator);
                truncatedColumns = truncatedColumns || result.truncatedColumns();
                List<String> values = result.values();
                trimTrailingEmptyCells(values);
                if (values.stream().anyMatch(value -> !value.isBlank())) {
                    rows.add(values);
                }
            }

            if (truncatedRows) {
                warnings.add("Excel 미리보기가 처음 " + MAX_ROWS + "행으로 제한되었습니다.");
            }
            if (truncatedColumns) {
                warnings.add("Excel 미리보기가 처음 " + MAX_COLUMNS + "열로 제한되었습니다.");
            }

            return new ParsedExcel(rows, warnings);
        } catch (IOException | RuntimeException error) {
            throw new IllegalArgumentException("Excel preview failed: " + error.getMessage(), error);
        }
    }

    private RowResult readRow(Row row, DataFormatter formatter, FormulaEvaluator evaluator) {
        int lastCell = Math.min(row.getLastCellNum(), MAX_COLUMNS);
        List<String> values = new ArrayList<>();
        boolean truncatedColumns = row.getLastCellNum() > MAX_COLUMNS;
        for (int cellIndex = 0; cellIndex < lastCell; cellIndex += 1) {
            Cell cell = row.getCell(cellIndex, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
            values.add(cell == null ? "" : formatter.formatCellValue(cell, evaluator).trim());
        }
        return new RowResult(values, truncatedColumns);
    }

    private void trimTrailingEmptyCells(List<String> values) {
        while (!values.isEmpty() && values.get(values.size() - 1).isBlank()) {
            values.remove(values.size() - 1);
        }
    }

    public record ParsedExcel(List<List<String>> rows, List<String> warnings) {
    }

    private record RowResult(List<String> values, boolean truncatedColumns) {
    }
}
