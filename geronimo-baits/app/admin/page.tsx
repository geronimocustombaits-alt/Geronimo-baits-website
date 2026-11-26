import OrdersDashboard from "./OrdersDashboard";

// Public orders: website and customer (Zoho) orders, not dealers
export default function AdminPage() {
  return <OrdersDashboard scope="public" />;
}
