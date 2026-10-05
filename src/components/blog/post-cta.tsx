import Link from 'next/link';

/**
 * CTA block at the end of blog posts, before author bio.
 * Drives readers to the audit tool or demo.
 */
export function PostCta() {
  return (
    <div
      className="rounded-xl p-6 mt-12 text-center"
      style={{
        backgroundColor: 'var(--color-gold-light)',
        border: '1px solid rgba(68, 99, 134, 0.2)',
      }}
    >
      <h3
        className="text-xl font-medium mb-2"
        style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-dark)' }}
      >
        See how your facility stacks up
      </h3>
      <p
        className="text-sm mb-5 max-w-md mx-auto"
        style={{ fontFamily: 'var(--font-body)', color: 'var(--color-body-text)' }}
      >
        Get a free marketing diagnostic for your facility. We&apos;ll show you exactly where move-ins are leaking and what it costs.
      </p>
      <Link
        href="/audit-tool"
        className="inline-flex items-center rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
        style={{
          fontFamily: 'var(--font-heading)',
          color: '#fff',
          backgroundColor: 'var(--color-gold)',
        }}
      >
        Get a Free Facility Audit
      </Link>
    </div>
  );
}
