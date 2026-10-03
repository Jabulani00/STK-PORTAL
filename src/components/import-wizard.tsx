import { useState } from 'react'
import { toCsv } from '../lib/csv.ts'
import { downloadTextFile } from '../utils/download.ts'
import { Button } from './ui/button.tsx'
import { Callout } from './callout.tsx'

interface PreviewRow {
  rowNumber: number
  label: string
  errors: string[]
}

export function ImportWizard({
  templateHref,
  templateFilename,
  templateColumns,
  onParse,
  onConfirm,
}: {
  templateHref: string
  templateFilename: string
  templateColumns: readonly string[]
  onParse: (csv: string) => { headerError: string | null; rows: PreviewRow[] }
  onConfirm: (csv: string) => number
}) {
  const [fileName, setFileName] = useState('')
  const [csv, setCsv] = useState('')
  const [headerError, setHeaderError] = useState<string | null>(null)
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [imported, setImported] = useState<number | null>(null)
  const validCount = rows.filter((row) => row.errors.length === 0).length

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <a
          className="inline-flex h-11 items-center rounded-md border border-line bg-white px-4 text-sm font-semibold text-navy"
          href={templateHref}
          download={templateFilename}
        >
          Download template
        </a>
        <Button
          variant="outline"
          onClick={() => downloadTextFile(templateFilename, toCsv([Array.from(templateColumns)]), 'text/csv')}
        >
          Download blank CSV
        </Button>
      </div>
      <label className="grid gap-1.5 text-sm font-semibold" htmlFor="import-file">
        Upload CSV
        <input
          id="import-file"
          className="font-normal"
          type="file"
          accept=".csv,text/csv"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            if (!file) return
            const text = await file.text()
            const preview = onParse(text)
            setFileName(file.name)
            setCsv(text)
            setHeaderError(preview.headerError)
            setRows(preview.rows)
            setImported(null)
          }}
        />
      </label>
      {fileName ? <p className="text-sm text-muted">Selected file: {fileName}</p> : null}
      {headerError ? <Callout tone="danger">{headerError}</Callout> : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Import preview</caption>
            <thead className="bg-canvas text-xs text-muted uppercase">
              <tr>
                <th scope="col" className="px-4 py-3">Row</th>
                <th scope="col" className="px-4 py-3">Record</th>
                <th scope="col" className="px-4 py-3">Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.rowNumber} className="border-t border-line">
                  <td className="px-4 py-3">{row.rowNumber}</td>
                  <td className="px-4 py-3">{row.label}</td>
                  <td className="px-4 py-3">
                    {row.errors.length === 0 ? (
                      <span className="font-semibold text-success">Ready</span>
                    ) : (
                      <span className="text-danger">{row.errors.join(' ')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {rows.length > 0 && !headerError ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={validCount === 0}
            onClick={() => {
              const count = onConfirm(csv)
              setImported(count)
            }}
          >
            Import {validCount} valid {validCount === 1 ? 'row' : 'rows'}
          </Button>
          <p className="text-sm text-muted">Invalid rows are skipped. Nothing invalid is saved.</p>
        </div>
      ) : null}
      {imported !== null ? (
        <Callout tone="success">
          Imported {imported} {imported === 1 ? 'record' : 'records'}. An audit entry was added.
        </Callout>
      ) : null}
    </div>
  )
}
