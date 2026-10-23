import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, List, Section } from "@/app/components/LegalPage";
import { BUSINESS } from "@/lib/business";
import { LOCKER_RATES, shippingCostFor, DOOR_METHOD } from "@/lib/shop";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "The terms that apply when you buy from the Geronimo Baits online shop.",
};

const lockerTiers = LOCKER_RATES.map((tier, i) => {
  const from = i === 0 ? 1 : LOCKER_RATES[i - 1].maxPacks + 1;
  const range = Number.isFinite(tier.maxPacks) ? `${from}–${tier.maxPacks} packs` : `${from}+ packs`;
  return `${range}: R${tier.price}`;
}).join(", ");

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="SHOP POLICIES"
      title="Terms and Conditions"
      intro={
        <p>
          These terms apply when you buy from the {BUSINESS.tradingName} website. By placing an
          order you agree to them, so please read them along with our{" "}
          <Link href="/returns" className="text-green-500 hover:underline">
            Returns and Refunds Policy
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-green-500 hover:underline">
            Privacy Policy
          </Link>
          . Nothing in these terms takes away your rights under the Consumer Protection Act or the
          Electronic Communications and Transactions Act.
        </p>
      }
    >
      <Section title="1. Who we are">
        <p>
          {BUSINESS.tradingName} makes hand-poured soft plastic fishing baits in South Africa. The
          seller is {BUSINESS.legalName}, {BUSINESS.physicalAddress}. Our contact details are at
          the bottom of this page.
        </p>
      </Section>

      <Section title="2. Handmade products">
        <p>
          Every bait is poured by hand in small batches. Colour, flake and size can vary slightly
          from batch to batch and from the photos on the site. That is part of a handmade product
          and is not a defect.
        </p>
      </Section>

      <Section title="3. Prices">
        <List
          items={[
            "All prices are in South African Rand (ZAR).",
            "The price shown at checkout is the price you pay. Delivery is shown separately before you pay.",
            "We may change prices on the site at any time, but this never affects an order that has already been paid.",
            "If a price is clearly wrong because of a mistake on the site, we will contact you before sending and you may cancel for a full refund.",
          ]}
        />
      </Section>

      <Section title="4. Orders and stock">
        <List
          items={[
            "Stock on the site comes from our live inventory, but it can occasionally sell out between you adding a bait to your cart and paying.",
            "Your order is accepted once PayFast confirms your payment and you receive an order number starting with GB-.",
            "If something you paid for turns out to be out of stock, we will contact you to offer a swap, a wait for the next batch, or a full refund of that item.",
            "Hunt Boxes must contain the number of packs stated for that box.",
          ]}
        />
      </Section>

      <Section title="5. Payment">
        <p>
          Payments are processed securely by PayFast. You can pay with any method PayFast offers
          at checkout. We never see or store your card or banking details. If you cancel on the
          PayFast page, no payment is taken and your cart stays saved.
        </p>
      </Section>

      <Section title="6. Delivery">
        <List
          items={[
            <>PUDO Locker (locker delivery): {lockerTiers}.</>,
            <>
              PUDO Door-to-Door: R{shippingCostFor(DOOR_METHOD, 1)} to a street address in South
              Africa.
            </>,
            "Collection: free, by arrangement with us on WhatsApp.",
            <>
              We aim to pack and send paid orders within {BUSINESS.dispatchTime}. Courier delivery
              times are set by the courier and can be longer in busy periods.
            </>,
            "Please make sure your phone number, email and locker or address are correct. We are not responsible for delays or loss caused by wrong details.",
            "Once the parcel is handed to you or placed in your chosen locker, it is your responsibility. Please collect locker parcels within the time PUDO gives you.",
          ]}
        />
      </Section>

      <Section title="7. Using our baits safely">
        <List
          items={[
            "Soft plastics are small parts. Keep them away from young children and pets.",
            "Do not leave baits in a hot car or in direct sun. Heat can deform them and make colours bleed.",
            "Store different colours separately, and keep soft plastics away from hard lures and painted surfaces, which some plastics can react with.",
            "Hooks, weights and other tackle are sharp or heavy. Fish responsibly and follow local fishing regulations and licence rules.",
          ]}
        />
      </Section>

      <Section title="8. Returns, cancellations and faulty products">
        <p>
          You can cancel an online order within 7 days of receiving it, and you are protected if a
          product is faulty. The details are in our{" "}
          <Link href="/returns" className="text-green-500 hover:underline">
            Returns and Refunds Policy
          </Link>
          .
        </p>
      </Section>

      <Section title="9. Our responsibility">
        <p>
          We take care to make good-quality baits, but we cannot promise any particular catch.
          As far as the law allows, we are not responsible for indirect losses (for example lost
          fishing time or travel costs). This does not limit any right you have under the Consumer
          Protection Act, or our responsibility for harm caused by our gross negligence.
        </p>
      </Section>

      <Section title="10. Our content">
        <p>
          The Geronimo Baits name, logo, photos and text on this site belong to us. Please don&apos;t
          copy them for commercial use without asking. Catch photos are shared with the
          anglers&apos; permission.
        </p>
      </Section>

      <Section title="11. Changes and law">
        <p>
          We may update these terms from time to time. The version on the site when you placed
          your order applies to that order. These terms are governed by the laws of the Republic of
          South Africa.
        </p>
      </Section>
    </LegalPage>
  );
}
