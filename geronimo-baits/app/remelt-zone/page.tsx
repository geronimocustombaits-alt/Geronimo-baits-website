export default function RemeltZonePage() {
  return (
    <main
      className="min-h-screen overflow-hidden bg-black bg-cover bg-center text-white"
      style={{ backgroundImage: "url('/Background rev 2.png')" }}
    >
      <div className="min-h-screen bg-black/75 px-6 py-24">
        <a
          href="/"
          className="fixed left-6 top-6 z-50 rounded-xl border border-green-500 bg-black/80 px-5 py-2 font-bold text-green-500 backdrop-blur-md transition hover:bg-green-500 hover:text-black"
        >
          ← HOME
        </a>

        <section className="mx-auto max-w-6xl rounded-3xl border border-green-500/30 bg-black/80 p-8 text-center shadow-2xl shadow-green-500/10">
          <p className="text-xl font-black tracking-[0.4em] text-green-500">
            ♻️ REMELT SERIES ♻️
          </p>

          <h1 className="mt-6 text-6xl font-black md:text-8xl">
            REMELT ZONE
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-xl text-gray-300">
            Recovered. Remelted. Redeployed. Unique blends, random colour runs,
            and limited bait drops built to hunt.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <a
              href="#drops"
              className="rounded-2xl bg-green-500 px-8 py-4 font-black text-black transition hover:scale-105 hover:bg-green-400"
            >
              VIEW CURRENT DROPS
            </a>

            <a
              href="https://wa.me/27675380595?text=Hi%20Geronimo%20Baits%2C%20I%20want%20to%20order%20remelts."
              target="_blank"
              className="rounded-2xl border border-green-500 px-8 py-4 font-black text-green-500 transition hover:bg-green-500 hover:text-black"
            >
              WHATSAPP REMELTS
            </a>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-6xl rounded-3xl border border-yellow-500/30 bg-black/80 p-8 text-center">
          <h2 className="text-3xl font-black text-yellow-400">
            ⚠️ LIMITED RUN BAITS
          </h2>

          <p className="mx-auto mt-4 max-w-3xl text-gray-300">
            No two remelt batches are exactly the same. Colours may vary, stock
            is limited, and once a drop is gone — it is gone.
          </p>
        </section>

        <section
          id="drops"
          className="mx-auto mt-10 grid max-w-6xl gap-6 md:grid-cols-3"
        >
          {[
            {
              name: "SCOUT REMELT PACK",
              packs: "3 RANDOM PACKS",
              price: "R135",
              text: "A quick-hit remelt selection for weekend sessions.",
            },
            {
              name: "HUNTER REMELT PACK",
              packs: "5 RANDOM PACKS",
              price: "R220",
              text: "Best value for anglers who want variety.",
            },
            {
              name: "WARCRATE REMELT PACK",
              packs: "8 RANDOM PACKS",
              price: "R340",
              text: "Full attack mode. Random colours. Maximum value.",
            },
          ].map((drop) => (
            <div
              key={drop.name}
              className="rounded-3xl border border-green-500/30 bg-black/80 p-8 text-center transition hover:-translate-y-2 hover:border-green-500 hover:shadow-xl hover:shadow-green-500/20"
            >
              <p className="text-4xl">♻️</p>

              <h3 className="mt-5 text-2xl font-black text-green-500">
                {drop.name}
              </h3>

              <p className="mt-3 font-bold text-white">{drop.packs}</p>

              <p className="mt-4 text-4xl font-black text-green-500">
                {drop.price}
              </p>

              <p className="mt-4 text-gray-400">{drop.text}</p>

              <a
                href={`https://wa.me/27675380595?text=${encodeURIComponent(
                  `Hi Geronimo Baits, I want to order the ${drop.name}.`
                )}`}
                target="_blank"
                className="mt-8 block rounded-xl bg-green-500 px-5 py-3 font-black text-black transition hover:scale-105 hover:bg-green-400"
              >
                HUNT THIS DROP →
              </a>
            </div>
          ))}
        </section>

        <section className="mx-auto mt-10 max-w-6xl rounded-3xl border border-green-500/30 bg-black/80 p-8 text-center">
          <p className="text-lg font-black tracking-[0.35em] text-green-500">
            ♻️ RECOVERED. REMELTED. REDEPLOYED. ♻️
          </p>

          <h2 className="mt-6 text-4xl font-black">
            WE MAKE IT. FISH TAKE IT.
          </h2>
        </section>
      </div>
    </main>
  );
}