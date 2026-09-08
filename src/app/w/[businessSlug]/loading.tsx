export default function Loading() {
  return (
    <main className="loading-page" aria-busy="true" aria-label="Loading">
      <div className="skeleton heading" />
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className="skeleton row" />
      ))}
    </main>
  );
}
