import FieldPane from '../components/fields/FieldPane'
import FilterPanel from '../components/filters/FilterPanel'
import VisualCard from '../components/builder/VisualCard'
import { useStore } from '../store/useStore'

export default function ReportBuilder() {
  const visuals = useStore((s) => s.visuals)
  const addVisual = useStore((s) => s.addVisual)

  return (
    <div className="h-[calc(100vh-32px)]">
      <div className="grid h-full grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-2">
          <FieldPane />
        </div>

        <div className="col-span-12 xl:col-span-8">
          <div className="mb-4 flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-soft">
            <div>
              <h1 className="text-xl font-semibold text-slate-800">Report Builder</h1>
              <p className="text-sm text-slate-500">Create visuals by dragging fields into zones</p>
            </div>

            <button
              onClick={addVisual}
              className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Add Visual
            </button>
          </div>

          <div className="max-h-[calc(100vh-140px)] space-y-4 overflow-y-auto pr-1">
            {visuals.length === 0 ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white text-slate-400 shadow-soft">
                Click <span className="mx-1 font-semibold">Add Visual</span> to start building
              </div>
            ) : (
              visuals.map((visual) => <VisualCard key={visual.id} visual={visual} />)
            )}
          </div>
        </div>

        <div className="col-span-12 xl:col-span-2">
          <FilterPanel />
        </div>
      </div>
    </div>
  )
}
