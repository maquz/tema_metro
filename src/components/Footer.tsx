interface FooterProps {
  theme?: 'dark' | 'light';
}

export default function Footer({ theme = 'dark' }: FooterProps) {
  const isLight = theme === 'light';
  return (
    <footer
      style={{
        backgroundColor: isLight ? 'transparent' : '#020B1E',
        borderTop: isLight ? 'none' : '1px solid rgba(255, 255, 255, 0.07)',
        padding: '24px 40px',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <p style={{ margin: '0 0 4px', fontSize: '12px', color: isLight ? '#6B7280' : '#4A5568', lineHeight: '1.6' }}>
        Ghana Education Service — Tema Metro Directorate © {new Date().getFullYear()}. All rights reserved.
      </p>
      <p style={{ margin: 0, fontSize: '12px', color: isLight ? '#6B7280' : '#4A5568' }}>
        Developed by{' '}
        <span style={{ color: isLight ? '#374151' : '#6B82A8', fontWeight: '600' }}>
          Mark Anibrika — ICT Coordinator (Tema Metro)
        </span>
      </p>
    </footer>
  );
}
