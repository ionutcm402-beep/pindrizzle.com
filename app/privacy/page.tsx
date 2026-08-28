import LegalPageShell from "@/components/LegalPageShell";
import ComplianceRequestPanel, { type RequestOption } from "@/components/ComplianceRequestPanel";
import { getPublicOperatorConfig } from "@/lib/launchReadiness";

const privacyOptions: RequestOption[] = [
  { value: "data_access", label: "Access a copy of my data" },
  { value: "data_erasure", label: "Delete my account or data" },
  { value: "data_correction", label: "Correct inaccurate data" },
  { value: "data_restriction", label: "Restrict processing" },
  { value: "data_objection", label: "Object to processing" },
  { value: "other", label: "Data protection complaint / other" },
];

export default function PrivacyPage() {
  const operator = getPublicOperatorConfig();
  const operatorPublished = Boolean(operator.operatorName && operator.operatorAddress && operator.privacyEmail);

  return (
    <LegalPageShell title="Privacy Notice" kicker="YOUR DATA" active="privacy">
      <section className="legal-intro">
        <h2>Local information with clear control over location precision.</h2>
        <p>This notice explains the personal information Pindrizzle currently uses, why it uses it, how long it may be kept, and how to make a rights request.</p>
      </section>

      {!operatorPublished && <section className="legal-card legal-warning">
        <h2>Launch-status notice</h2>
        <p>Pindrizzle is still being prepared for public launch. The final operator/controller identity and dedicated privacy contact are deliberately not presented as complete until the reviewed production values are configured. This page records the product’s current data practices; it is not a claim of completed legal certification.</p>
      </section>}

      {operatorPublished && <section className="legal-card legal-callout">
        <h2>Who operates Pindrizzle</h2>
        <p><b>{operator.operatorName}</b> is the operator/controller contact published for Pindrizzle.</p>
        <p>{operator.operatorAddress}</p>
        <div className="legal-links"><a href={`mailto:${operator.privacyEmail}`}>Privacy: {operator.privacyEmail}</a>{operator.supportEmail && <a href={`mailto:${operator.supportEmail}`}>Support: {operator.supportEmail}</a>}</div>
      </section>}

      <section className="legal-card">
        <h2>What Pindrizzle uses</h2>
        <ul>
          <li><b>Account data:</b> your email address, authentication identifiers, account-security records, your 13+ signup declaration and the versions of the Terms/Privacy Notice accepted at signup.</li>
          <li><b>Public profile data:</b> display name, account age and activity-based reputation signals. Your email is not shown publicly.</li>
          <li><b>Community content:</b> pins, replies, photos, confirmations and Helpful signals you choose to submit.</li>
          <li><b>Location:</b> device coordinates are used to find nearby activity and create pins. New pins default to Private location, which publishes an approximate nearby area. If you explicitly choose Exact location, the selected exact point is public to people who can see that pin.</li>
          <li><b>Safety and rights records:</b> reports, blocks, hidden content, moderation decisions, privacy-rights requests, safety complaints and moderation appeals needed to operate safety and compliance controls.</li>
          <li><b>Notifications:</b> notification preferences and, if enabled, browser push subscription details needed to deliver push messages.</li>
          <li><b>Promotions and payments:</b> promotion requests and payment-status metadata are used if paid promotion features are enabled. When payments are enabled, Stripe handles payment processing; Pindrizzle does not need your full card number.</li>
          <li><b>Optional product analytics:</b> only after you choose Allow analytics, Pindrizzle records a random browser-session identifier and coarse events such as Feed, Map or Search use. It does not record search text or exact location in the product analytics table.</li>
        </ul>
      </section>

      <section className="legal-card">
        <h2>Why the information is used</h2>
        <p>Pindrizzle uses account and service data to provide the features you ask for, including authentication, nearby results, posting, replies, notifications and promotions when enabled. Safety and security information is used to prevent abuse, investigate reports and protect the service. Optional product analytics is based on your browser choice and is used to understand whether core product areas are useful.</p>
        <p>Depending on the processing, the intended UK data-protection basis may include performance of the service, legitimate interests in safety/security/service operation, consent for optional analytics, and legal obligations where applicable. These bases must be confirmed in the final launch legal review.</p>
      </section>

      <section className="legal-card">
        <h2>Visibility and location privacy</h2>
        <p>Nearby Feed and Map queries use your device location when you enable location permission. When you create a pin, <b>Private location is the default</b>: Pindrizzle snaps the selected point to an approximate nearby area before it is shown publicly. Pindrizzle does not silently turn a Private pin into an Exact one.</p>
        <p>If you deliberately choose <b>Exact location</b>, the exact point you select is visible to people who can see that pin and is used for its public Map position and nearby distance. Do not choose Exact for a home, school or other sensitive place unless you genuinely intend to publish that precise point.</p>
        <p>Uploaded pin photos are re-encoded in the browser before upload to reduce metadata such as EXIF/GPS. This is a privacy safeguard, not a guarantee that a photo’s visible contents cannot reveal a location.</p>
      </section>

      <section className="legal-card">
        <h2>Retention</h2>
        <p>Active pins normally stop being publicly available after their chosen category-specific expiry, but expiry is not the same as immediate database deletion. Safety, moderation, payment, security and legal records may need to be retained longer. Raw optional product analytics is designed to age out after up to 90 days. Account data is retained while the account exists unless deletion is appropriate, subject to safety, fraud, payment or legal retention needs.</p>
      </section>

      <section className="legal-card">
        <h2>Service providers</h2>
        <p>Pindrizzle currently relies on Supabase for database/authentication/storage services, Vercel for application hosting, browser/web-push infrastructure for push delivery, and OpenStreetMap-derived map/place services for map and place features. Stripe is used for payment processing only when paid features are enabled. Those providers can receive ordinary technical request information needed to deliver their services.</p>
        <p>Some providers may process information outside the UK. The final launch review must document the relevant provider locations and applicable contractual or transfer safeguards rather than assuming one mechanism fits every provider.</p>
      </section>

      <ComplianceRequestPanel
        title="Your data rights and complaints"
        copy="Sign in to make a request tied to your Pindrizzle account. Requests are recorded with a status so you can track them. A deletion request is reviewed rather than silently deleting records that may still be required for safety, fraud, payment or legal reasons."
        options={privacyOptions}
      />

      <section className="legal-card">
        <h2>If you remain unhappy</h2>
        <p>You can raise a data-protection complaint with Pindrizzle through the request form above{operator.privacyEmail ? ` or by emailing ${operator.privacyEmail}` : ""}. You also have the right to complain to the UK Information Commissioner’s Office.</p>
        <div className="legal-links">{operator.privacyEmail && <a href={`mailto:${operator.privacyEmail}`}>Email Pindrizzle privacy</a>}<a href="https://ico.org.uk/make-a-complaint" target="_blank" rel="noreferrer">Open the ICO complaints service ↗</a></div>
      </section>
    </LegalPageShell>
  );
}