import CursorGlow from "./components/CursorGlow";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-black text-white">
      <CursorGlow />

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
        style={{ backgroundImage: "url('/Background rev 2.png')" }}
      >
        <div className="absolute inset-0 bg-black/70"></div>

        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-500/20 blur-[120px]"></div>

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
              href="/baits?huntbox=true"
              className="rounded-2xl border border-green-500 bg-black/40 px-10 py-5 text-xl font-black text-green-500 backdrop-blur-md transition hover:scale-105 hover:bg-green-500 hover:text-black"
            >
              BUILD YOUR HUNT BOX
            </a>

            <a
              href="https://wa.me/27675380595"
              target="_blank"
              className="rounded-2xl border border-green-500 bg-black/40 px-10 py-5 text-xl font-black text-white backdrop-blur-md transition hover:bg-green-500 hover:text-black"
            >
              WHATSAPP US
            </a>
            <a
  href="/remelt-zone"
  className="rounded-xl border border-green-500 px-8 py-4 text-xl font-black text-orange-500 transition hover:bg-green-500 hover:text-black"
>
  ♻️ REMELT ZONE
</a>
          </div>
        </div>
      </section>

      {/* MOVING BAIT BANNER */}
      <section className="overflow-hidden border-y border-green-500/20 bg-black py-5">
        <div className="flex animate-marquee whitespace-nowrap">
          {[
            "APACHE STICKS • WARHAWKS • WARFROGS • WARCRAWS • WARGRUBS • PHANTOMS • BUILT TO HUNT •",
            "APACHE STICKS • WARHAWKS • WARFROGS • WARCRAWS • WARGRUBS • PHANTOMS • BUILT TO HUNT •",
            "APACHE STICKS • WARHAWKS • WARFROGS • WARCRAWS • WARGRUBS • PHANTOMS • BUILT TO HUNT •",
          ].map((text, index) => (
            <span
              key={index}
              className="mx-8 text-xl font-black tracking-[0.3em] text-green-500"
            >
              {text}
            </span>
          ))}
        </div>
      </section>

      {/* BUILT TO HUNT */}
      <section id="about" className="relative overflow-hidden px-6 py-24">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute left-[5%] top-[10%] h-[500px] w-[500px] rounded-full bg-green-500/10 blur-[150px]"
            style={{ animation: "floatSmoke1 14s ease-in-out infinite" }}
          />

          <div
            className="absolute right-[10%] top-[20%] h-[400px] w-[400px] rounded-full bg-green-400/10 blur-[130px]"
            style={{ animation: "floatSmoke2 18s ease-in-out infinite" }}
          />

          <div
            className="absolute bottom-[10%] left-[30%] h-[350px] w-[600px] rounded-full bg-green-500/5 blur-[170px]"
            style={{ animation: "floatSmoke3 22s ease-in-out infinite" }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <p className="text-sm font-bold tracking-[0.4em] text-green-500">
              BUILT TO HUNT
            </p>

            <h2 className="mt-5 text-5xl font-black md:text-6xl">
              MORE THAN JUST BAITS
            </h2>
          </div>

          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="overflow-hidden rounded-3xl border border-green-500/20 bg-black/60">
              <img
                src="/about-us.jpeg"
                alt="Geronimo Baits"
                className="h-[420px] w-full object-cover transition duration-700 hover:scale-105"
              />
            </div>

            <div>
              <h3 className="text-4xl font-black">
                Built by Anglers.
                <span className="block text-green-500">
                  Proven on the Water.
                </span>
              </h3>

              <p className="mt-6 text-lg leading-8 text-gray-300">
                Geronimo Baits started with a simple goal: create soft plastics
                that catch fish where it matters most — on South African waters.
              </p>

              <p className="mt-6 text-lg leading-8 text-gray-300">
                Every bait is hand-poured, tested and refined before it reaches
                your tackle box. We do not build baits to sit on shelves. We
                build baits that are made to hunt.
              </p>

              <p className="mt-6 text-lg leading-8 text-gray-300">
                From local farm dams to tournament waters, our mission remains
                the same:
              </p>

              <div className="mt-8 rounded-2xl border border-green-500/20 bg-black/50 p-6">
                <p className="text-2xl font-black text-green-500">
                  WE MAKE IT.
                </p>

                <p className="mt-2 text-2xl font-black text-white">
                  FISH TAKE IT.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-20 grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-green-500/20 bg-black/60 p-8 text-center">
              <div className="text-5xl">🎯</div>
              <h3 className="mt-4 text-xl font-black">
                TESTED ON LOCAL WATERS
              </h3>
              <p className="mt-3 text-gray-400">
                Every design is proven where South African anglers fish.
              </p>
            </div>

            <div className="rounded-3xl border border-green-500/20 bg-black/60 p-8 text-center">
              <div className="text-5xl">🖐️</div>
              <h3 className="mt-4 text-xl font-black">
                HANDMADE IN SOUTH AFRICA
              </h3>
              <p className="mt-3 text-gray-400">
                Hand-poured and packed with attention to detail.
              </p>
            </div>

            <div className="rounded-3xl border border-green-500/20 bg-black/60 p-8 text-center">
              <div className="text-5xl">🔥</div>
              <h3 className="mt-4 text-xl font-black">BUILT TO HUNT</h3>
              <p className="mt-3 text-gray-400">
                Performance first. Confidence on every cast.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* THE GERONIMO DIFFERENCE */}
      <section id="why" className="px-6 py-24 text-center">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-bold tracking-[0.4em] text-green-500">
            THE GERONIMO DIFFERENCE
          </p>

          <h2 className="mt-4 text-5xl font-black md:text-6xl">
            WHY ANGLERS CHOOSE US
          </h2>
          

          <p className="mx-auto mt-6 max-w-3xl text-lg text-gray-300">
            Every bait is designed with one purpose in mind: helping anglers
            catch more fish with confidence.
          </p>

          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            {[
              ["100%", "HANDMADE", "Every bait is hand poured."],
              ["SA", "LOCAL", "Built in South Africa."],
              ["🎣", "TESTED", "Proven on local waters."],
              ["🔥", "BUILT TO HUNT", "Performance comes first."],
              ["24/7", "SUPPORT", "Message us anytime."],
            ].map(([stat, title, text]) => (
              <div
                key={title}
                className="rounded-3xl border border-green-500/20 bg-black/60 p-8"
              >
                <div className="text-4xl font-black text-green-500">
                  {stat}
                </div>
                <p className="mt-3 font-bold">{title}</p>
                <p className="mt-2 text-sm text-gray-400">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* SA WATER CONDITIONS GUIDE */}
<section className="px-6 py-24">
  <div className="mx-auto max-w-7xl">
    <div className="mb-16 text-center">
      <p className="text-sm font-bold tracking-[0.4em] text-green-500">
        BUILT FOR SOUTH AFRICAN WATERS
      </p>

      <h2 className="mt-4 text-5xl font-black md:text-6xl">
        WATER CONDITIONS GUIDE
      </h2>

      <p className="mx-auto mt-6 max-w-3xl text-lg text-gray-300">
        Not sure what to throw? Start with the right conditions and hunt the range.
      </p>
    </div>

    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">

      {/* MUDDY WATER */}
      <div className="rounded-3xl border border-green-500/20 bg-black/60 p-8 backdrop-blur-sm transition hover:border-green-500">
        <div className="mb-4 text-5xl">🌊</div>

        <h3 className="text-2xl font-black">
          MUDDY WATER
        </h3>

        <p className="mt-4 text-gray-400">
          Low visibility. Dark silhouettes dominate.
        </p>

        <a
         href="/baits?condition=muddy"
          className="mt-6 block rounded-xl border border-green-500 bg-black px-4 py-4 text-center font-black tracking-wide text-green-500 transition hover:bg-green-500 hover:text-black"
        >
          🌊 HUNT MUDDY WATER BAITS →
        </a>
      </div>

      {/* CLEAR WATER */}
      <div className="rounded-3xl border border-green-500/20 bg-black/60 p-8 backdrop-blur-sm transition hover:border-green-500">
        <div className="mb-4 text-5xl">☀️</div>

        <h3 className="text-2xl font-black">
          CLEAR WATER
        </h3>

        <p className="mt-4 text-gray-400">
          Natural presentation and subtle action.
        </p>

        <a
          href="/baits?condition=clear"
          className="mt-6 block rounded-xl border border-green-500 bg-black px-4 py-4 text-center font-black tracking-wide text-green-500 transition hover:bg-green-500 hover:text-black"
        >
          ☀️ HUNT CLEAR WATER BAITS →
        </a>
      </div>

      {/* EARLY MORNING */}
      <div className="rounded-3xl border border-green-500/20 bg-black/60 p-8 backdrop-blur-sm transition hover:border-green-500">
        <div className="mb-4 text-5xl">🌅</div>

        <h3 className="text-2xl font-black">
          EARLY MORNING
        </h3>

        <p className="mt-4 text-gray-400">
          Low light means darker colours shine.
        </p>

        <a
          href="/baits?condition=morning"
          className="mt-6 block rounded-xl border border-green-500 bg-black px-4 py-4 text-center font-black tracking-wide text-green-500 transition hover:bg-green-500 hover:text-black"
        >
          🌅 HUNT EARLY MORNING BAITS →
        </a>
      </div>

           {/* OVERCAST */}
      <div className="rounded-3xl border border-green-500/20 bg-black/60 p-8 backdrop-blur-sm transition hover:border-green-500">
        <div className="mb-4 text-5xl">☁️</div>

        <h3 className="text-2xl font-black">
          OVERCAST
        </h3>

        <p className="mt-4 text-gray-400">
          Extra visibility without being too aggressive.
        </p>

        <a
          href="/baits?condition=overcast"
          className="mt-6 block rounded-xl border border-green-500 bg-black px-4 py-4 text-center font-black tracking-wide text-green-500 transition hover:bg-green-500 hover:text-black"
        >
          ☁️ HUNT OVERCAST BAITS →
        </a>
      </div>

    </div>

  </div>
</section>

      {/* GALLERY */}
      <section id="gallery" className="overflow-hidden bg-black px-6 py-24">
        <div className="mb-14 text-center">
          <p className="text-sm font-bold tracking-[0.4em] text-green-500">
            ON THE WATER
          </p>

          <h2 className="mt-5 text-5xl font-black">THE HUNT GALLERY</h2>
        </div>

        <div className="overflow-hidden">
  <div className="flex w-max animate-gallery gap-6">
    {[
      "catch1.jpeg",
      "catch2.jpeg",
      "catch3.jpeg",
      "catch4.jpeg",
      "catch5.jpeg",
      "catch6.jpeg",
      "catch7.jpeg",
      "catch8.jpeg",
      "catch9.jpeg",
      "catch10.jpeg",
      "catch11.jpeg",
      "catch12.jpeg",
      "catch13.jpeg",
      "catch14.jpeg",
      "catch15.jpeg",
      "catch16.jpeg",
      "catch17.jpeg",
      "catch18.jpeg",
      "catch19.jpeg",
      "catch1.jpeg",
      "catch2.jpeg",
      "catch3.jpeg",
      "catch4.jpeg",
      "catch5.jpeg",
      "catch6.jpeg",
      "catch7.jpeg",
      "catch8.jpeg",
      "catch9.jpeg",
      "catch10.jpeg",
      "catch11.jpeg",
      "catch12.jpeg",
      "catch13.jpeg",
      "catch14.jpeg",
      "catch15.jpeg",
      "catch16.jpeg",
      "catch17.jpeg",
      "catch18.jpeg",
      "catch19.jpeg",
    ].map((image, index) => (
      <img
        key={index}
        src={`/${image}`}
        alt={`Catch ${index + 1}`}
        className="h-[420px] w-[300px] flex-none rounded-3xl object-cover"
      />
    ))}
  </div></div>
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

          <div className="text-center">
            <p className="mb-4 text-sm font-bold tracking-[0.35em] text-green-500">
              FOLLOW THE HUNT
            </p>

            <div className="flex justify-center gap-8 text-sm font-bold tracking-[0.2em] text-gray-300">
              <a
                href="https://www.facebook.com/Geronimobaits"
                target="_blank"
                className="transition hover:text-green-500"
              >
                FACEBOOK
              </a>

              <a
                href="https://www.instagram.com/geronimobaits/"
                target="_blank"
                className="transition hover:text-green-500"
              >
                INSTAGRAM
              </a>
            </div>
          </div>

          <div className="text-center text-sm text-gray-500">
            © 2026 Geronimo Baits
            <br />
            Built to Hunt.
          </div>
        </div>
      </footer>
    </main>
  );
}