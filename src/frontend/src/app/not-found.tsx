import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8 text-center min-h-screen">
      <h1 className="text-8xl font-bold text-terre-cuite">404</h1>
      <h2 className="mt-4 text-2xl font-bold text-noir">Page introuvable</h2>
      <p className="mt-2 text-gris max-w-md">
        La page que vous cherchez n&apos;existe pas ou a été déplacée.
      </p>
      <Link
        href="/fr"
        className="mt-8 rounded-l bg-bleu px-6 py-3 text-base font-bold text-blanc hover:opacity-90 transition-opacity inline-block"
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
