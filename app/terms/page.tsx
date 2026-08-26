import LegalPageShell from "@/components/LegalPageShell";

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Use" kicker="COMMUNITY RULES" active="terms">
      <section className="legal-intro">
        <h2>Use Ping for useful, lawful local information.</h2>
        <p>These terms describe the product rules being prepared for closed beta. Final operator identity, governing-law and launch payment details must be completed before public launch.</p>
      </section>

      <section className="legal-card legal-warning">
        <h2>Important launch status</h2>
        <p>These are operational beta terms, not a substitute for final legal review. Ping is still in pre-launch development and Stripe remains in test mode.</p>
      </section>

      <section className="legal-card">
        <h2>1. Eligibility and accounts</h2>
        <p>You must be at least 13 years old to create a Ping account. Keep your login details secure and use accurate account information. A display name or reputation score is not identity verification, and Ping does not guarantee that another user is who they claim to be.</p>
      </section>

      <section className="legal-card">
        <h2>2. What you may post</h2>
        <p>Ping is for time-sensitive, useful local updates such as alerts, traffic, lost and found items, free items, requests for help and local information. You are responsible for content you submit and must have the right to post any text or photo you upload.</p>
        <p>You give Ping a non-exclusive licence to host, process, reproduce and display your submitted content only as reasonably needed to operate, secure, moderate and improve the service.</p>
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
      </section>

      <section className="legal-card">
        <h2>4. Location and safety</h2>
        <p>Ping deliberately exposes approximate rather than exact public Ping locations. Do not defeat that protection by writing exact private addresses, phone numbers, school details or other sensitive identifiers into a Ping. Photos can reveal a location visually even when metadata has been removed.</p>
      </section>

      <section className="legal-card">
        <h2>5. Reports, moderation and appeals</h2>
        <p>Users can report Pings and use block/hide controls. Ping may hide, restrict, reject, expire or remove content and may restrict accounts where needed for safety, legality, spam prevention or service integrity. Moderation decisions are not guaranteed to be immediate.</p>
        <p>If you disagree with a moderation outcome or need to make a wider safety complaint, use the Safety page. A request submitted there receives a tracked status.</p>
        <div className="legal-links"><a href="/safety">Safety and complaints</a></div>
      </section>

      <section className="legal-card">
        <h2>6. Promoted Pings</h2>
        <p>Promoted Pings are labelled paid local placement and remain subject to moderation. Payment does not guarantee views, clicks, replies or business results. Prices and checkout terms must be shown before payment. The final refund/cancellation policy must be finalised before live payments are enabled.</p>
      </section>

      <section className="legal-card">
        <h2>7. Service availability and expiry</h2>
        <p>Ping may change, suspend or discontinue features as the product develops. Ordinary Pings are designed to be temporary and normally stop being publicly available after about 24 hours. The service is provided for local information and is not a guaranteed source of verified facts.</p>
      </section>

      <section className="legal-card legal-callout">
        <h2>8. Emergencies</h2>
        <p><b>Ping is not an emergency service.</b> If someone is in immediate danger or urgent emergency help is needed, contact the appropriate emergency service directly — in the UK, call 999 or 112.</p>
      </section>
    </LegalPageShell>
  );
}
