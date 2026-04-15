export const applyGlobalFilters = (rows, filters) => {
  if (!rows?.length) return []
  if (!filters || Object.keys(filters).length === 0) return rows

  return rows.filter((row) =>
    Object.entries(filters).every(([field, filterValue]) => {
      if (
        filterValue === undefined ||
        filterValue === null ||
        filterValue === '' ||
        (Array.isArray(filterValue) && filterValue.length === 0)
      ) {
        return true
      }

      const cell = row[field]
      if (Array.isArray(filterValue)) return filterValue.includes(cell)
      return String(cell) === String(filterValue)
    }),
  )
}

export const getUniqueValues = (rows, field) => {
  return [...new Set(rows.map((r) => r[field]))]
    .filter((v) => v !== undefined && v !== null && v !== '')
    .sort((a, b) => String(a).localeCompare(String(b)))
}
