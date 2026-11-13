import Map from "../components/map";

export default function MapPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 text-white">
              💧
            </div>

            <div>
              <div className="text-sm font-extrabold text-blue-700">
                DistrictLens
              </div>

              <div className="text-[9px] text-slate-500">
                by Tanza Water District
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="text-3xl font-extrabold text-slate-900">
          Public Map
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          See affected barangays and current water service incidents in Tanza.
        </p>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <Map />
        </div>
      </section>
    </main>
  );
}