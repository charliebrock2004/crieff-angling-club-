"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en-GB">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f5f1e8", color: "#14221d", padding: "4rem 1.5rem" }}>
        <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400 }}>Sorry — something went wrong.</h1>
        <p>Please try again. If you were paying for a permit, check your email before booking again.</p>
        <button onClick={reset} style={{ marginTop: 16, padding: "12px 20px", borderRadius: 999, background: "#14221d", color: "#fff", border: 0 }}>Try again</button>
      </body>
    </html>
  );
}
