import { useState } from 'react'
import * as XLSX from 'xlsx'
import { useStore } from '../store/useStore'

const detectType = (values) => {
  let numberCount = 0
  let dateCount = 0
  let boolCount = 0
  let nonEmpty = 0

  for (const v of values) {
    if (v === null || v === undefined || v === '') continue
    nonEmpty++
    if (!isNaN(Number(v))) numberCount++
    if (!isNaN(Date.parse(v))) dateCount++
    if (String(v).toLowerCase() === 'true' || String(v).toLowerCase() === 'false') boolCount++
  }

  if (nonEmpty === 0) return 'string'
  if (boolCount === nonEmpty) return 'boolean'
  if (numberCount === nonEmpty) return 'number'
  if (dateCount === nonEmpty) return 'date'
  return 'string'
}

const sanitizeColumns = (rows) => {
  if (!rows.length) return { rows: [], columns: [], types: {} }

  const originalColumns = Object.keys(rows[0])
  const used = {}
  const renamedMap = {}

  const safeColumns = originalColumns.map((col) => {
    const base = (col?.trim() || 'Column').replace(/\s+/g, ' ')
    if (!used[base]) {
      used[base] = 1
      renamedMap[col] = base
      return base
    }
    const next = `${base}_${used[base]++}`
    renamedMap[col] = next
    return next
  })

  const normalizedRows = rows.map((row) => {
    const next = {}
    originalColumns.forEach((col) => {
      next[renamedMap[col]] = row[col]
    })
    return next
  })

  const types = {}
  safeColumns.forEach((col) => {
    types[col] = detectType(normalizedRows.map((r) => r[col]))
  })

  return { rows: normalizedRows, columns: safeColumns, types }
}

export default function DataSource() {
  const setData = useStore((s) => s.setData)
  const [preview, setPreview] = useState([])
  const [sheets, setSheets] = useState([])
  const [workbook, setWorkbook] = useState(null)
  const [selectedSheet, setSelectedSheet] = useState('')

  const loadSheet = (wb, sheetName) => {
    const ws = wb.Sheets[sheetName]
    const json = XLSX.utils.sheet_to_json(ws, { defval: '' })
    const { rows, columns, types } = sanitizeColumns(json)
    setPreview(rows.slice(0, 8))
    setData(rows, columns, types)
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    setWorkbook(wb)
    setSheets(wb.SheetNames)
    setSelectedSheet(wb.SheetNames[0])
    loadSheet(wb, wb.SheetNames[0])
  }

  const handleSheetChange = (sheetName) => {
    setSelectedSheet(sheetName)
    if (workbook) loadSheet(workbook, sheetName)
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
        <h1 className="text-2xl font-bold text-slate-900">Data Source</h1>
        <p className="mt-2 text-slate-500">Upload Excel or CSV and start building visuals instantly</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-5">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Upload file</label>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
          </div>

          <div className="rounded-2xl border border-slate-200 p-5">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Workbook sheet</label>
            <select
              value={selectedSheet}
              onChange={(e) => handleSheetChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              disabled={!sheets.length}
            >
              {!sheets.length && <option>No workbook loaded</option>}
              {sheets.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-slate-800">Preview</h2>
        <p className="mt-1 text-sm text-slate-500">First few rows from the active sheet</p>

        <div className="mt-4 overflow-auto">
          {preview.length ? (
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {Object.keys(preview[0]).map((col) => (
                    <th key={col} className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    {Object.values(row).map((val, i) => (
                      <td key={i} className="px-4 py-3 text-slate-700">
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex h-48 items-center justify-center text-slate-400">Upload a dataset to preview it here</div>
          )}
        </div>
      </div>
    </div>
  )
}
