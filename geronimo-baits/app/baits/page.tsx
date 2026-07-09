"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const whatsappNumber = "27675380595";

type Product = {
  sku: string;
  bait: string;
  colour: string;
  size: string;
  price: string;
  stockQty: string;
};

type CartItem = Product & {
  qty: number;
};

export default function BaitsPage() {
  const searchParams = useSearchParams();

  const orderNumberRef = useRef("");
  const [orderNumber, setOrderNumber] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('Warhawk 3.5"');
  const [cart, setCart] = useState<CartItem[]>([]);

  const [huntBoxMode, setHuntBoxMode] = useState(false);
  const [huntBoxSize, setHuntBoxSize] = useState(0);
  const [huntBoxName, setHuntBoxName] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("PUDO Locker");

  useEffect(() => {
    async function loadProducts() {
      const response = await fetch("/api/products");
      const data = await response.json();
      setProducts(data);
    }

    loadProducts();
  }, []);

  useEffect(() => {
    async function getNextOrderNumber() {
      try {
        const response = await fetch("/api/next-order-number");
        const data = await response.json();

        orderNumberRef.current = data.orderNumber;
        setOrderNumber(data.orderNumber);
      } catch (error) {
        console.error("Could not get next order number:", error);

        orderNumberRef.current = "GB-01";
        setOrderNumber("GB-01");
      }
    }

    getNextOrderNumber();
  }, []);

  useEffect(() => {
    const condition = searchParams.get("condition");

    if (condition === "muddy") setSelectedCategory('Warcraws 3.5"');
    if (condition === "clear") setSelectedCategory('Apache Stick 5"');
    if (condition === "morning") setSelectedCategory('Warhawk 3.5"');
    if (condition === "overcast") setSelectedCategory('Warfrogs 4"');
  }, [searchParams]);

  const categories = [
    'Warhawk 3.5"',
    'Apache Stick 5"',
    'Apache Stick 4"',
    'Phantoms 3.5"',
    'Warfrogs 4"',
    'Warcraws 3.5"',
    'Wargrubs 3"',
  ];

  const huntBoxes = [
    { name: "SCOUT BOX", size: 3, description: "Perfect starter selection." },
    { name: "HUNTER BOX", size: 5, description: "Built for a serious session." },
    { name: "WAR BOX", size: 8, description: "Full attack mode." },
  ];

  const cleanText = (text: string) =>
    text.replace(/\\"/g, '"').replace(/"/g, "").trim().toLowerCase();

  const filteredProducts = products.filter(
    (product) => cleanText(product.bait) === cleanText(selectedCategory)
  );

  const cartPackCount = cart.reduce((total, item) => total + item.qty, 0);

  const cartTotal = cart.reduce(
    (total, item) => total + Number(item.price) * item.qty,
    0
  );

  const shippingCost =
    deliveryMethod === "PUDO Locker"
      ? 60
      : deliveryMethod === "PUDO Door-to-Door"
      ? 110
      : 0;

  const grandTotal = cartTotal + shippingCost;

  const checkoutReady =
    orderNumber.trim() !== "" &&
    customerName.trim() !== "" &&
    customerPhone.trim() !== "" &&
    customerEmail.trim() !== "" &&
    deliveryMethod.trim() !== "";

  const startHuntBox = (name: string, size: number) => {
    setHuntBoxMode(true);
    setHuntBoxName(name);
    setHuntBoxSize(size);
    setCart([]);
  };

  const clearHuntBox = () => {
    setHuntBoxMode(false);
    setHuntBoxName("");
    setHuntBoxSize(0);
    setCart([]);
  };

  const addToCart = (product: Product) => {
    const stock = Number(product.stockQty);

    setCart((currentCart) => {
      const existingItem = currentCart.find((item) => item.sku === product.sku);

      const currentPackCount = currentCart.reduce(
        (total, item) => total + item.qty,
        0
      );

      if (huntBoxMode && currentPackCount >= huntBoxSize) return currentCart;

      if (existingItem) {
        if (existingItem.qty >= stock) return currentCart;

        return currentCart.map((item) =>
          item.sku === product.sku ? { ...item, qty: item.qty + 1 } : item
        );
      }

      return [...currentCart, { ...product, qty: 1 }];
    });
  };

  const removeFromCart = (sku: string) => {
    setCart((currentCart) => currentCart.filter((item) => item.sku !== sku));
  };

  const sendOrderEmail = async (
    paymentMethod: "Website" | "WhatsApp" | "PayFast" = "Website"
  ) => {
    await fetch("/api/send-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderNumber,
        customerName,
        customerPhone,
        customerEmail,
        deliveryMethod,
        cartTotal,
        shippingCost,
        grandTotal,
        paymentMethod,
        paymentStatus: "Pending",
        orderStatus: "Processing",
        items: cart,
      }),
    });
  };

  const checkoutMessage = encodeURIComponent(
    `🎣 GERONIMO BAITS ORDER

Order Number: ${orderNumber}

Name: ${customerName}
Phone: ${customerPhone}
Email: ${customerEmail}

Delivery: ${deliveryMethod}

ORDER:
${cart
  .map(
    (item) =>
      `• ${item.qty}x ${item.bait} - ${item.colour} | SKU: ${item.sku} | R${item.price}`
  )
  .join("\n")}

${huntBoxMode ? `Hunt Box: ${huntBoxName}` : ""}
Total Packs: ${cartPackCount}
Products Total: R${cartTotal}
Shipping: R${shippingCost}
Grand Total: R${grandTotal}

Built to Hunt.`
  );

  const condition = searchParams.get("condition");

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

      <div className="mx-auto mb-10 max-w-4xl rounded-3xl border border-green-500/30 bg-black/90 p-8 text-center backdrop-blur-md">
        <p className="mb-3 text-sm font-black tracking-[0.3em] text-green-500">
          ORDER {orderNumber || "LOADING..."}
        </p>

        <h1 className="text-5xl font-bold tracking-[0.25em]">
          BAIT <span className="text-green-500">RANGE</span>
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-gray-300">
          Choose your bait category, add to cart, and checkout securely with PayFast.
        </p>
      </div>

      {condition === "muddy" && (
        <div className="mx-auto mb-8 max-w-7xl rounded-3xl border border-green-500 bg-black/80 p-6">
          <h3 className="text-2xl font-black text-green-500">
            🌊 MUDDY WATER MODE
          </h3>
          <p className="mt-4 text-gray-300">Recommended Colours:</p>
          <ul className="mt-3 space-y-2 text-white">
            <li>• Black Magic</li>
            <li>• Junebug</li>
            <li>• Black & Blue</li>
          </ul>
        </div>
      )}

      {condition === "clear" && (
        <div className="mx-auto mb-8 max-w-7xl rounded-3xl border border-green-500 bg-black/80 p-6">
          <h3 className="text-2xl font-black text-green-500">
            ☀️ CLEAR WATER MODE
          </h3>
          <p className="mt-4 text-gray-300">Recommended Colours:</p>
          <ul className="mt-3 space-y-2 text-white">
            <li>• Cotton Crush</li>
            <li>• White Pearl</li>
          </ul>
        </div>
      )}

      {condition === "morning" && (
        <div className="mx-auto mb-8 max-w-7xl rounded-3xl border border-green-500 bg-black/80 p-6">
          <h3 className="text-2xl font-black text-green-500">
            🌅 EARLY MORNING MODE
          </h3>
          <p className="mt-4 text-gray-300">Recommended Colours:</p>
          <ul className="mt-3 space-y-2 text-white">
            <li>• Motoroil</li>
            <li>• Junebug</li>
          </ul>
        </div>
      )}

      {condition === "overcast" && (
        <div className="mx-auto mb-8 max-w-7xl rounded-3xl border border-green-500 bg-black/80 p-6">
          <h3 className="text-2xl font-black text-green-500">
            ☁️ OVERCAST MODE
          </h3>
          <p className="mt-4 text-gray-300">Recommended Colours:</p>
          <ul className="mt-3 space-y-2 text-white">
            <li>• Watermelon Red</li>
            <li>• Motoroil</li>
          </ul>
        </div>
      )}

      <div className="mx-auto mb-8 max-w-7xl rounded-3xl border border-green-500/30 bg-black/80 p-6 backdrop-blur-md">
        <h2 className="text-2xl font-black tracking-widest text-green-500">
          BUILD YOUR HUNT BOX
        </h2>

        <p className="mt-2 text-gray-300">
          Choose your Geronimo box, fill it with baits, then checkout.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {huntBoxes.map((box) => (
            <button
              key={box.name}
              onClick={() => startHuntBox(box.name, box.size)}
              className={`rounded-2xl border p-8 text-center transition ${
                huntBoxName === box.name
                  ? "border-green-500 bg-green-500 text-black"
                  : "border-green-500/40 bg-black/60 text-white hover:border-green-500"
              }`}
            >
              <p className="text-3xl font-black text-green-500">{box.name}</p>
              <p className="mt-3 text-lg font-bold">{box.size} PACKS</p>
              <p className="mt-3 text-sm opacity-80">{box.description}</p>
              <p className="mt-5 rounded-xl border border-green-500/40 px-4 py-3 text-sm font-black">
                SELECT BOX
              </p>
            </button>
          ))}
        </div>

        {huntBoxMode && (
          <div className="mt-6 rounded-2xl border border-green-500/20 bg-black/70 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-lg font-bold">
                {huntBoxName}:{" "}
                <span className="text-green-500">
                  {cartPackCount}/{huntBoxSize} packs selected
                </span>
              </p>

              <button
                onClick={clearHuntBox}
                className="rounded-xl border border-red-500 px-4 py-2 text-sm font-bold text-red-400 transition hover:bg-red-500 hover:text-black"
              >
                CLEAR HUNT BOX
              </button>
            </div>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-green-500 transition-all"
                style={{
                  width: `${Math.min(
                    (cartPackCount / huntBoxSize) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      <section className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          <div className="rounded-3xl border border-green-500/30 bg-black/60 p-8 backdrop-blur-sm">
            <h2 className="mb-8 text-3xl font-bold text-green-500">
              {selectedCategory}
            </h2>

            <div className="grid gap-6 md:grid-cols-2">
              {filteredProducts.map((product) => {
                const stock = Number(product.stockQty);

                const canAdd =
                  stock > 0 && (!huntBoxMode || cartPackCount < huntBoxSize);

                return (
                  <div
                    key={product.sku}
                    className="rounded-3xl border border-green-500/20 bg-black/70 p-6 transition duration-300 hover:-translate-y-2 hover:border-green-500 hover:shadow-lg hover:shadow-green-500/20"
                  >
                    <div className="mb-5 flex h-60 items-center justify-center overflow-hidden rounded-2xl bg-zinc-800/70">
                      <img
                        src={`/product-images/${product.sku}.jpeg`}
                        alt={product.colour}
                        className="h-full w-full object-cover transition duration-500 hover:scale-110"
                        onError={(e) => {
                          e.currentTarget.src = "/product-images/no-image.jpeg";
                          e.currentTarget.className =
                            "max-h-full max-w-full object-contain";
                        }}
                      />
                    </div>

                    <h3 className="text-2xl font-bold text-white">
                      {product.colour}
                    </h3>

                    <p className="mt-2 text-lg font-bold text-green-500">
                      R{product.price} / Pack
                    </p>

                    <p className="mt-3 text-gray-300">{product.bait}</p>

                    <p
                      className={`mt-3 font-bold ${
                        stock > 0 ? "text-green-500" : "text-red-400"
                      }`}
                    >
                      {stock > 0 ? `${stock} in stock` : "Out of stock"}
                    </p>

                    {stock <= 0 ? (
                      <div className="mt-6 block rounded-xl bg-zinc-800 px-5 py-3 text-center font-bold text-zinc-400">
                        OUT OF STOCK
                      </div>
                    ) : canAdd ? (
                      <button
                        onClick={() => addToCart(product)}
                        className="mt-6 block w-full rounded-xl bg-green-500 px-5 py-3 text-center font-bold text-black transition hover:scale-105 hover:bg-green-400"
                      >
                        {huntBoxMode ? "ADD TO HUNT BOX" : "ADD TO CART"}
                      </button>
                    ) : (
                      <div className="mt-6 block rounded-xl bg-zinc-800 px-5 py-3 text-center font-bold text-zinc-400">
                        HUNT BOX FULL
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="h-fit space-y-6 lg:sticky lg:top-24">
            <div className="rounded-3xl border border-green-500/30 bg-black/80 p-6 backdrop-blur-md">
              <h3 className="mb-5 text-xl font-bold tracking-widest text-green-500">
                WATER CONDITIONS
              </h3>

              <div className="flex flex-col gap-3">
                <a
                  href="/baits?condition=muddy"
                  className="rounded-xl border border-green-500 px-4 py-3 font-bold text-green-500 transition hover:bg-green-500 hover:text-black"
                >
                  🌊 Muddy Water
                </a>
                <a
                  href="/baits?condition=clear"
                  className="rounded-xl border border-green-500 px-4 py-3 font-bold text-green-500 transition hover:bg-green-500 hover:text-black"
                >
                  ☀️ Clear Water
                </a>
                <a
                  href="/baits?condition=morning"
                  className="rounded-xl border border-green-500 px-4 py-3 font-bold text-green-500 transition hover:bg-green-500 hover:text-black"
                >
                  🌅 Early Morning
                </a>
                <a
                  href="/baits?condition=overcast"
                  className="rounded-xl border border-green-500 px-4 py-3 font-bold text-green-500 transition hover:bg-green-500 hover:text-black"
                >
                  ☁️ Overcast
                </a>
              </div>
            </div>

            <div className="rounded-3xl border border-green-500/30 bg-black/80 p-6 backdrop-blur-md">
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
            </div>

            <div className="rounded-3xl border border-green-500/30 bg-black/80 p-6 backdrop-blur-md">
              <h3 className="mb-5 text-xl font-bold tracking-widest text-green-500">
                {huntBoxMode
                  ? `${huntBoxName} (${cartPackCount}/${huntBoxSize})`
                  : `CART (${cartPackCount})`}
              </h3>

              {cart.length === 0 ? (
                <p className="text-gray-400">
                  {huntBoxMode
                    ? "Choose baits to fill your Hunt Box."
                    : "Your cart is empty."}
                </p>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.sku}
                      className="rounded-xl border border-green-500/20 bg-black/60 p-4"
                    >
                      <p className="font-bold text-white">{item.colour}</p>
                      <p className="text-sm text-gray-400">{item.bait}</p>
                      <p className="mt-1 text-sm text-green-500">
                        {item.qty}x R{item.price}
                      </p>

                      <button
                        onClick={() => removeFromCart(item.sku)}
                        className="mt-2 text-sm font-bold text-red-400 hover:text-red-300"
                      >
                        REMOVE
                      </button>
                    </div>
                  ))}

                  <div className="mb-5 space-y-3">
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full rounded-xl border border-green-500/30 bg-black px-4 py-3 text-white"
                    />

                    <input
                      type="tel"
                      placeholder="Phone Number"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full rounded-xl border border-green-500/30 bg-black px-4 py-3 text-white"
                    />

                    <input
                      type="email"
                      placeholder="Email Address"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full rounded-xl border border-green-500/30 bg-black px-4 py-3 text-white"
                    />

                    <select
                      value={deliveryMethod}
                      onChange={(e) => setDeliveryMethod(e.target.value)}
                      className="w-full rounded-xl border border-green-500/30 bg-black px-4 py-3 text-white"
                    >
                      <option>PUDO Locker</option>
                      <option>PUDO Door-to-Door</option>
                      <option>Collection</option>
                    </select>
                  </div>

                  <div className="border-t border-green-500/20 pt-4">
                    <p className="text-lg font-bold text-white">
                      Order Summary
                    </p>

                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Products</span>
                        <span>R{cartTotal}</span>
                      </div>

                      <div className="flex justify-between">
                        <span>Shipping</span>
                        <span>R{shippingCost}</span>
                      </div>

                      <div className="flex justify-between border-t border-green-500/20 pt-2 text-lg font-black">
                        <span>Total</span>
                        <span className="text-green-500">R{grandTotal}</span>
                      </div>
                    </div>

                    {huntBoxMode && cartPackCount !== huntBoxSize ? (
                      <div className="mt-4 rounded-xl bg-zinc-800 px-5 py-3 text-center font-bold text-zinc-400">
                        COMPLETE YOUR HUNT BOX
                      </div>
                    ) : checkoutReady ? (
                      <>
                        <button
                          onClick={async () => {
                            try {
                              await sendOrderEmail("PayFast");

                              const response = await fetch(
                                "/api/create-payfast-payment",
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    orderNumber,
                                    customerName,
                                    customerEmail,
                                    grandTotal,
                                  }),
                                }
                              );

                              const data = await response.json();

                              if (data.paymentUrl) {
                                window.location.href = data.paymentUrl;
                              }
                            } catch (error) {
                              console.error("PayFast failed:", error);
                            }
                          }}
                          className="mt-6 w-full rounded-2xl border-2 border-green-500 bg-gradient-to-r from-green-500 to-green-400 px-6 py-5 text-xl font-black tracking-wide text-black shadow-lg shadow-green-500/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-green-500/60"
                        >
                          💳 SECURE CHECKOUT
                          <div className="mt-1 text-sm font-semibold">
                            Pay securely with PayFast
                          </div>
                        </button>

                        <div className="mt-6 rounded-2xl border border-green-500/20 bg-black/60 p-5 text-center">
                          <p className="text-sm text-gray-300">
                            Need help with your order or looking for a custom colour?
                          </p>

                          <a
                            href="https://wa.me/27675380595"
                            target="_blank"
                            className="mt-4 inline-block rounded-xl border border-green-500 px-6 py-3 font-bold text-green-500 transition hover:bg-green-500 hover:text-black"
                          >
                            💬 Chat with us on WhatsApp
                          </a>
                        </div>
                      </>
                    ) : (
                      <div className="mt-4 rounded-xl bg-zinc-800 px-5 py-3 text-center font-bold text-zinc-400">
                        COMPLETE YOUR DETAILS
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}