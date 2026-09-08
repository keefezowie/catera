export function csvText(rows: unknown[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((cell) => {
            let v = String(cell ?? "");
            if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
            return '"' + v.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}
export function escapeHtml(value: unknown) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
