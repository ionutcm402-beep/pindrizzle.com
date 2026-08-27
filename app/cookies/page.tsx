import LegalPageShell from "@/components/LegalPageShell";
import AnalyticsStorageControls from "@/components/AnalyticsStorageControls";

export default function CookiesPage() {
  return (
    <LegalPageShell title="Browser Storage" kicker="COOKIES & LOCAL STORAGE" active="cookies">
      <section className="legal-intro">
        <h2>Necessary storage works by default. Optional analytics does not.</h2>
        <p>Pindrizzle uses browser storage for account sessions and product preferences. Optional product analytics only starts after you choose Allow analytics.</p>
      </section>

      <AnalyticsStorageControls />

      <section className="legal-card">
        <h2>Necessary storage</h2>
        <p>This storage is used to provide or remember features you request. Depending on the feature and browser it can include cookies, local storage, session storage or browser-managed permission state.</p>
        <ul>
          <li><b>Authentication:</b> Supabase session data needed to keep you signed in securely.</li>
          <li><b>Nearby radius:</b> remembers whether you chose 0.5, 1, 3 or 5 miles.</li>
          <li><b>First-run state:</b> remembers that you completed or skipped onboarding.</li>
          <li><b>Analytics choice:</b> remembers whether you chose Only necessary or Allow analytics.</li>
          <li><b>Notification and install state:</b> browser-managed permissions and locally stored settings needed for features you enable.</li>
        </ul>
      </section>

      <section className="legal-card">
        <h2>Optional product analytics</h2>
        <p>If you choose Allow analytics, Pindrizzle creates a random browser-session UUID in session storage and records coarse events such as opening Feed, Map, Search or a pin. The current analytics design does not send the words you search for, the text of pins you read, or your exact coordinates into the product analytics table.</p>
        <p>Choosing Only necessary stops new optional analytics collection in this browser and removes Pindrizzle’s analytics-only session identifier and seen-event keys from session storage. Previously collected analytics is not instantly erased by changing this browser choice; raw product analytics is designed to age out after up to 90 days, and you can make a data request from the Privacy page.</p>
      </section>

      <section className="legal-card">
        <h2>No behavioural advertising cookies</h2>
        <p>Pindrizzle does not currently use personalised advertising trackers. Promoted pins are paid local placement, not behavioural ads built from your browsing history.</p>
      </section>

      <section className="legal-card legal-warning">
        <h2>Clearing browser data</h2>
        <p>Your browser can clear cookies and site storage at any time. Doing that may sign you out and remove saved choices such as your radius, onboarding state and analytics preference, so Pindrizzle may ask you to choose again.</p>
      </section>
    </LegalPageShell>
  );
}
