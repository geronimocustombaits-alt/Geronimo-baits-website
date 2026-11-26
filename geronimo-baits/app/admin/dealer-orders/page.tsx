import OrdersDashboard from "../OrdersDashboard";

// Dealer orders: orders that came in through a shop's private order link
export default function DealerOrdersPage() {
  return <OrdersDashboard scope="dealer" />;
}
