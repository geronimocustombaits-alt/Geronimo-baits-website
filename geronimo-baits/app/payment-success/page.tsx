export default function PaymentSuccess() {
  return (
    <main className="min-h-screen bg-black px-6 py-24 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-green-500/40 bg-black/80 p-10 text-center">
        <p className="text-sm font-bold tracking-[0.4em] text-green-500">
          GERONIMO BAITS
        </p>

        <h1 className="mt-6 text-5xl font-black text-green-500">
          PAYMENT SUCCESSFUL
        </h1>

        <p className="mt-6 text-xl text-gray-300">
          Thank you for your order. We received your payment and will contact you shortly.
        </p>

        <p className="mt-4 text-gray-400">
          Built to Hunt.
        </p>

        <a
          href="/"
          className="mt-10 inline-block rounded-xl bg-green-500 px-8 py-4 font-black text-black transition hover:bg-green-400"
        >
          BACK TO HOME
        </a>
      </div>
    </main>
  );
}