export function buildCommercialMatrix(commercial = {}, industries = [], dongs = []) {
  const rows = dongs.map((dong) => {
    const values = industries.map((industry) => {
      const match = (commercial[industry]?.byDong || []).find((item) => item.name === dong);
      return Number(match?.count || 0);
    });
    return { dong, values, total: values.reduce((sum, value) => sum + value, 0) };
  });
  const columnTotals = industries.map((_, index) =>
    rows.reduce((sum, row) => sum + row.values[index], 0)
  );
  return {
    industries: [...industries],
    rows,
    columnTotals,
    grandTotal: columnTotals.reduce((sum, value) => sum + value, 0),
  };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToCsv(headers = [], rows = []) {
  return `\uFEFF${[headers, ...rows]
    .map((line) => line.map(csvCell).join(","))
    .join("\r\n")}`;
}

export function matrixToCsv(matrix) {
  const lines = [
    ["행정동", ...matrix.industries, "합계"],
    ...matrix.rows.map((row) => [row.dong, ...row.values, row.total]),
    ["소계", ...matrix.columnTotals, matrix.grandTotal],
  ];
  return rowsToCsv(lines[0], lines.slice(1));
}

export function csvDataUrl(csv) {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}
