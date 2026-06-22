import { CSV_EXTENSIONS, EXCEL_EXTENSIONS } from "../core/state.js";

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows.filter((currentRow) => currentRow.some((value) => value !== ""));
}

export function fileExtension(file) {
  const name = String(file?.name || "").toLowerCase();
  const dotIndex = name.lastIndexOf(".");
  return dotIndex >= 0 ? name.slice(dotIndex + 1) : "";
}

export function isCsvFile(file) {
  return CSV_EXTENSIONS.has(fileExtension(file)) || file?.type === "text/csv";
}

export function isExcelFile(file) {
  const extension = fileExtension(file);
  return EXCEL_EXTENSIONS.has(extension)
    || file?.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    || file?.type === "application/vnd.ms-excel";
}

export function getUploadFileKind(file) {
  if (isCsvFile(file)) return "csv";
  if (isExcelFile(file)) return "excel";
  return "unsupported";
}
