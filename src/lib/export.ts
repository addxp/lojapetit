export async function exportXlsx(
  filename: string,
  sheetName: string,
  rows: Record<string, string | number>[]
) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function exportPdf(
  filename: string,
  title: string,
  subtitle: string,
  columns: string[],
  rows: (string | number)[][]
) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: columns.length > 6 ? "landscape" : "portrait" });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(10);
  doc.text(subtitle, 14, 23);
  autoTable(doc, {
    head: [columns],
    body: rows.map((r) => r.map(String)),
    startY: 28,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [53, 106, 77] },
  });
  doc.save(`${filename}.pdf`);
}
