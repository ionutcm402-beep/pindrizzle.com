import LegalPageShell from "@/components/LegalPageShell";
import { getPublicOperatorConfig } from "@/lib/launchReadiness";

export default function TermsPage() {
  const operator = getPublicOperatorConfig();
  const operatorPublished = Boolean(operator.operatorName && operator.operatorAddress && operator.supportEmail && operator.governingLaw);
  const livePayments = process.env.PING_STRIPE_ACCOUNT_READY === "true"
    && process.env.PING_LIVE_PAYMENTS_ENABLED === "true"
    && process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_");

  return (
    <LegalPageShell title="Terms of Use" kicker="COMMUNITY RULES" active="terms">
      <section className="legal-intro">
        <h2>Use Pindrizzle for useful, lawful local information.</h2>
        <p>These terms describe the rules for using Pindrizzle, including pins, Local Chat, safety controls, Marketplace listings, Deals and promoted placements.</p>
      </section>

      {!operatorPublished && <section className="legal-card legal-warning">
        <h2>Important launch status</h2>
        <p>Pindrizzle is still in pre-launch/closed-beta operation. Final reviewed operator identity, contact address and governing-law wording are deliberately not presented as complete until the production configuration is supplied.</p>
      </section>}

      {operatorPublished && <section className="legal-card legal-callout">
        <h2>Who provides Pindrizzle</h2>
        <p><b>{operator.operatorName}</b> · {operator.operatorAddress}</p>
        <div className="legal-links"><a href={`mailto:${operator.supportEmail}`}>{operator.supportEmail}</a>{operator.publicUrl && <a href={operator.publicUrl}>{operator.publicUrl}</a>}</div>
      </section>}

      <section className="legal-card">
        <h2>1. Eligibility and accounts</h2>
        <p>You must be at least 13 years old to create a Pindrizzle account. Signup requires a 13+ declaration. Keep your login details secure and use accurate account information. A display name or reputation score is not identity verification, and Pindrizzle does not guarantee that another user is who they claim to be.</p>
      </section>

      <section className="legal-card">
        <h2>2. What you may post</h2>
        <p>Pindrizzle is for useful local information such as alerts, traffic, lost and found items, free items, requests for help, local updates, events, Deals, Marketplace listings and nearby conversation in Local Chat. You are responsible for every pin, reply, Local Chat message, photo or external listing link you submit and must have the right to post it.</p>
        <p>You give Pindrizzle a non-exclusive licence to host, process, reproduce and display your submitted content only as reasonably needed to operate, secure, moderate and improve the service.</p>
      </section>

      <section className="legal-card">
        <h2>3. Content that is not allowed</h2>
        <ul>
          <li>Illegal content, credible threats, fraud, scams or instructions intended to facilitate crime.</li>
          <li>Child sexual abuse or exploitation material, sexual content involving minors, or grooming behaviour.</li>
          <li>Harassment, hateful abuse, stalking, doxxing or sharing someone’s sensitive personal information without a lawful reason.</li>
          <li>Content encouraging serious self-harm or suicide, or content designed to exploit a vulnerable person.</li>
          <li>Offers to sell illegal drugs, prohibited weapons, stolen goods or other unlawful products or services.</li>
          <li>Deceptive impersonation, spam, repetitive promotion or manipulated information intended to mislead neighbours.</li>
          <li>Exact home, school or other sensitive location details where sharing them creates an avoidable safety risk.</li>
        </ul>
        <div className="legal-links"><a href="/safety#chat-guidelines">Local Chat community guidelines</a></div>
      </section>

      <section className="legal-card">
        <h2>4. Location, Local Chat and safety</h2>
        <p>New pins default to <b>Private location</b>, which publishes an approximate nearby point instead of the precise point you selected. You may deliberately choose <b>Exact location</b>; if you do, the selected exact point is visible to people who can see that pin and is used for its public Map position and nearby distance.</p>
        <p>Local Chat uses your current location and the radius shared with Feed/Map to decide which nearby group conversation you can access. Local Chat is public to eligible signed-in people in that relevant radius; it is not a private-message service. Chat messages store an approximate snapped area point for radius matching rather than the precise device coordinate used to request nearby access.</p>
        <p>Do not choose Exact pin location for a home, school or other sensitive place unless you genuinely intend to publish that precise point. Do not place private addresses, phone numbers, school details or other sensitive identifiers in a pin or Local Chat message unless you have a lawful and appropriate reason to make them public. Photos can reveal a location visually even when metadata has been removed.</p>
      </section>

      <section className="legal-card">
        <h2>5. Reports, moderation and appeals</h2>
        <p>Users can report pins and Local Chat messages and can use block/hide controls. Reports for both features enter the same moderation system. Pindrizzle may hide, restrict, reject, expire or remove content and may restrict accounts where needed for safety, legality, spam prevention or service integrity. Moderation decisions are not guaranteed to be immediate.</p>
        <p>When a moderator removes a Local Chat message, the author can be shown the recorded removal reason. If you disagree with a moderation outcome or need to make a wider safety complaint, use the Safety page and its tracked moderation-appeal route.</p>
        <div className="legal-links"><a href="/safety#moderation-appeals">Safety, removal reasons and appeals</a></div>
      </section>

      <section className="legal-card">
        <h2>6. Promoted pins and payments</h2>
        <p>Promoted pins are labelled local placements and remain subject to moderation. Payment, when enabled, does not guarantee views, opens, replies, sales or other business results. The price, radius and duration are shown before any payment step.</p>
        <p>When paid promotions are enabled, you can leave Checkout before payment without charge. Once a paid placement has started, poor performance or a change of mind does not by itself create a refund entitlement. If Pindrizzle receives payment but cannot safely activate the promised placement, the payment flow is designed to request a Stripe refund. Other refunds or corrections may be made where required by law or where Pindrizzle determines the paid service was not supplied as agreed.</p>
        <p>Nothing in these terms excludes rights or remedies that cannot lawfully be excluded.</p>
        {!livePayments && <p><b>Current status:</b> real-money promotion payments are disabled. A dedicated Pindrizzle Stripe account and the production payment gates must be enabled before payments can be accepted.</p>}
      </section>

      <section className="legal-card">
        <h2>7. Service availability, expiry and retention</h2>
        <p>Pindrizzle may change, suspend or discontinue features as the product develops. Pins are designed to be temporary local information and use category-appropriate expiry periods that may be selected or adjusted when posting. Local Chat messages use a 90-day default retention period and are automatically anonymised after that period unless a still-pending safety/moderation review requires a temporary hold. Safety, moderation, payment or legal records may remain longer where appropriate.</p>
        <p>The service is provided for local information and conversation and is not a guaranteed source of verified facts.</p>
      </section>

      <section className="legal-card legal-callout">
        <h2>8. Emergencies</h2>
        <p><b>Pindrizzle is not an emergency service.</b> If someone is in immediate danger or urgent emergency help is needed, contact the appropriate emergency service directly — in the UK, call 999 or 112.</p>
      </section>

      <section className="legal-card">
        <h2>9. Contact and governing terms</h2>
        {operatorPublished ? <><p>Questions about these terms can be sent to <a href={`mailto:${operator.supportEmail}`}>{operator.supportEmail}</a>.</p><p>These terms use the governing-law wording reviewed for production: <b>{operator.governingLaw}</b>. Mandatory legal rights and jurisdiction rules continue to apply where they cannot be varied by contract.</p></> : <p>The final operator contact and governing-law wording must be configured and reviewed before Pindrizzle opens public access.</p>}
      </section>
    </LegalPageShell>
  );
}
