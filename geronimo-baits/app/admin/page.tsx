export default async function AdminPage() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const response = await fetch(`${baseUrl}/api/admin/orders`, {
    cache: "no-store",
  });

  const orders = response.ok ? await response.json() : [];

  const totalOrders = orders.length;

  const pendingOrders = orders.filter(
    (order: any) =>
      String(order.paymentStatus || "").toLowerCase() === "pending"
  ).length;

  const paidOrders = orders.filter(
    (order: any) =>
      String(order.paymentStatus || "").toLowerCase() === "paid"
  ).length;

  const revenue = orders.reduce((sum: number, order: any) => {
    const amount = Number(order.total || order.grandTotal || 0);
    return sum + amount;
  }, 0);

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <section className="mx-auto max-w-7xl">
        <div className="mb-10">
          <p className="text-sm font-black tracking-[0.4em] text-green-500">
            GERONIMO BAITS
          </p>

          <h1 className="mt-3 text-5xl font-black">
            ADMIN DASHBOARD
          </h1>

          <p className="mt-3 text-gray-400">
            Manage orders, payments and packing progress.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-4">
          <div className="rounded-3xl border border-green-500/20 bg-black/70 p-6">
            <p className="text-sm font-bold text-gray-400">TOTAL ORDERS</p>
            <h2 className="mt-3 text-4xl font-black text-green-500">
              {totalOrders}
            </h2>
          </div>

          <div className="rounded-3xl border border-yellow-500/30 bg-black/70 p-6">
            <p className="text-sm font-bold text-gray-400">PENDING</p>
            <h2 className="mt-3 text-4xl font-black text-yellow-400">
              {pendingOrders}
            </h2>
          </div>

          <div className="rounded-3xl border border-green-500/20 bg-black/70 p-6">
            <p className="text-sm font-bold text-gray-400">PAID</p>
            <h2 className="mt-3 text-4xl font-black text-green-500">
              {paidOrders}
            </h2>
          </div>

          <div className="rounded-3xl border border-green-500/20 bg-black/70 p-6">
            <p className="text-sm font-bold text-gray-400">REVENUE</p>
            <h2 className="mt-3 text-4xl font-black text-green-500">
              R{revenue.toFixed(2)}
            </h2>
          </div>
        </div>

        <div className="mt-10 rounded-3xl border border-green-500/20 bg-black/70 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-black">ORDERS</h2>
            <p className="text-sm text-gray-400">
              {totalOrders} orders found
            </p>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-2xl border border-green-500/20 bg-black p-8 text-center text-gray-400">
              No orders found yet.
            </div>
          ) : (
            <div className="grid gap-4">
              {orders.map((order: any, index: number) => (
                <div
                  key={index}
                  className="rounded-2xl border border-green-500/20 bg-black p-5"
                >
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                      <p className="text-xs font-bold tracking-[0.25em] text-green-500">
                        ORDER
                      </p>

                      <h3 className="mt-1 text-2xl font-black">
                        {order.orderNumber || "No order number"}
                      </h3>

                      <p className="mt-2 text-gray-400">
                        {order.customerName || "No customer"} •{" "}
                        {order.customerEmail || "No email"}
                      </p>
                    </div>

                    <div className="text-left md:text-right">
                      <p className="text-sm text-gray-400">Total</p>
                      <p className="text-2xl font-black text-green-500">
                        R{Number(order.total || order.grandTotal || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-green-500/10 bg-black/70 p-4">
                      <p className="text-xs font-bold text-gray-500">
                        PAYMENT STATUS
                      </p>
                      <p className="mt-1 font-black text-yellow-400">
                        {order.paymentStatus || "Pending"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-green-500/10 bg-black/70 p-4">
                      <p className="text-xs font-bold text-gray-500">
                        ORDER STATUS
                      </p>
                      <p className="mt-1 font-black text-green-500">
                        {order.orderStatus || "New"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-green-500/10 bg-black/70 p-4">
                      <p className="text-xs font-bold text-gray-500">
                        DELIVERY
                      </p>
                      <p className="mt-1 font-black">
                        {order.deliveryMethod || "Not supplied"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-green-500/10 bg-black/70 p-4">
                    <p className="text-xs font-bold text-gray-500">ITEMS</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-300">
                      {order.items || order.products || "No items listed"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}