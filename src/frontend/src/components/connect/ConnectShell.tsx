// The frame of the agent connection pages (#514), on the same card as the
// partner space sign-in so the step feels part of the site.
export default function ConnectShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-blanc-casse px-6 py-10">
      <div className="w-full max-w-md rounded-3xl bg-blanc p-8 shadow-card">
        <h1 className="mb-2 text-center text-2xl font-bold text-noir">Connecter un agent IA</h1>
        <p className="mb-6 text-center text-sm text-gris">DevFest Toulouse</p>
        {children}
      </div>
    </div>
  );
}
