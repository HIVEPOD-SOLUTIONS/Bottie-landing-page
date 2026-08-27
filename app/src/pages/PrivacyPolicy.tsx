import React from 'react'

const PrivacyPolicy: React.FC = () => {
  return (
    <div style={{ background: '#07110d', minHeight: '100vh', color: '#eefcf5', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      <style>{`
        .pp-root *, .pp-root *::before, .pp-root *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .pp-root { line-height: 1.75; }
        .pp-nav {
          position: sticky; top: 0; z-index: 100;
          background: rgba(7,17,13,0.90); backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(36,216,149,0.14);
        }
        .pp-nav-inner {
          max-width: 900px; margin: 0 auto; padding: 18px 24px;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
        }
        .pp-brand {
          display: inline-flex; align-items: center; gap: 10px;
          text-decoration: none; font-weight: 800; font-size: 1rem; color: #eefcf5;
        }
        .pp-brand img {
          width: 32px; height: 32px; border-radius: 8px; object-fit: cover;
          box-shadow: 0 6px 18px rgba(36,216,149,0.25);
        }
        .pp-back {
          font-size: 0.88rem; color: rgba(238,252,245,0.60); text-decoration: none;
          display: inline-flex; align-items: center; gap: 5px; transition: color 0.2s;
          cursor: pointer; background: none; border: none;
        }
        .pp-back:hover { color: #24d895; }
        .pp-hero {
          max-width: 900px; margin: 0 auto; padding: 72px 24px 48px;
          border-bottom: 1px solid rgba(36,216,149,0.14);
        }
        .pp-pill {
          display: inline-block; background: rgba(36,216,149,0.12); color: #24d895;
          font-size: 0.78rem; font-weight: 700; letter-spacing: 0.08em;
          text-transform: uppercase; padding: 5px 14px; border-radius: 999px;
          border: 1px solid rgba(36,216,149,0.25); margin-bottom: 20px;
        }
        .pp-hero h1 {
          font-size: clamp(1.9rem, 4vw, 2.8rem); font-weight: 860;
          line-height: 1.18; letter-spacing: -0.02em; margin-bottom: 16px;
        }
        .pp-hero h1 span { color: #24d895; }
        .pp-hero-meta { color: rgba(238,252,245,0.60); font-size: 0.92rem; }
        .pp-hero-meta strong { color: #eefcf5; }
        .pp-toc-wrap { max-width: 900px; margin: 0 auto; padding: 40px 24px 0; }
        .pp-toc {
          background: #0d1a14; border: 1px solid rgba(36,216,149,0.14);
          border-radius: 16px; padding: 28px 32px;
        }
        .pp-toc-title {
          font-size: 0.78rem; font-weight: 700; letter-spacing: 0.09em;
          text-transform: uppercase; color: #24d895; margin-bottom: 16px;
        }
        .pp-toc ol {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 6px 32px; padding-left: 18px;
        }
        .pp-toc li { font-size: 0.9rem; }
        .pp-toc a { color: rgba(238,252,245,0.60); text-decoration: none; transition: color 0.18s; }
        .pp-toc a:hover { color: #24d895; }
        .pp-content { max-width: 900px; margin: 0 auto; padding: 56px 24px 80px; }
        .pp-section { margin-bottom: 56px; scroll-margin-top: 88px; }
        .pp-section-hdr {
          display: flex; align-items: baseline; gap: 12px;
          margin-bottom: 20px; padding-bottom: 14px;
          border-bottom: 1px solid rgba(36,216,149,0.14);
        }
        .pp-num {
          font-size: 0.78rem; font-weight: 800; letter-spacing: 0.1em; color: #24d895;
          background: rgba(36,216,149,0.10); border: 1px solid rgba(36,216,149,0.20);
          border-radius: 6px; padding: 3px 9px; flex-shrink: 0;
        }
        .pp-section h2 { font-size: 1.25rem; font-weight: 780; letter-spacing: -0.01em; }
        .pp-section h3 { font-size: 1rem; font-weight: 720; color: #24d895; margin: 28px 0 10px; }
        .pp-section p { color: rgba(238,252,245,0.82); font-size: 0.97rem; margin-bottom: 14px; }
        .pp-section ul, .pp-section ol { padding-left: 22px; margin-bottom: 14px; }
        .pp-section li { color: rgba(238,252,245,0.78); font-size: 0.95rem; margin-bottom: 6px; }
        .pp-section li strong { color: #eefcf5; }
        .pp-section a { color: #24d895; text-decoration: none; }
        .pp-section a:hover { text-decoration: underline; }
        .pp-card-list {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
          gap: 14px; margin: 16px 0 20px; list-style: none; padding: 0;
        }
        .pp-card-list li {
          background: #0d1a14; border: 1px solid rgba(36,216,149,0.14);
          border-radius: 12px; padding: 16px 18px;
          font-size: 0.88rem; color: rgba(238,252,245,0.80);
        }
        .pp-card-list li strong {
          display: block; color: #eefcf5; font-weight: 700;
          margin-bottom: 4px; font-size: 0.9rem;
        }
        .pp-highlight {
          background: rgba(36,216,149,0.07); border: 1px solid rgba(36,216,149,0.20);
          border-radius: 12px; padding: 20px 24px; margin: 16px 0;
        }
        .pp-highlight p { margin: 0; font-size: 0.95rem; color: rgba(238,252,245,0.88); }
        .pp-info {
          background: rgba(61,140,255,0.07); border: 1px solid rgba(61,140,255,0.20);
          border-radius: 12px; padding: 20px 24px; margin: 16px 0;
        }
        .pp-info p { margin: 0; font-size: 0.95rem; }
        .pp-contact-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 14px; margin-top: 20px;
        }
        .pp-contact-item {
          background: #0d1a14; border: 1px solid rgba(36,216,149,0.14);
          border-radius: 12px; padding: 18px 20px;
        }
        .pp-contact-label {
          font-size: 0.72rem; font-weight: 700; letter-spacing: 0.09em;
          text-transform: uppercase; color: #24d895; margin-bottom: 6px;
        }
        .pp-contact-item a {
          font-size: 0.9rem; color: #eefcf5; word-break: break-all;
          text-decoration: none;
        }
        .pp-contact-item a:hover { color: #24d895; }
        .pp-footer {
          border-top: 1px solid rgba(36,216,149,0.14);
          padding: 32px 24px; text-align: center;
        }
        .pp-footer p { color: rgba(238,252,245,0.60); font-size: 0.85rem; margin-bottom: 10px; }
        .pp-footer-links { display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; }
        .pp-footer-links a {
          color: rgba(238,252,245,0.60); font-size: 0.85rem;
          text-decoration: none; transition: color 0.18s;
        }
        .pp-footer-links a:hover { color: #24d895; }
        @media (max-width: 600px) {
          .pp-hero { padding: 48px 20px 36px; }
          .pp-toc ol, .pp-card-list, .pp-contact-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="pp-root">
        {/* NAV */}
        <nav className="pp-nav">
          <div className="pp-nav-inner">
            <a className="pp-brand" href="/">
              <img src="/Bluvfiv2.jpg" alt="Bluvfi logo" />
              Bluvfi
            </a>
            <button className="pp-back" onClick={() => window.history.back()}>← Back</button>
          </div>
        </nav>

        {/* HERO */}
        <header className="pp-hero">
          <div className="pp-pill">Legal</div>
          <h1>Privacy <span>Policy</span></h1>
          <p className="pp-hero-meta">
            <strong>Last updated: August 27, 2026</strong> &nbsp;·&nbsp; Effective for all users of Bluvfi services.
          </p>
        </header>

        {/* TABLE OF CONTENTS */}
        <div className="pp-toc-wrap">
          <div className="pp-toc">
            <div className="pp-toc-title">Contents</div>
            <ol>
              <li><a href="#pp-s1">Introduction</a></li>
              <li><a href="#pp-s2">Information We Collect</a></li>
              <li><a href="#pp-s3">How We Use Your Information</a></li>
              <li><a href="#pp-s4">Legal Basis for Processing</a></li>
              <li><a href="#pp-s5">How We Share Your Information</a></li>
              <li><a href="#pp-s6">Data Security</a></li>
              <li><a href="#pp-s7">Data Retention</a></li>
              <li><a href="#pp-s8">Your Privacy Rights</a></li>
              <li><a href="#pp-s9">Cookies &amp; Tracking</a></li>
              <li><a href="#pp-s10">International Data Transfers</a></li>
              <li><a href="#pp-s11">Children's Privacy</a></li>
              <li><a href="#pp-s12">Third-Party Services</a></li>
              <li><a href="#pp-s13">Blockchain Transparency</a></li>
              <li><a href="#pp-s14">Changes to This Policy</a></li>
              <li><a href="#pp-s15">Contact Us</a></li>
            </ol>
          </div>
        </div>

        {/* CONTENT */}
        <main className="pp-content">

          {/* 1 */}
          <section className="pp-section" id="pp-s1">
            <div className="pp-section-hdr">
              <span className="pp-num">01</span>
              <h2>Introduction</h2>
            </div>
            <p>Bluvfi ("Bluvfi," "we," "us," or "our") is an AI-powered financial assistant that enables users to pay bills, manage subscriptions, and invest — all through a single, gasless on-chain payment flow. We are committed to protecting your privacy and handling your personal information responsibly.</p>
            <p>This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our web application, APIs, AI chat interface, and related services (collectively, the "Service").</p>
            <div className="pp-highlight">
              <p>By accessing or using the Service, you acknowledge that you have read and understood this Privacy Policy and agree to the collection, use, and disclosure of your information as described herein. If you do not agree, please do not use the Service.</p>
            </div>
            <p>This Privacy Policy is designed to comply with the General Data Protection Regulation (GDPR) and other applicable data protection laws in the jurisdictions where we operate.</p>
          </section>

          {/* 2 */}
          <section className="pp-section" id="pp-s2">
            <div className="pp-section-hdr">
              <span className="pp-num">02</span>
              <h2>Information We Collect</h2>
            </div>
            <h3>2.1 Information You Provide Directly</h3>
            <p>We collect information you voluntarily provide when you:</p>
            <ul>
              <li>Register for an account or authenticate via Privy (email, social login, passkey, or phone)</li>
              <li>Connect or create an embedded crypto wallet</li>
              <li>Initiate a payment, subscription, or investment action</li>
              <li>Contact our support team</li>
              <li>Join our waitlist or subscribe to communications</li>
              <li>Interact with the AI chat interface</li>
            </ul>
            <p>This information may include:</p>
            <ul>
              <li>Email address, phone number, and authentication credentials managed via Privy</li>
              <li>Cryptocurrency wallet addresses (embedded EOA wallets)</li>
              <li>Payment and transaction details (amounts, recipients, timestamps)</li>
              <li>AI chat messages and voice transcriptions</li>
              <li>Preferences and settings within the app</li>
            </ul>
            <h3>2.2 Information Automatically Collected</h3>
            <p>When you use the Service, we automatically collect:</p>
            <ul className="pp-card-list">
              <li><strong>Device &amp; Browser</strong>IP address, browser type, operating system, and device identifiers.</li>
              <li><strong>Usage Data</strong>Pages viewed, features used, time on page, and AI prompts entered.</li>
              <li><strong>Location Data</strong>General geographic location inferred from IP address.</li>
              <li><strong>Transaction Data</strong>USDC amounts, wallet addresses, timestamps, and Circle Gateway settlement records.</li>
              <li><strong>Voice Data</strong>Audio transcribed by OpenAI Whisper; audio is not stored beyond transcription.</li>
              <li><strong>Cookies</strong>Information via cookies and similar technologies (see Section 9).</li>
            </ul>
            <h3>2.3 Information from Third Parties</h3>
            <p>We may receive information from trusted third-party partners, including:</p>
            <ul>
              <li><strong>Privy</strong> — identity and wallet management, authentication, and embedded EOA creation</li>
              <li><strong>Circle</strong> — USDC payment processing, Arc AppKit records, and Circle Gateway x402 settlements</li>
              <li><strong>OpenAI</strong> — AI chat (GPT-4o mini) and voice transcription (Whisper)</li>
              <li><strong>Vercel</strong> — hosting, analytics, and edge function logs</li>
              <li><strong>Neon / Drizzle ORM</strong> — payment history stored in Postgres</li>
              <li><strong>Alchemy</strong> — blockchain RPC and node infrastructure</li>
            </ul>
          </section>

          {/* 3 */}
          <section className="pp-section" id="pp-s3">
            <div className="pp-section-hdr">
              <span className="pp-num">03</span>
              <h2>How We Use Your Information</h2>
            </div>
            <h3>3.1 Service Provision and Operations</h3>
            <ul>
              <li>Create and manage your account and embedded wallet</li>
              <li>Process gasless USDC payments, subscriptions, and investment purchases</li>
              <li>Operate the AI financial assistant and process natural language commands</li>
              <li>Display your bill catalog, portfolio, and payment history</li>
              <li>Send transaction confirmations and in-app notifications</li>
            </ul>
            <h3>3.2 Security and Compliance</h3>
            <ul>
              <li>Detect, prevent, and address fraud and unauthorized transactions</li>
              <li>Enforce our Terms of Service and usage policies</li>
              <li>Respond to legal processes and regulatory requirements</li>
              <li>Maintain audit logs for financial transactions</li>
            </ul>
            <h3>3.3 Analytics and Improvement</h3>
            <ul>
              <li>Analyze usage patterns and improve the AI assistant's accuracy</li>
              <li>Conduct research, A/B testing, and feature development</li>
              <li>Monitor service performance and reliability</li>
            </ul>
            <h3>3.4 Communications and Marketing</h3>
            <ul>
              <li>Send product updates, waitlist announcements, and newsletters (with your consent)</li>
              <li>Respond to support inquiries and feedback</li>
              <li>Notify you of new features, billing reminders, or low-balance alerts</li>
            </ul>
          </section>

          {/* 4 */}
          <section className="pp-section" id="pp-s4">
            <div className="pp-section-hdr">
              <span className="pp-num">04</span>
              <h2>Legal Basis for Processing (GDPR)</h2>
            </div>
            <p>If you are located in the European Economic Area (EEA), our legal basis for processing your personal information is:</p>
            <ul>
              <li><strong>Contract Performance</strong> — Processing necessary to provide the Service you signed up for.</li>
              <li><strong>Legal Obligation</strong> — Processing required to comply with applicable financial and data protection laws.</li>
              <li><strong>Legitimate Interests</strong> — Fraud prevention, service security, analytics, and improving AI performance.</li>
              <li><strong>Consent</strong> — Marketing communications and non-essential cookies, where you have provided explicit consent.</li>
            </ul>
          </section>

          {/* 5 */}
          <section className="pp-section" id="pp-s5">
            <div className="pp-section-hdr">
              <span className="pp-num">05</span>
              <h2>How We Share Your Information</h2>
            </div>
            <div className="pp-highlight">
              <p><strong>We do not sell your personal information.</strong> We do not share your data with advertisers or data brokers.</p>
            </div>
            <h3>5.1 Service Providers</h3>
            <p>We share data with trusted third-party providers who help operate the Service, including cloud hosting (Vercel), payment infrastructure (Circle, Privy), AI processing (OpenAI), database services (Neon), and analytics tools. All providers are contractually bound to protect your data.</p>
            <h3>5.2 Legal Requirements</h3>
            <p>We may disclose your information when required by law, court orders, law enforcement requests, or regulatory authority demands.</p>
            <h3>5.3 Business Transfers</h3>
            <p>In connection with a merger, acquisition, or asset sale, your information may be transferred to the acquiring entity under the same privacy commitments.</p>
            <h3>5.4 With Your Consent</h3>
            <p>We may share your information for purposes not described here only with your explicit prior consent.</p>
            <h3>5.5 Blockchain Transactions</h3>
            <p>USDC transactions processed through Circle Gateway and recorded on Base Sepolia are visible on the public blockchain. Wallet addresses and amounts are immutable and cannot be erased once confirmed on-chain.</p>
          </section>

          {/* 6 */}
          <section className="pp-section" id="pp-s6">
            <div className="pp-section-hdr">
              <span className="pp-num">06</span>
              <h2>Data Security</h2>
            </div>
            <ul>
              <li>Data in transit encrypted with TLS 1.3</li>
              <li>Data at rest encrypted with AES-256</li>
              <li>Privy-managed embedded wallets — private keys never exposed to Bluvfi servers</li>
              <li>Multi-factor authentication (MFA) available for all accounts</li>
              <li>Role-based access controls limiting internal data access</li>
              <li>Regular security reviews and dependency auditing</li>
              <li>Incident response and breach notification procedures</li>
            </ul>
            <div className="pp-info">
              <p>No method of transmission over the Internet is 100% secure. While we strive to protect your data, we cannot guarantee absolute security. You provide information at your own risk.</p>
            </div>
          </section>

          {/* 7 */}
          <section className="pp-section" id="pp-s7">
            <div className="pp-section-hdr">
              <span className="pp-num">07</span>
              <h2>Data Retention</h2>
            </div>
            <ul>
              <li><strong>Account Information</strong> — Duration of your account plus 7 years after closure</li>
              <li><strong>Transaction Records</strong> — At least 7 years for financial and tax purposes</li>
              <li><strong>AI Chat Logs</strong> — Up to 90 days, then anonymized or deleted</li>
              <li><strong>Voice Transcriptions</strong> — Deleted immediately after processing; audio not retained</li>
              <li><strong>Marketing Data</strong> — Until you withdraw consent</li>
              <li><strong>Usage &amp; Analytics Data</strong> — Up to 24 months</li>
            </ul>
            <p>After the retention period, we securely delete or anonymize your information.</p>
          </section>

          {/* 8 */}
          <section className="pp-section" id="pp-s8">
            <div className="pp-section-hdr">
              <span className="pp-num">08</span>
              <h2>Your Privacy Rights</h2>
            </div>
            <h3>8.1 General Rights</h3>
            <ul>
              <li><strong>Access</strong> — Request a copy of the personal information we hold about you</li>
              <li><strong>Correction</strong> — Request correction of inaccurate or incomplete data</li>
              <li><strong>Deletion</strong> — Request deletion of your data (subject to legal retention requirements)</li>
              <li><strong>Portability</strong> — Receive your data in a structured, machine-readable format</li>
              <li><strong>Objection</strong> — Object to processing based on legitimate interests</li>
              <li><strong>Restriction</strong> — Request restriction of processing in certain circumstances</li>
              <li><strong>Withdraw Consent</strong> — Withdraw consent for marketing or non-essential cookies at any time</li>
            </ul>
            <h3>8.2 GDPR Rights (EEA Residents)</h3>
            <p>If you are in the EEA, you have additional rights under GDPR, including the right to lodge a complaint with a supervisory authority in your member state.</p>
            <h3>8.3 Exercising Your Rights</h3>
            <p>To exercise any of your rights, contact us at <a href="mailto:hivepod39@gmail.com">hivepod39@gmail.com</a>. We will respond within 30 days.</p>
          </section>

          {/* 9 */}
          <section className="pp-section" id="pp-s9">
            <div className="pp-section-hdr">
              <span className="pp-num">09</span>
              <h2>Cookies &amp; Tracking Technologies</h2>
            </div>
            <ul>
              <li><strong>Essential Cookies</strong> — Required for authentication, session management, and core functionality. Cannot be disabled.</li>
              <li><strong>Analytics Cookies</strong> — Understand how users interact with the Service (e.g., Vercel Analytics). You may opt out.</li>
              <li><strong>Preference Cookies</strong> — Store UI preferences. Optional.</li>
            </ul>
            <p>You can control cookies through your browser settings. We do not use advertising or third-party tracker cookies.</p>
          </section>

          {/* 10 */}
          <section className="pp-section" id="pp-s10">
            <div className="pp-section-hdr">
              <span className="pp-num">10</span>
              <h2>International Data Transfers</h2>
            </div>
            <p>Your information may be transferred to and processed in countries other than your country of residence — including the United States, where many of our service providers (OpenAI, Vercel, Circle) are based.</p>
            <p>When transferring personal information from the EEA, we rely on Standard Contractual Clauses, adequacy decisions, or other legally approved transfer mechanisms.</p>
          </section>

          {/* 11 */}
          <section className="pp-section" id="pp-s11">
            <div className="pp-section-hdr">
              <span className="pp-num">11</span>
              <h2>Children's Privacy</h2>
            </div>
            <p>The Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If you believe we have collected data from a child, please contact us at <a href="mailto:hivepod39@gmail.com">hivepod39@gmail.com</a> and we will promptly delete it.</p>
          </section>

          {/* 12 */}
          <section className="pp-section" id="pp-s12">
            <div className="pp-section-hdr">
              <span className="pp-num">12</span>
              <h2>Third-Party Services</h2>
            </div>
            <p>Bluvfi integrates with third-party platforms not owned or controlled by us. We are not responsible for their privacy practices. Key integrations:</p>
            <ul>
              <li><strong>Privy</strong> — <a href="https://www.privy.io/privacy-policy" target="_blank" rel="noopener noreferrer">privy.io/privacy-policy</a></li>
              <li><strong>Circle / Arc AppKit</strong> — <a href="https://www.circle.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">circle.com/legal/privacy-policy</a></li>
              <li><strong>OpenAI</strong> — <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer">openai.com/policies/privacy-policy</a></li>
              <li><strong>Vercel</strong> — <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">vercel.com/legal/privacy-policy</a></li>
            </ul>
          </section>

          {/* 13 */}
          <section className="pp-section" id="pp-s13">
            <div className="pp-section-hdr">
              <span className="pp-num">13</span>
              <h2>Blockchain Transparency</h2>
            </div>
            <div className="pp-info">
              <p>Bluvfi processes payments on <strong>Base Sepolia</strong>. All on-chain transactions — including wallet addresses and USDC transfer amounts — are permanently recorded on a public blockchain and are visible to anyone worldwide. This data cannot be modified or deleted once confirmed. By using Bluvfi's payment features, you accept this inherent transparency.</p>
            </div>
            <p>We do not publish any off-chain personal information (such as your name or email) alongside your wallet address.</p>
          </section>

          {/* 14 */}
          <section className="pp-section" id="pp-s14">
            <div className="pp-section-hdr">
              <span className="pp-num">14</span>
              <h2>Changes to This Privacy Policy</h2>
            </div>
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes by:</p>
            <ul>
              <li>Posting the updated Policy on this page with a new "Last Updated" date</li>
              <li>Sending an email notification to your registered address</li>
              <li>Displaying a prominent in-app notice</li>
            </ul>
            <p>Your continued use of the Service after the effective date constitutes acceptance of the updated Policy.</p>
          </section>

          {/* 15 */}
          <section className="pp-section" id="pp-s15">
            <div className="pp-section-hdr">
              <span className="pp-num">15</span>
              <h2>Contact Us</h2>
            </div>
            <p>If you have questions, concerns, or data requests, please reach out:</p>
            <div className="pp-contact-grid">
              <div className="pp-contact-item">
                <div className="pp-contact-label">Privacy Requests</div>
                <a href="mailto:hivepod39@gmail.com">hivepod39@gmail.com</a>
              </div>
              <div className="pp-contact-item">
                <div className="pp-contact-label">General Support</div>
                <a href="mailto:hivepod39@gmail.com">hivepod39@gmail.com</a>
              </div>
              <div className="pp-contact-item">
                <div className="pp-contact-label">X / Twitter</div>
                <a href="https://x.com/bluvfi" target="_blank" rel="noopener noreferrer">@bluvfi</a>
              </div>
              <div className="pp-contact-item">
                <div className="pp-contact-label">Telegram</div>
                <a href="https://t.me/+KXpDSUAnfg44MTg0" target="_blank" rel="noopener noreferrer">Join our Telegram</a>
              </div>
            </div>
          </section>

        </main>

        {/* FOOTER */}
        <footer className="pp-footer">
          <p>© 2026 Bluvfi. All rights reserved.</p>
          <div className="pp-footer-links">
            <a href="/">Home</a>
            <a href="/privacy" aria-current="page">Privacy Policy</a>
            <a href="https://x.com/bluvfi" target="_blank" rel="noopener noreferrer">X / Twitter</a>
            <a href="https://t.me/+KXpDSUAnfg44MTg0" target="_blank" rel="noopener noreferrer">Telegram</a>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default PrivacyPolicy
