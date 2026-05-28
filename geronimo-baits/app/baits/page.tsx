"use client";

import { useEffect, useState } from "react";

const whatsappNumber = "27675380595";

type Product = {
  sku: string;
  bait: string;
  colour: string;
  size: string;
  price: string;
  stockQty: string;
};

export default function BaitsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("Warhawk");

  useEffect(() => {
    async function loadProducts() {
      const response = await fetch("/api/products");
      const data = await response.json();
      setProducts(data);
    }

    loadProducts();
  }, []);

  const filteredProducts = products.filter(
    (product) => product.bait === selectedCategory
  );

  const categories = [
    "Warhawk",
    "Apache Stick 5",
    "Apache Stick 4",
    "Phantoms",
    "WarFrogs",
    "WarCraws",
    "WarGrubs",
  ];

  return (
    <main
      className="min-h-screen bg-cover bg-center bg-fixed px-6 py-24 text-white"
      style={{ backgroundImage: "url('/Background rev 2.png')" }}
    >
      <a
        href="/"
        className="fixed left-6 top-6 z-50 rounded-xl border border-green-500 bg-black/80 px-5 py-2 font-bold text-green-500 backdrop-blur-md transition hover:bg-green-500 hover:text-black"
      >
        ← HOME
      </a>

      <div className="mx-auto mb-14 max-w-4xl rounded-3xl border border-green-500/30 bg-black/90 p-8 text-center backdrop-blur-md">
        <h1 className="text-5xl font-bold tracking-[0.25em]">
          BAIT <span className="text-green-500">RANGE</span>
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-gray-300">
          Choose your bait category and build your order.
        </p>
      </div>

      <section className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          <div className="rounded-3xl border border-green-500/30 bg-black/60 p-8 backdrop-blur-sm">
            <h2 className="mb-8 text-3xl font-bold text-green-500">
              {selectedCategory}
            </h2>

            <div className="grid gap-6 md:grid-cols-2">
              {filteredProducts.map((product) => {
                const stock = Number(product.stockQty);

                const orderMessage = encodeURIComponent(
                  `Hi Geronimo Baits, I want to order ${product.bait} ${product.size} in ${product.colour}. SKU: ${product.sku}`
                );

                return (
                  <div
                    key={product.sku}
                    className="rounded-3xl border border-green-500/20 bg-black/70 p-6 transition duration-300 hover:-translate-y-2 hover:border-green-500 hover:shadow-lg hover:shadow-green-500/20"
                  >
                    <div className="mb-5 flex h-56 items-center justify-center rounded-2xl bg-zinc-800/70 text-gray-500">
                      Product Image
                    </div>

                    <h3 className="text-2xl font-bold text-white">
                      {product.colour}
                    </h3>

                    <p className="mt-2 text-lg font-bold text-green-500">
                      R{product.price} / Pack
                    </p>

                    <p className="mt-3 text-gray-300">
                      {product.bait} — {product.size}
                    </p>

                    <p
                      className={`mt-3 font-bold ${
                        stock > 0 ? "text-green-500" : "text-red-400"
                      }`}
                    >
                      {stock > 0 ? `${stock} in stock` : "Out of stock"}
                    </p>

                    {stock > 0 ? (
                      <a
                        href={`https://wa.me/${whatsappNumber}?text=${orderMessage}`}
                        target="_blank"
                        className="mt-6 block rounded-xl bg-green-500 px-5 py-3 text-center font-bold text-black transition hover:scale-105 hover:bg-green-400"
                      >
                        ADD TO ORDER
                      </a>
                    ) : (
                      <div className="mt-6 block rounded-xl bg-zinc-800 px-5 py-3 text-center font-bold text-zinc-400">
                        OUT OF STOCK
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="h-fit rounded-3xl border border-green-500/30 bg-black/80 p-6 backdrop-blur-md lg:sticky lg:top-24">
            <h3 className="mb-5 text-xl font-bold tracking-widest text-green-500">
              CATEGORIES
            </h3>

            <div className="flex flex-col gap-3">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`rounded-xl px-4 py-3 text-left font-bold transition ${
                    selectedCategory === category
                      ? "bg-green-500 text-black"
                      : "border border-green-500 text-green-500 hover:bg-green-500 hover:text-black"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}