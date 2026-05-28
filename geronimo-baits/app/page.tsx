import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-black text-white">
      {/* NAVBAR */}
      <nav className="fixed left-0 top-0 z-50 w-full border-b border-green-500/20 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <h1 className="text-3xl font-black tracking-[0.2em]">
            GERONIMO <span className="text-green-500">BAITS</span>
          </h1>

          <div className="hidden gap-10 text-sm font-bold tracking-[0.2em] md:flex">
            <a href="#home" className="hover:text-green-500">HOME</a>
            <a href="#why" className="hover:text-green-500">WHY US</a>
            <a href="#gallery" className="hover:text-green-500">GALLERY</a>
            <a href="#contact" className="hover:text-green-500">CONTACT</a>
          </div>

          <a
            href="https://wa.me/27675380595"
            target="_blank"
            className="rounded-2xl border border-green-500 px-6 py-3 font-bold text-green-500 transition hover:bg-green-500 hover:text-black"
          >
            ORDER
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section
        id="home"
        className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cover bg-center px-6 text-center"
        style={{
          backgroundImage: "url('/Background rev 2.png')",
        }}
      >
        <div className="absolute inset-0 bg-black/70"></div>

        {/* GREEN SMOKE */}
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-500/20 blur-[120px]"></div>

        {/* FLOATING SPHERES */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[10%] top-[25%] h-3 w-3 animate-pulse rounded-full bg-green-500 shadow-[0_0_20px_6px_rgba(34,197,94,0.5)]">
            <div className="absolute -left-20 top-1/2 h-2 w-24 -translate-y-1/2 rounded-full bg-green-500/20 blur-md"></div>
          </div>

          <div className="absolute right-[15%] top-[40%] h-2 w-2 animate-pulse rounded-full bg-green-400 shadow-[0_0_18px_6px_rgba(74,222,128,0.5)]">
            <div className="absolute -left-16 top-1/2 h-2 w-20 -translate-y-1/2 rounded-full bg-green-400/20 blur-md"></div>
          </div>

          <div className="absolute left-[20%] bottom-[18%] h-2.5 w-2.5 animate-pulse rounded-full bg-green-500 shadow-[0_0_22px_7px_rgba(34,197,94,0.5)]">
            <div className="absolute -left-20 top-1/2 h-2 w-24 -translate-y-1/2 rounded-full bg-green-500/20 blur-md"></div>
          </div>
        </div>

        <div className="relative z-20 flex flex-col items-center">
          <p className="text-2xl tracking-[0.4em] text-green-500">
            BUILT TO HUNT
          </p>

          <h1 className="mt-6 text-6xl font-black md:text-8xl">
            GERONIMO BAITS
          </h1>

          <p className="mt-8 max-w-3xl text-xl text-gray-300">
            Handmade soft plastics built in South Africa and tested where it counts.
          </p>

          <div className="mt-12 flex flex-wrap justify-center gap-6">
            <a
              href="/baits"
              className="rounded-2xl bg-green-500 px-10 py-5 text-xl font-black text-black transition hover:scale-105 hover:bg-green-400"
            >
              VIEW BAITS
            </a>

            <a
              href="https://wa.me/27675380595"
              target="_blank"
              className="rounded-2xl border border-green-500 bg-black/40 px-10 py-5 text-xl font-black text-white backdrop-blur-md transition hover:bg-green-500 hover:text-black"
            >
              WHATSAPP US
            </a>
          </div>
        </div>
      </section>

      {/* MOVING BAIT BANNER */}
      <section className="overflow-hidden border-y border-green-500/20 bg-black py-5">
        <div className="flex animate-marquee whitespace-nowrap">
          <span className="mx-8 text-xl font-black tracking-[0.3em] text-green-500">
            APACHE STICKS • WARHAWKS • WARFROGS • WARCRAWS • WARGRUBS • PHANTOMS • BUILT TO HUNT •
          </span>

          <span className="mx-8 text-xl font-black tracking-[0.3em] text-green-500">
            APACHE STICKS • WARHAWKS • WARFROGS • WARCRAWS • WARGRUBS • PHANTOMS • BUILT TO HUNT •
          </span>

          <span className="mx-8 text-xl font-black tracking-[0.3em] text-green-500">
            APACHE STICKS • WARHAWKS • WARFROGS • WARCRAWS • WARGRUBS • PHANTOMS • BUILT TO HUNT •
          </span>
        </div>
      </section>

      {/* WHY SECTION */}
      <section id="why" className="bg-black px-6 py-24 text-center">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-bold tracking-[0.4em] text-green-500">
            WHY GERONIMO BAITS
          </p>

          <h2 className="mt-5 text-5xl font-black">
            BUILT BY ANGLERS
          </h2>

          <p className="mx-auto mt-8 max-w-3xl text-xl text-gray-300">
            Geronimo Baits are handcrafted soft plastics made for serious anglers.
            Every bait is poured with action, durability, and confidence in mind.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-green-500/30 bg-black/70 p-6">
              <h3 className="text-xl font-bold text-green-500">HANDMADE</h3>
              <p className="mt-3 text-gray-300">
                Small-batch soft plastics made with care and attention.
              </p>
            </div>

            <div className="rounded-3xl border border-green-500/30 bg-black/70 p-6">
              <h3 className="text-xl font-bold text-green-500">TESTED LOCALLY</h3>
              <p className="mt-3 text-gray-300">
                Designed for South African waters and bass fishing conditions.
              </p>
            </div>

            <div className="rounded-3xl border border-green-500/30 bg-black/70 p-6">
              <h3 className="text-xl font-bold text-green-500">BUILT TO HUNT</h3>
              <p className="mt-3 text-gray-300">
                Made to trigger bites with colour, movement, and confidence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* GALLERY */}
      <section id="gallery" className="bg-black px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center">
            <p className="text-sm font-bold tracking-[0.4em] text-green-500">
              ON THE WATER
            </p>

            <h2 className="mt-5 text-5xl font-black">
              THE HUNT GALLERY
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <img
              src="/catch1.jpeg"
              alt="Catch 1"
              className="h-[420px] w-full rounded-3xl object-cover transition hover:scale-[1.02]"
            />

            <img
              src="/catch2.jpeg"
              alt="Catch 2"
              className="h-[420px] w-full rounded-3xl object-cover transition hover:scale-[1.02]"
            />

            <img
              src="/catch3.jpeg"
              alt="Catch 3"
              className="h-[420px] w-full rounded-3xl object-cover transition hover:scale-[1.02]"
            />

            <img
              src="/catch4.jpeg"
              alt="Catch 4"
              className="h-[420px] w-full rounded-3xl object-cover transition hover:scale-[1.02]"
            />
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="bg-black px-6 py-24 text-center">
        <h2 className="text-5xl font-black text-green-500">
          READY TO HUNT?
        </h2>

        <p className="mx-auto mt-5 max-w-2xl text-xl text-gray-300">
          Message us for orders, colour availability, or custom pours.
        </p>

        <a
          href="https://wa.me/27675380595"
          target="_blank"
          className="mt-10 inline-block rounded-2xl bg-green-500 px-10 py-5 text-xl font-black text-black transition hover:bg-green-400"
        >
          WHATSAPP US
        </a>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-green-500/20 bg-black px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 md:flex-row">
          <div>
            <h3 className="text-2xl font-black tracking-[0.2em]">
              GERONIMO <span className="text-green-500">BAITS</span>
            </h3>

            <p className="mt-3 text-gray-400">
              Handmade in South Africa 🇿🇦
            </p>
          </div>

          <div className="flex gap-8 text-sm font-bold tracking-[0.2em] text-gray-300">
            <a href="#home" className="hover:text-green-500">HOME</a>
            <a href="#why" className="hover:text-green-500">WHY US</a>
            <a href="#gallery" className="hover:text-green-500">GALLERY</a>
            <a href="#contact" className="hover:text-green-500">CONTACT</a>
            <Link href="/baits" className="hover:text-green-500">BAITS</Link>
          </div>

          <div className="text-sm text-gray-500">
            © 2026 Geronimo Baits
          </div>
        </div>
      </footer>
    </main>
  );
}