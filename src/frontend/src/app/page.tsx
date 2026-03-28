export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center flex-1 p-8">
      <h1 className="text-4xl font-bold text-noir">
        <span className="text-malachite">DevFest</span>{" "}
        <span className="text-terre-cuite">Toulouse</span>
      </h1>
      <p className="mt-4 text-gris">
        La plus grande conférence tech du bassin Toulousain
      </p>
      <p className="mt-2 text-gris-clair text-sm">19 novembre 2026</p>
    </main>
  );
}
