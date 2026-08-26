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
        <p>Ping already has in-product report, block and hide controls. This page adds a tracked route for broader safety complaints and moderation appeals.</p>
      </section>

      <section className="legal-card legal-callout">
        <h2>Immediate danger</h2>
        <p><b>Ping is not an emergency service.</b> If someone is in immediate danger, contact emergency services directly. In the UK, call 999 or 112. Do not rely on a Ping report for emergency response.</p>
      </section>

      <section className="legal-card">
        <h2>Report a Ping</h2>
        <p>Open the Ping, choose <b>Report</b>, select the reason and send it. A report hides the Ping from your own Feed and Map and routes the case into Ping’s moderation system. You can also block a user so their Pings no longer appear to you.</p>
        <p>Use the complaint form below when the issue is broader than one Ping, you believe illegal or seriously harmful content was not handled properly, or you want to appeal a moderation decision.</p>
        {operator.safetyEmail && <div className="legal-links"><a href={`mailto:${operator.safetyEmail}`}>Safety contact: {operator.safetyEmail}</a></div>}
      </section>

      <section className="legal-card">
        <h2>Children and teenagers</h2>
        <p>Ping accounts are intended for people aged 13 or over. Because people aged 13–17 may use the service, Ping treats children as likely users rather than assuming the service is adults-only.</p>
        <ul>
          <li>There are no direct messages in the current product.</li>
          <li>Public profiles are deliberately minimal and do not show email or exact location.</li>
          <li>Public Ping coordinates are approximate.</li>
          <li>Do not post a child’s school, home address, phone number, routine or other precise identifying information.</li>
          <li>Do not use photos that visibly reveal sensitive addresses, school identifiers or other avoidable location clues.</li>
        </ul>
      </section>

      <section className="legal-card">
        <h2>Priority safety rules</h2>
        <p>Content involving child sexual abuse or exploitation, credible threats, terrorism, serious fraud/scams, illegal drug or weapons sales, stalking/doxxing, hateful abuse, or encouragement of serious self-harm is not permitted. Ping can remove or restrict content and accounts where needed for safety or legality.</p>
      </section>

      <ComplianceRequestPanel
        title="Safety complaint or moderation appeal"
        copy="Sign in to create a tracked complaint. Your submission appears immediately in your request history with an Open status and can then be reviewed through Ping’s moderation/compliance workflow. Include the Ping, date or decision involved where possible, but do not upload unnecessary sensitive personal information."
        options={safetyOptions}
      />

      {!safetyReady ? <section className="legal-card legal-warning">
        <h2>Pre-launch safety work still required</h2>
        <p>Ping’s current safety controls are product safeguards, not a declaration of full Online Safety Act compliance. Before public launch, Ping still needs the formally maintained illegal-content and children’s risk assessments, accountable safety ownership/contact, escalation/evidence-retention procedures, complaint-service targets and final legal review recorded as complete.</p>
      </section> : <section className="legal-card legal-callout">
        <h2>Safety ownership published</h2>
        <p>Ping’s production configuration records the required safety/legal review as complete. Safety complaints can be submitted through the tracked form above{operator.safetyEmail ? ` or by emailing ${operator.safetyEmail}` : ""}.</p>
      </section>}
    </LegalPageShell>
  );
}
