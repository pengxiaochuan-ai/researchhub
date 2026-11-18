export function pmcTableRows(table) {
  let spanIndex = 0;
  return (table?.rows || []).map(row => row.map(text => {
    const [rowSpan, colSpan] = table.spans?.[spanIndex++] || [1, 1];
    return { text, rowSpan, colSpan };
  }));
}
