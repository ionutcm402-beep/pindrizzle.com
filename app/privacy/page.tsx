import LegalPageShell from "@/components/LegalPageShell";
import ComplianceRequestPanel, { type RequestOption } from "@/components/ComplianceRequestPanel";

const privacyOptions: RequestOption[] = [
  { value: "data_access", label: "Access a copy of my data" },
  { value: "data_erasure", label: "Delete my account or data" },
  { value: "data_correction", label: "Correct inaccurate data" },
  { value: "data_restriction", label: "Restrict processing" },
  { value: "data_objection", label: "Object to processing" },
  { value: "other", label: "Data protection complaint / other" },
];

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Notice" kicker="YOUR DATA" active="privacy">
      <section className="legal-intro">
        <h2>Local information without exposing your exact public position.</h2>
        <p>This notice explains the personal information Ping currently uses, why it uses it, how long it may be kept, and how to make a rights request.</p>
      </section>

      <section className="legal-card legal-warning">
        <h2>Launch-status notice</h2>
        <p>Ping is still being prepared for closed beta and public launch. The final legal entity/controller name, dedicated privacy contact, governing terms and provider-transfer details must be published before public launch. This page records the product’s current data practices; it is not a claim of completed legal certification.</p>
      </section>

      <section className="legal-card">
        <h2>What Ping uses</h2>
        <ul>
          <li><b>Account data:</b> your email address, authentication identifiers and account-security records.</li>
          <li><b>Public profile data:</b> display name, account age and activity-based reputation signals. Your email is not shown publicly.</li>
          <li><b>Community content:</b> Pings, replies, photos, confirmations and Helpful signals you choose to submit.</li>
          <li><b>Location:</b> device coordinates are used to find nearby activity and create Pings. Public Ping locations are deliberately approximate; exact browser coordinates are not displayed publicly.</li>
          <li><b>Safety records:</b> reports, blocks, hidden content and moderation decisions needed to operate community safety controls.</li>
          <li><b>Notifications:</b> notification preferences and, if enabled, browser push subscription details needed to deliver push messages.</li>
          <li><b>Promotions and payments:</b> promotion requests and payment-status metadata. Payment processing is handled through Stripe; Ping does not need your full card number.</li>
          <li><b>Optional product analytics:</b> only after you choose Allow analytics, Ping records a random browser-session identifier and coarse events such as Feed, Map or Search use. It does not record search text or exact location in the product analytics table.</li>
        </ul>
      </section>

      <section className="legal-card">
        <h2>Why the information is used</h2>
        <p>Ping uses account and service data to provide the features you ask for, including authentication, nearby results, posting, replies, notifications and promotions. Safety and security information is used to prevent abuse, investigate reports and protect the service. Optional product analytics is based on your browser choice and is used to understand whether core product areas are useful.</p>
        <p>Depending on the processing, the intended UK data-protection basis may include performance of the service, legitimate interests in safety/security/service operation, consent for optional analytics, and legal obligations where applicable. These bases must be confirmed in the final launch legal review.</p>
      </section>

      <section className="legal-card">
        <h2>Visibility and location privacy</h2>
        <p>Nearby Feed and Map queries use your device location when you enable location permission. Ping’s posting flow receives coordinates so it can create a nearby Ping, but the public location is snapped/approximated before exposure. Do not put a home address, school address, phone number or other sensitive precise location in Ping text or photos.</p>
        <p>Uploaded Ping photos are re-encoded in the browser before upload to reduce metadata such as EXIF/GPS. This is a privacy safeguard, not a guarantee that a photo’s visible contents cannot reveal a location.</p>
      </section>

      <section className="legal-card">
        <h2>Retention</h2>
        <p>Active Pings normally stop being publicly available after about 24 hours, but expiry is not the same as immediate database deletion. Safety, moderation, payment, security and legal records may need to be retained longer. Raw optional product analytics is designed to age out after up to 90 days. Account data is retained while the account exists unless deletion is appropriate, subject to safety, fraud, payment or legal retention needs.</p>
      </section>

      <section className="legal-card">
        <h2>Service providers</h2>
        <p>Ping currently relies on Supabase for database/authentication/storage services, Vercel for application hosting, Stripe for payment processing, browser/web-push infrastructure for push delivery, and OpenStreetMap-derived map/place services for map and place features. Those providers can receive ordinary technical request information needed to deliver their services.</p>
        <p>Some providers may process information outside the UK. The final launch review must document the relevant provider locations and applicable contractual or transfer safeguards rather than assuming one mechanism fits every provider.</p>
      </section>

      <ComplianceRequestPanel
        title="Your data rights and complaints"
        copy="Sign in to make a request tied to your Ping account. Requests are recorded with a status so you can track them. A deletion request is reviewed rather than silently deleting records that may still be required for safety, fraud, payment or legal reasons."
        options={privacyOptions}
      />

      <section className="legal-card">
        <h2>If you remain unhappy</h2>
        <p>You can raise a data-protection complaint with Ping through the request form above. You also have the right to complain to the UK Information Commissioner’s Office.</p>
        <div className="legal-links"><a href="https://ico.org.uk/make-a-complaint" target="_blank" rel="noreferrer">Open the ICO complaints service ↗</a></div>
      </section>
    </LegalPageShell>
  );
}
