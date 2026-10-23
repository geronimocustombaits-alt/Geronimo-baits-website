import type { Metadata } from "next";
import { LegalPage, List, Section } from "@/app/components/LegalPage";
import { BUSINESS } from "@/lib/business";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Geronimo Baits collects, uses and protects your personal information (POPIA).",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="SHOP POLICIES"
      title="Privacy Policy"
      intro={
        <p>
          We only collect what we need to get your baits to you. This policy explains what we
          collect, why, who we share it with and your rights under the Protection of Personal
          Information Act (POPIA).
        </p>
      }
    >
      <Section title="1. Who is responsible">
        <p>
          The responsible party is {BUSINESS.legalName}, trading as {BUSINESS.tradingName},{" "}
          {BUSINESS.physicalAddress}. Our Information Officer is {BUSINESS.informationOfficer},
          who can be reached at {BUSINESS.email}.
        </p>
      </Section>

      <Section title="2. What we collect">
        <List
          items={[
            "Your name, phone number and email address.",
            "Your chosen PUDO locker or delivery address.",
            "What you ordered, the amount and the payment status PayFast sends us.",
            "Messages you send us on WhatsApp, email or Facebook.",
          ]}
        />
        <p>
          We do not receive or store your card or banking details. Those are handled by PayFast.
        </p>
      </Section>

      <Section title="3. Why we use it">
        <List
          items={[
            "To process, pack and deliver your order and send you your order confirmation.",
            "To contact you about your order, a return or a stock problem.",
            "To keep accounting and tax records, as the law requires.",
            "To prevent fraud and keep the shop secure.",
          ]}
        />
        <p>
          We do not sell your information, and we only send you promotions if you have asked to
          receive them. You can opt out at any time.
        </p>
      </Section>

      <Section title="4. Who we share it with">
        <p>
          We share only what each service needs to do its job for us. They are bound to keep it
          confidential and secure.
        </p>
        <List
          items={[
            "PayFast: to take your payment.",
            "PUDO and The Courier Guy: to deliver your parcel.",
            "Resend: to send order emails.",
            "Google (Google Sheets): where we keep our order and stock records.",
            "Zoho Books: our accounting and invoicing system.",
            "Vercel: the company that hosts this website.",
          ]}
        />
        <p>
          Some of these services store information on servers outside South Africa. We only use
          services that protect personal information to a standard similar to POPIA, as section 72
          of the Act requires.
        </p>
      </Section>

      <Section title="5. Your browser">
        <p>
          The shop saves your cart and checkout details in your own browser, so they are still
          there if you come back later. This stays on your device and you can clear it by
          clearing your browser data. We do not use advertising or tracking cookies. The only
          cookie we set is a login cookie for our own staff on the admin pages.
        </p>
      </Section>

      <Section title="6. How long we keep it">
        <p>
          We keep order and invoice records for at least 5 years, because South African tax law
          requires it. Other information, such as messages, is deleted once it is no longer
          needed.
        </p>
      </Section>

      <Section title="7. Keeping it safe">
        <p>
          Our records are kept in password-protected accounts that only we can open, and the site
          uses a secure (HTTPS) connection. If we ever learn of a breach that affects your
          information, we will tell you and the Information Regulator as POPIA requires.
        </p>
      </Section>

      <Section title="8. Your rights">
        <List
          items={[
            "Ask what personal information we hold about you and get a copy.",
            "Ask us to correct or delete it.",
            "Object to us using it, including for promotions.",
            <>
              Complain to the Information Regulator at{" "}
              <a
                href="https://inforegulator.org.za"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-500 hover:underline"
              >
                inforegulator.org.za
              </a>
              .
            </>,
          ]}
        />
        <p>
          To use any of these rights, email {BUSINESS.email}. We may ask you to confirm who you
          are before we share or change anything.
        </p>
      </Section>

      <Section title="9. Children">
        <p>
          The shop is meant for adults. If you are under 18, please ask a parent or guardian to
          place the order.
        </p>
      </Section>

      <Section title="10. Changes">
        <p>
          We may update this policy from time to time. The date at the top shows when it last
          changed.
        </p>
      </Section>
    </LegalPage>
  );
}
