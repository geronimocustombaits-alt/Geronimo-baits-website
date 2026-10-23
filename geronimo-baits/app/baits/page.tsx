"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  DOOR_METHOD,
  HUNT_BOXES,
  LOCKER_METHOD,
  DELIVERY_METHODS,
  deliveryLabel,
  shippingCostFor,
  type DeliveryAddress,
  type SelectedLocker,
  LAST_ORDER_KEY,
  SAVED_CART_KEY,
  formatRand,
  roundRand,
} from "@/lib/shop";
import PudoLockerPicker from "../components/PudoLockerPicker";
import Link from "next/link";
import { LegalFooter } from "../components/SiteFooter";

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


// Preferred order of category buttons. Anything else in the Products sheet
// (e.g. a new bait type) is added after these automatically.
const CATEGORY_ORDER = ["apache", "warcraw", "warviper", "warbomb", "coreshot"];

// Water condition buttons jump to the first category containing this word.
const CONDITION_CATEGORY: Record<string, string> = {
  muddy: "warcraw",
  clear: "apache",
  morning: "warviper",
  overcast: "warbomb",
};

const displayName = (text: string) => text.replace(/\\"/g, '"').trim();
const cleanText = (text: string) =>
  text.replace(/\\"/g, '"').replace(/"/g, "").trim().toLowerCase();

const IMAGE_EXTENSIONS = ["jpeg", "jpg", "webp", "png"];

// Sends the signed PayFast fields as a form POST (PayFast's documented method).
// The server still builds and signs the link; this just posts its fields.
function postToPayfast(paymentUrl: string) {
  const url = new URL(paymentUrl);
  const form = document.createElement("form");
  form.method = "POST";
  form.action = `${url.origin}${url.pathname}`;
  url.searchParams.forEach((value, key) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

// useSearchParams() must sit inside a Suspense boundary or the build fails.
export default function BaitsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-black text-xl font-bold tracking-widest text-green-500">
          LOADING THE HUNT RANGE...
        </main>
      }
    >
      <BaitsContent />
    </Suspense>
  );
}

function BaitsContent() {
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  const [huntBoxMode, setHuntBoxMode] = useState(false);
  const [huntBoxSize, setHuntBoxSize] = useState(0);
  const [huntBoxName, setHuntBoxName] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("PUDO Locker");

  const [locker, setLocker] = useState<SelectedLocker | null>(null);
  const [address, setAddress] = useState<DeliveryAddress>({
    street: "",
    suburb: "",
    city: "",
    postalCode: "",
  });

  const [placingOrder, setPlacingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const [restored, setRestored] = useState(false);

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch("/api/products");
        const data = await response.json();
        setProducts(Array.isArray(data) ? data : []);
      } catch {
        setProducts([]);
      }
    }

    loadProducts();
  }, []);

  // Restore a saved cart and details from this browser
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED_CART_KEY) || "null");
      if (saved) {
        if (Array.isArray(saved.cart)) setCart(saved.cart);
        if (saved.huntBoxName) {
          setHuntBoxMode(true);
          setHuntBoxName(saved.huntBoxName);
          setHuntBoxSize(Number(saved.huntBoxSize) || 0);
        }
        if (saved.customerName) setCustomerName(saved.customerName);
        if (saved.customerPhone) setCustomerPhone(saved.customerPhone);
        if (saved.customerEmail) setCustomerEmail(saved.customerEmail);
        if (saved.deliveryMethod && DELIVERY_METHODS.includes(saved.deliveryMethod)) {
          setDeliveryMethod(saved.deliveryMethod);
        }
        if (saved.locker) setLocker(saved.locker);
        if (saved.address) setAddress(saved.address);
      }
    } catch {
      // Storage unavailable (private window etc.): start with an empty cart.
    }
    setRestored(true);
  }, []);

  // Save whenever something changes
  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(
        SAVED_CART_KEY,
        JSON.stringify({
          cart,
          huntBoxName: huntBoxMode ? huntBoxName : "",
          huntBoxSize: huntBoxMode ? huntBoxSize : 0,
          customerName,
          customerPhone,
          customerEmail,
          deliveryMethod,
          locker,
          address,
        })
      );
    } catch {
      // Ignore: saving is only a convenience.
    }
  }, [restored, cart, huntBoxMode, huntBoxName, huntBoxSize, customerName, customerPhone, customerEmail, deliveryMethod, locker, address]);

  // Once live stock is loaded, drop sold-out items and trim quantities.
  useEffect(() => {
    if (!restored || products.length === 0) return;
    setCart((current) =>
      current
        .map((item) => {
          const live = products.find((p) => p.sku === item.sku);
          if (!live) return null;
          const stock = Number(live.stockQty) || 0;
          return { ...live, qty: Math.min(item.qty, stock) };
        })
        .filter((item): item is CartItem => item !== null && item.qty > 0)
    );
  }, [restored, products]);


  // Categories come straight from the BAIT column of the Products sheet.
  const categories = Array.from(
    new Map(products.map((p) => [cleanText(p.bait), displayName(p.bait)])).values()
  )
    .filter(Boolean)
    .sort((a, b) => {
      const rank = (name: string) => {
        const n = cleanText(name);
        // "Coreshot Apache Stick" also contains "apache", so check coreshot first.
        if (n.includes("coreshot")) return CATEGORY_ORDER.indexOf("coreshot");
        const i = CATEGORY_ORDER.findIndex((word) => n.includes(word));
        return i === -1 ? CATEGORY_ORDER.length : i;
      };
      return rank(a) - rank(b) || a.localeCompare(b);
    });

  const condition = searchParams.get("condition");
  const conditionCategory = condition
    ? categories.find((c) => cleanText(c).includes(CONDITION_CATEGORY[condition] || "~"))
    : undefined;

  useEffect(() => {
    if (conditionCategory) setSelectedCategory(conditionCategory);
  }, [conditionCategory]);

  const activeCategory =
    categories.find((c) => cleanText(c) === cleanText(selectedCategory)) || categories[0] || "";

  const huntBoxes = HUNT_BOXES;

  const filteredProducts = products.filter(
    (product) => cleanText(product.bait) === cleanText(activeCategory)
  );

  const cartPackCount = cart.reduce((total, item) => total + item.qty, 0);

  const cartTotal = cart.reduce(
    (total, item) => total + Number(item.price) * item.qty,
    0
  );

  const shippingCost = shippingCostFor(deliveryMethod, cartPackCount);

  const grandTotal = roundRand(cartTotal + shippingCost);

  const checkoutReady =
    customerName.trim() !== "" &&
    customerPhone.trim() !== "" &&
    customerEmail.trim() !== "" &&
    deliveryMethod.trim() !== "" &&
    (deliveryMethod !== LOCKER_METHOD || Boolean(locker?.name.trim())) &&
    (deliveryMethod !== DOOR_METHOD ||
      (address.street.trim() !== "" &&
        address.city.trim() !== "" &&
        address.postalCode.trim() !== ""));

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

  // The server works out prices, shipping, the total and the order number,
  // saves the order and returns the PayFast link.
  const placeOrder = async () => {
    setCheckoutError("");
    setPlacingOrder(true);

    try {
      const response = await fetch("/api/send-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerEmail,
          deliveryMethod,
          huntBoxName: huntBoxMode ? huntBoxName : "",
          locker: deliveryMethod === LOCKER_METHOD ? locker : null,
          address: deliveryMethod === DOOR_METHOD ? address : null,
          items: cart.map((item) => ({ sku: item.sku, qty: item.qty })),
        }),
      });

      const data = await response.json();

      if (data.success && data.paymentUrl) {
        try {
          localStorage.setItem(
            LAST_ORDER_KEY,
            JSON.stringify({
              orderNumber: data.orderNumber,
              grandTotal: data.grandTotal,
              customerName,
              deliveryMethod,
              locker: deliveryMethod === LOCKER_METHOD ? locker : null,
              address: deliveryMethod === DOOR_METHOD ? address : null,
              items: cart.map((item) => ({
                bait: displayName(item.bait),
                colour: item.colour,
                qty: item.qty,
                price: item.price,
              })),
            })
          );
        } catch {
          // Not essential.
        }
        // PayFast expects the payment details as a form POST, not a link.
        postToPayfast(data.paymentUrl);
        return;
      }

      setCheckoutError(data.error || "Something went wrong. Please try again.");
    } catch (error) {
      console.error("Checkout failed:", error);
      setCheckoutError("We couldn't reach the server. Check your connection and try again.");
    }

    setPlacingOrder(false);
  };

  // WhatsApp message with the cart already typed out
  const whatsappText = cart.length
    ? `Hi Geronimo Baits! I'm interested in:\n${cart
        .map((item) => `• ${item.qty}x ${displayName(item.bait)} - ${item.colour}`)
        .join("\n")}\nCould you help me with my order?`
    : "Hi Geronimo Baits! I have a question about your baits.";
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappText)}`;

  const scrollToCart = () =>
    document.getElementById("cart")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <main
      className="min-h-screen bg-cover bg-center bg-fixed px-6 py-24 text-white"
      style={{ backgroundImage: "url('/bg-main.webp')" }}
    >
      <a
        href="/"
        className="fixed left-6 top-6 z-50 rounded-xl border border-green-500 bg-black/80 px-5 py-2 font-bold text-green-500 backdrop-blur-md transition hover:bg-green-500 hover:text-black"
      >
        ← HOME
      </a>

      <div className="mx-auto mb-10 max-w-4xl rounded-3xl border border-green-500/30 bg-black/90 p-8 text-center backdrop-blur-md">
        <p className="mb-3 text-sm font-black tracking-[0.3em] text-green-500">
          HAND-POURED IN SA
        </p>

        <h1 className="text-5xl font-bold tracking-[0.25em]">
          CORE <span className="text-green-500">HUNT RANGE</span>
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-gray-300">
          Four proven bait styles. Limited colours. Hand-poured and built to hunt.
        </p>
      </div>

      {condition === "muddy" && (
        <div className="mx-auto mb-8 max-w-7xl rounded-3xl border border-green-500 bg-black/80 p-6">
          <h3 className="text-2xl font-black text-green-500">
            🌊 MUDDY WATER MODE
          </h3>
          <p className="mt-4 text-gray-300">Recommended Colours:</p>
          <ul className="mt-3 space-y-2 text-white">
            <li>• Junebug</li>
            <li>• Black and Blue</li>
            <li>• Watermelon Red</li>
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
            <li>• Green Pumpkin</li>
            <li>• Watermelon Red</li>
            <li>• SA Special</li>
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
            <li>• Junebug</li>
            <li>• Watermelon Red</li>
            <li>• Green Pumpkin</li>
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
            <li>• Junebug</li>
            <li>• SA Special</li>
          </ul>
        </div>
      )}

      <div className="mx-auto mb-8 max-w-7xl rounded-3xl border border-green-500/30 bg-black/80 p-6 backdrop-blur-md">
        <h2 className="text-2xl font-black tracking-widest text-green-500">
          BUILD YOUR HUNT BOX
        </h2>

        <p className="mt-2 text-gray-300">
          Choose your Geronimo box, fill it with your core range baits, then checkout.
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
              {activeCategory || "Loading baits..."}
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
                        src={`/product-images/${product.sku}.${IMAGE_EXTENSIONS[0]}`}
                        alt={`${displayName(product.bait)} - ${product.colour}`}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 hover:scale-110"
                        onError={(e) => {
                          // Try .jpeg, then .jpg, .webp, .png, then the placeholder.
                          const img = e.currentTarget;
                          const tried = Number(img.dataset.tried || 0) + 1;
                          img.dataset.tried = String(tried);
                          if (tried < IMAGE_EXTENSIONS.length) {
                            img.src = `/product-images/${product.sku}.${IMAGE_EXTENSIONS[tried]}`;
                          } else if (!img.src.endsWith("no-image.jpeg")) {
                            img.src = "/product-images/no-image.jpeg";
                            img.className = "max-h-full max-w-full object-contain";
                          }
                        }}
                      />
                    </div>

                    <h3 className="text-2xl font-bold text-white">
                      {product.colour}
                    </h3>

                    <p className="mt-2 text-lg font-bold text-green-500">
                      {formatRand(product.price)} / Pack
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
                      activeCategory === category
                        ? "bg-green-500 text-black"
                        : "border border-green-500 text-green-500 hover:bg-green-500 hover:text-black"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div
              id="cart"
              className="scroll-mt-6 rounded-3xl border border-green-500/30 bg-black/80 p-6 backdrop-blur-md"
            >
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
                        {item.qty}x {formatRand(item.price)}
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
                      {DELIVERY_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {deliveryLabel(method, cartPackCount)}
                        </option>
                      ))}
                    </select>

                    {deliveryMethod === LOCKER_METHOD && (
                      <PudoLockerPicker value={locker} onChange={setLocker} />
                    )}

                    {deliveryMethod === DOOR_METHOD && (
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Street address"
                          autoComplete="street-address"
                          value={address.street}
                          onChange={(e) => setAddress({ ...address, street: e.target.value })}
                          className="w-full rounded-xl border border-green-500/30 bg-black px-4 py-3 text-white"
                        />
                        <input
                          type="text"
                          placeholder="Suburb"
                          value={address.suburb}
                          onChange={(e) => setAddress({ ...address, suburb: e.target.value })}
                          className="w-full rounded-xl border border-green-500/30 bg-black px-4 py-3 text-white"
                        />
                        <div className="grid grid-cols-[1fr_110px] gap-3">
                          <input
                            type="text"
                            placeholder="City / Town"
                            autoComplete="address-level2"
                            value={address.city}
                            onChange={(e) => setAddress({ ...address, city: e.target.value })}
                            className="w-full rounded-xl border border-green-500/30 bg-black px-4 py-3 text-white"
                          />
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Code"
                            autoComplete="postal-code"
                            maxLength={4}
                            value={address.postalCode}
                            onChange={(e) =>
                              setAddress({ ...address, postalCode: e.target.value.replace(/\D/g, "") })
                            }
                            className="w-full rounded-xl border border-green-500/30 bg-black px-4 py-3 text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-green-500/20 pt-4">
                    <p className="text-lg font-bold text-white">
                      Order Summary
                    </p>

                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Products</span>
                        <span>{formatRand(cartTotal)}</span>
                      </div>

                      <div className="flex justify-between">
                        <span>Shipping</span>
                        <span>{formatRand(shippingCost)}</span>
                      </div>

                      <div className="flex justify-between border-t border-green-500/20 pt-2 text-lg font-black">
                        <span>Total</span>
                        <span className="text-green-500">{formatRand(grandTotal)}</span>
                      </div>
                    </div>

                    {huntBoxMode && cartPackCount !== huntBoxSize ? (
                      <div className="mt-4 rounded-xl bg-zinc-800 px-5 py-3 text-center font-bold text-zinc-400">
                        COMPLETE YOUR HUNT BOX
                      </div>
                    ) : checkoutReady ? (
                      <>
                        {checkoutError && (
                          <p className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400">
                            {checkoutError}
                          </p>
                        )}

                        <button
                          onClick={placeOrder}
                          disabled={placingOrder}
                          className="mt-6 w-full rounded-2xl border-2 border-green-500 bg-gradient-to-r from-green-500 to-green-400 px-6 py-5 text-xl font-black tracking-wide text-black shadow-lg shadow-green-500/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-green-500/60 disabled:cursor-wait disabled:opacity-70 disabled:hover:scale-100"
                        >
                          {placingOrder ? "⏳ PLACING ORDER..." : "💳 SECURE CHECKOUT"}
                          <div className="mt-1 text-sm font-semibold">
                            Pay securely with PayFast
                          </div>
                        </button>

                        <p className="mt-3 text-center text-xs text-gray-400">
                          By paying you agree to our{" "}
                          <Link href="/terms" className="text-green-500 hover:underline">Terms</Link>,{" "}
                          <Link href="/returns" className="text-green-500 hover:underline">Returns Policy</Link>{" "}
                          and{" "}
                          <Link href="/privacy" className="text-green-500 hover:underline">Privacy Policy</Link>.
                        </p>

                        <div className="mt-6 rounded-2xl border border-green-500/20 bg-black/60 p-5 text-center">
                          <p className="text-sm text-gray-300">
                            Need help with your order or looking for a custom colour?
                          </p>

                          <a
                            href={whatsappLink}
                            target="_blank"
                            rel="noopener noreferrer"
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

      <LegalFooter />

      {/* Mobile: quick link to the cart, which sits far down the page */}
      {cartPackCount > 0 && (
        <button
          type="button"
          onClick={scrollToCart}
          className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-between rounded-2xl border border-green-500 bg-black/95 px-5 py-4 font-black text-white shadow-lg shadow-green-500/30 backdrop-blur-md lg:hidden"
        >
          <span>
            🛒 {cartPackCount} {cartPackCount === 1 ? "pack" : "packs"}
            <span className="ml-2 text-green-500">{formatRand(grandTotal)}</span>
          </span>
          <span className="rounded-xl bg-green-500 px-4 py-2 text-sm text-black">CHECKOUT →</span>
        </button>
      )}
    </main>
  );
}