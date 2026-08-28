import LegalPageShell from "@/components/LegalPageShell";
import ComplianceRequestPanel, { type RequestOption } from "@/components/ComplianceRequestPanel";
import { getPublicOperatorConfig } from "@/lib/launchReadiness";

const safetyOptions: RequestOption[] = [
  { value: "safety_complaint", label: "Safety / illegal-content complaint" },
  { value: "moderation_appeal", label: "Appeal a moderation decision" },
];

export default function SafetyPage() {
  const operator = getPublicOperatorConfig();
  const safetyReady = process.env.PING_ONLINE_SAFETY_REVIEW_COMPLETE === "true" && process.env.PING_LEGAL_REVIEW_COMPLETE === "true" && Boolean(operator.safetyEmail);

  return (
    <LegalPageShell title="Safety & Complaints" kicker="ONLINE SAFETY" active="safety">
      <section className="legal-intro">
        <h2>Report the content first. Escalate the wider complaint here.</h2>
        <p>Pindrizzle has in-product report, block and hide controls for pins and Local Chat. This page adds a tracked route for broader safety complaints and moderation appeals.</p>
      </section>

      <section className="legal-card legal-callout">
        <h2>Immediate danger</h2>
        <p><b>Pindrizzle is not an emergency service.</b> If someone is in immediate danger, contact emergency services directly. In the UK, call 999 or 112. Do not rely on a Pindrizzle report for emergency response.</p>
      </section>

      <section className="legal-card">
        <h2>Report a pin or Local Chat message</h2>
        <p>Open the relevant content, choose <b>Report</b>, select the reason and send it. A report hides that item from your own experience and routes the case into the same Pindrizzle moderation queue. You can also block a user so their pins and Local Chat messages no longer appear to you.</p>
        <p>Use the complaint form below when the issue is broader than one item, you believe illegal or seriously harmful content was not handled properly, or you want to appeal a moderation decision.</p>
        {operator.safetyEmail && <div className="legal-links"><a href={`mailto:${operator.safetyEmail}`}>Safety contact: {operator.safetyEmail}</a></div>}
      </section>

      <section className="legal-card" id="chat-guidelines">
        <h2>Local Chat community guidelines</h2>
        <p>Local Chat is a public nearby group conversation, not a private-message service. Keep it useful, respectful and safe for the people who share your area.</p>
        <ul>
          <li>No harassment, threats, hateful abuse, intimidation or targeting another person.</li>
          <li>No spam, repetitive promotion, scams, deceptive links or attempts to move people into suspicious off-platform contact.</li>
          <li>Do not publish another person’s home address, phone number, school, routine, live location or other sensitive personal information without a lawful and appropriate reason.</li>
          <li>No sexual content involving minors, grooming, child sexual abuse material or material that facilitates child exploitation.</li>
          <li>No illegal sales, serious fraud, instructions intended to facilitate crime, or encouragement of serious self-harm.</li>
          <li>Do not use Local Chat to impersonate someone, coordinate stalking, or deliberately spread dangerous false information.</li>
        </ul>
        <p>Report content that breaks these rules. Blocking is available when you no longer want to see a person’s nearby content.</p>
      </section>

      <section className="legal-card">
        <h2>Children and teenagers</h2>
        <p>Pindrizzle accounts are intended for people aged 13 or over. Because people aged 13–17 may use the service, Pindrizzle treats children as likely users rather than assuming the service is adults-only.</p>
        <ul>
          <li>There are no direct messages in the current product. Local Chat is a public radius-based group conversation visible to eligible signed-in people nearby.</li>
          <li>Public profiles are deliberately minimal and do not show email or a user’s precise device location.</li>
          <li>New pins default to Private location, which publishes an approximate nearby point. Exact pin location is only public when the poster explicitly chooses it.</li>
          <li>Local Chat messages use an approximate snapped area point for radius matching; the Chat interface does not display that point.</li>
          <li>Do not post a child’s school, home address, phone number, routine or other precise identifying information.</li>
          <li>Do not use Exact pin location for a child’s home, school or routine location, and do not use photos that visibly reveal sensitive addresses, school identifiers or other avoidable location clues.</li>
        </ul>
      </section>

      <section className="legal-card legal-callout">
        <h2>Priority child-safety reports</h2>
        <p>Local Chat has a distinct <b>Child sexual abuse material</b> report category. Those reports are surfaced as <b>Critical</b> at the top of the existing human moderation queue rather than being mixed into routine spam or harassment cases.</p>
        <p>A user allegation does not automatically trigger an external report. If human review identifies content that creates a legal reporting, preservation or escalation duty, the responsible safety/legal reviewer must follow the applicable required process. That operational process and accountable owner still require formal legal review before wide launch.</p>
      </section>

      <section className="legal-card">
        <h2>Priority safety rules</h2>
        <p>Content involving child sexual abuse or exploitation, credible threats, terrorism, serious fraud/scams, illegal drug or weapons sales, stalking/doxxing, hateful abuse, or encouragement of serious self-harm is not permitted. Pindrizzle can remove or restrict content and accounts where needed for safety or legality.</p>
      </section>

      <section className="legal-card" id="moderation-appeals">
        <h2>Removal reasons and appeals</h2>
        <p>If a moderator removes your Local Chat message, Local Chat shows the moderation reason recorded with that decision. If you believe a removal was mistaken or you need more information, submit a moderation appeal below. Moderation history keeps the reviewer’s recorded decision even after the underlying chat message later reaches its retention limit.</p>
      </section>

      <ComplianceRequestPanel
        title="Safety complaint or moderation appeal"
        copy="Sign in to create a tracked complaint. Your submission appears immediately in your request history with an Open status and can then be reviewed through Pindrizzle’s moderation/compliance workflow. Include the pin, Local Chat message, date or decision involved where possible, but do not upload unnecessary sensitive personal information."
        options={safetyOptions}
      />

      {!safetyReady ? <section className="legal-card legal-warning">
        <h2>Pre-launch safety work still required</h2>
        <p>Pindrizzle’s current safety controls are product safeguards, not a declaration of full Online Safety Act or other jurisdiction-specific compliance. Before public launch, Pindrizzle still needs formally maintained illegal-content and children’s risk assessments, accountable safety ownership/contact, escalation and evidence-preservation procedures, complaint-service targets and final legal review recorded as complete.</p>
      </section> : <section className="legal-card legal-callout">
        <h2>Safety ownership published</h2>
        <p>Pindrizzle’s production configuration records the required safety/legal review as complete. Safety complaints can be submitted through the tracked form above{operator.safetyEmail ? ` or by emailing ${operator.safetyEmail}` : ""}.</p>
      </section>}
    </LegalPageShell>
  );
}
