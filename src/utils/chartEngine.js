export const aggregateValue = (rows, field, aggregation) => {
  const numeric = rows.map((r) => Number(r[field])).filter((v) => !isNaN(v))

  switch (aggregation) {
    case 'sum':
      return numeric.reduce((a, b) => a + b, 0)
    case 'avg':
      return numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : 0
    case 'count':
      return rows.length
    case 'distinctCount':
      return new Set(rows.map((r) => r[field])).size
    case 'min':
      return numeric.length ? Math.min(...numeric) : 0
    case 'max':
      return numeric.length ? Math.max(...numeric) : 0
    default:
      return numeric.reduce((a, b) => a + b, 0)
  }
}

export const buildVisualData = ({ rows, xField, yField, legendField, aggregation = 'sum', sortField, sortDirection = 'asc' }) => {
  if (!rows?.length || !xField || !yField) return []

  const map = new Map()

  for (const row of rows) {
    const x = row[xField] ?? '(Blank)'
    const legend = legendField ? row[legendField] ?? '(Blank)' : '__single__'
    const key = `${x}|||${legend}`

    if (!map.has(key)) {
      map.set(key, { x, legend, bucketRows: [] })
    }
    map.get(key).bucketRows.push(row)
  }

  const grouped = [...map.values()].map((item) => ({
    x: item.x,
    legend: item.legend,
    value: aggregateValue(item.bucketRows, yField, aggregation),
  }))

  if (!legendField) {
    const collapsed = {}
    grouped.forEach((g) => {
      if (!collapsed[g.x]) collapsed[g.x] = { x: g.x, value: 0 }
      collapsed[g.x].value += g.value
    })

    const arr = Object.values(collapsed)
    const sField = sortField === yField ? 'value' : 'x'

    arr.sort((a, b) => {
      if (sField === 'value') {
        return sortDirection === 'asc' ? a.value - b.value : b.value - a.value
      }
      return sortDirection === 'asc'
        ? String(a.x).localeCompare(String(b.x))
        : String(b.x).localeCompare(String(a.x))
    })

    return arr
  }

  const legends = [...new Set(grouped.map((g) => g.legend))]
  const byX = {}

  grouped.forEach((g) => {
    if (!byX[g.x]) byX[g.x] = { x: g.x }
    byX[g.x][g.legend] = g.value
  })

  const arr = Object.values(byX).map((row) => {
    legends.forEach((l) => {
      if (!(l in row)) row[l] = 0
    })
    return row
  })

  arr.sort((a, b) =>
    sortDirection === 'asc'
      ? String(a.x).localeCompare(String(b.x))
      : String(b.x).localeCompare(String(a.x)),
  )

  return arr
}

export const getLegendKeys = (data) => {
  if (!data?.length) return []
  return Object.keys(data[0]).filter((k) => k !== 'x' && k !== 'value')
}
