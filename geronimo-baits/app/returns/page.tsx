import type { Metadata } from "next";
import { LegalPage, List, Section } from "@/app/components/LegalPage";
import { BUSINESS, whatsappLink } from "@/lib/business";

export const metadata: Metadata = {
  title: "Returns and Refunds",
  description: "How to cancel, return or report a problem with a Geronimo Baits order.",
};

export default function ReturnsPage() {
  return (
    <LegalPage
      eyebrow="SHOP POLICIES"
      title="Returns and Refunds"
      intro={
        <p>
          If something isn&apos;t right with your order, message us first. Most problems are sorted
          quickly on{" "}
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:underline">
            WhatsApp
          </a>
          . This policy sets out your rights under South African law.
        </p>
      }
    >
      <Section title="1. Changed your mind? 7-day cancellation">
        <p>
          Because you bought online, you may cancel your order within 7 days of receiving it,
          without giving a reason (Electronic Communications and Transactions Act, section 44).
        </p>
        <List
          items={[
            "The baits must be unused and in their original, sealed packaging.",
            "You pay the cost of sending the parcel back to us.",
            "We refund the price of the returned items, and the original delivery fee if you return the whole order, within 30 days of you cancelling.",
            "This does not apply to custom colours or other baits made specially to your request.",
          ]}
        />
      </Section>

      <Section title="2. Faulty baits">
        <p>
          If a bait is faulty, you may return it within 6 months of delivery (Consumer Protection
          Act, section 56). You choose whether we replace it or refund you, and we pay the return
          delivery.
        </p>
        <p>Faults include baits that arrive split, badly mis-poured or stuck together in the pack.</p>
        <p>These are not faults:</p>
        <List
          items={[
            "Normal wear from fishing, such as tears from fish bites, hook holes or casting.",
            "Damage from heat, sun or storing baits in contact with other tackle.",
            "The small colour and size differences that come with handmade baits.",
          ]}
        />
      </Section>

      <Section title="3. Wrong item or damaged in delivery">
        <p>
          If we sent the wrong bait, something is missing, or the parcel arrived damaged, let us
          know within 48 hours of collecting it, with your GB- order number and a photo. We will
          send the right item or refund you, at no cost to you.
        </p>
      </Section>

      <Section title="4. How to return something">
        <List
          items={[
            <>
              WhatsApp us on {BUSINESS.phoneDisplay} or email {BUSINESS.email} with your GB- order
              number, what you are returning and why.
            </>,
            "We will reply with the return details, usually a PUDO locker to send it to.",
            "Please don't send a parcel back before we have confirmed the return.",
            "Once it arrives and we have checked it, we will confirm your refund or replacement.",
          ]}
        />
      </Section>

      <Section title="5. How refunds are paid">
        <p>
          Refunds go back through PayFast to the way you paid, or by EFT to your bank account if
          that is not possible. Depending on your bank, it can take a few working days to show.
        </p>
      </Section>

      <Section title="6. Cancelling before we send">
        <p>
          If you want to cancel a paid order before it has been sent, message us as soon as
          possible. If it has not been packed yet, we will refund you in full.
        </p>
      </Section>
    </LegalPage>
  );
}
