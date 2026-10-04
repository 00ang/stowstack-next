import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal-layout";

export const metadata: Metadata = {
  title: "Cookie Policy | StorageAds",
  description: "StorageAds Cookie Policy: what cookies we use and why.",
};

export default function CookiePolicyPage() {
  return (
    <LegalLayout title="Cookie Policy" >
      <section>
        <h2>1. What Are Cookies</h2>
        <p>
          Cookies are small text files stored on your device when you visit a website.
          They keep you logged in, remember your preferences, and help us
          understand how our services are used.
        </p>
      </section>

      <section>
        <h2>2. Cookies We Use</h2>

        <h3>Essential Cookies</h3>
        <p>
          Required for the platform to function. These handle authentication sessions,
          security tokens, and basic functionality. Cannot be disabled.
        </p>
        <ul>
          <li><strong>Session cookie</strong>:maintains your login state</li>
          <li><strong>CSRF token</strong>:prevents cross-site request forgery</li>
          <li><strong>Preference cookies</strong>:stores timezone, sidebar state</li>
        </ul>

        <h3>Analytics Cookies</h3>
        <p>
          Help us understand how operators use the dashboard so we can improve the product.
          No personal data is shared with third parties.
        </p>

        <h3>Advertising Attribution Cookies</h3>
        <p>
          On StorageAds landing pages (storageads.com/lp/*), we use cookies to track
          the connection between ad clicks and storage unit reservations. This is the
          core of our attribution system. These cookies store:
        </p>
        <ul>
          <li>UTM parameters (campaign source, medium, campaign name)</li>
          <li>Platform click IDs (fbclid for Meta; gclid, gbraid and wbraid for Google; msclkid for Microsoft)</li>
          <li>StorageAds session identifiers for attribution</li>
          <li>A StorageAds visitor identifier (<code>sa_vid</code>), a random ID kept for up to 400 days so a later reservation can be connected to the ad that started it</li>
        </ul>
        <p>
          This data is used exclusively to measure advertising performance and
          calculate cost-per-move-in for facility operators.
        </p>
      </section>

      <section>
        <h2>3. Third-Party Cookies</h2>
        <p>We use cookies from the following third-party services:</p>
        <ul>
          <li><strong>Clerk</strong>:Authentication (session management)</li>
          <li><strong>Stripe</strong>:Payment processing (fraud prevention)</li>
          <li><strong>Meta Pixel</strong>:On landing pages only, for ad conversion tracking</li>
          <li><strong>Google Ads</strong>:On landing pages only, for conversion tracking</li>
        </ul>
      </section>

      <section>
        <h2>4. Managing Cookies</h2>
        <p>
          You can control cookies through your browser settings. Disabling essential cookies
          may prevent the dashboard from functioning correctly. Disabling attribution cookies
          on landing pages will prevent accurate move-in tracking.
        </p>
      </section>

      <section>
        <h2>5. Contact</h2>
        <p>
          Questions about our cookie practices? Email blake@storageads.com.
        </p>
      </section>
    </LegalLayout>
  );
}
