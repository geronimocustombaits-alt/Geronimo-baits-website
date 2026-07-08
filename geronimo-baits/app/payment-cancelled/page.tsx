export default function PaymentCancelled() {
  return (
    <main className="min-h-screen bg-black px-6 py-24 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/40 bg-black/80 p-10 text-center">
        <p className="text-sm font-bold tracking-[0.4em] text-red-400">
          GERONIMO BAITS
        </p>

        <h1 className="mt-6 text-5xl font-black text-red-400">
          PAYMENT CANCELLED
        </h1>

        <p className="mt-6 text-xl text-gray-300">
          No payment was processed. You can return to the bait page and try again.
        </p>

        <a
          href="/baits"
          className="mt-10 inline-block rounded-xl border border-green-500 px-8 py-4 font-black text-green-500 transition hover:bg-green-500 hover:text-black"
        >
          BACK TO BAITS
        </a>
      </div>
    </main>
  );
}