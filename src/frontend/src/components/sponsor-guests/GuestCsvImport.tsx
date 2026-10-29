"use client";

import { useRef, useState } from "react";

import { fileToBase64, type ImportFailure, type ImportPreview } from "@/lib/sponsor-guests";

// Importing guests from a spreadsheet (#729): pick a file, read the preview the
// server builds without writing anything, then confirm (RG-INS-33). The server
// reads `;` or `,` and Windows-1252 as well as UTF-8, so the sponsor saves from
// Excel as they usually do.

type ImportCall = (file: string, confirm: boolean) => Promise<{ status: number; preview?: ImportPreview; failure?: ImportFailure }>;

export default function GuestCsvImport({
  templateUrl,
  runImport,
  onImported,
  isTeam = false,
}: {
  templateUrl: string;
  runImport: ImportCall;
  onImported: (count: number) => void;
  // The team imports past the places: the lines in excess land out of quota.
  isTeam?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; content: string } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [failure, setFailure] = useState<ImportFailure | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  function reset() {
    setFile(null);
    setPreview(null);
    setFailure(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function pick(selected: File | undefined) {
    setPreview(null);
    setFailure(null);
    if (!selected) return;
    setIsBusy(true);
    const content = await fileToBase64(selected);
    setFile({ name: selected.name, content });
    const result = await runImport(content, false);
    setIsBusy(false);
    if (result.preview) setPreview(result.preview);
    else setFailure(result.status === 0 ? { message: "Le fichier n'a pas pu être envoyé. Vérifiez votre connexion." } : (result.failure ?? {}));
  }

  async function confirm() {
    if (!file) return;
    setIsBusy(true);
    const result = await runImport(file.content, true);
    setIsBusy(false);
    if (result.status === 201) {
      onImported(preview?.count ?? 0);
      reset();
      return;
    }
    setPreview(null);
    setFailure(result.status === 0 ? { message: "L'import n'a pas pu aboutir. Vérifiez votre connexion." } : (result.failure ?? {}));
  }

  const excess = preview?.excess ?? 0;
  const outOfQuota = preview?.outOfQuota ?? 0;

  return (
    <div className="space-y-3">
      <p className="text-sm text-gris">
        Remplissez le{" "}
        <a href={templateUrl} download className="font-medium text-bleu hover:underline">
          modèle CSV
        </a>{" "}
        (une ligne par personne), puis importez-le. Le séparateur « ; » ou « , » et l&apos;enregistrement
        depuis Excel sont acceptés.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        aria-label="Fichier CSV des invités"
        onChange={(e) => void pick(e.target.files?.[0])}
        disabled={isBusy}
        className="block w-full text-sm text-noir file:mr-3 file:rounded-lg file:border-0 file:bg-malachite/10 file:px-4 file:py-2 file:font-medium file:text-malachite"
      />

      {isBusy && <p className="text-sm text-gris">Lecture du fichier…</p>}

      {failure && (
        <div role="alert" className="rounded-lg border border-terre-cuite/30 bg-terre-cuite/5 p-3 text-sm text-terre-cuite">
          {failure.lines?.length ? (
            <>
              <p className="font-medium">Le fichier n&apos;a pas été importé. Corrigez ces lignes et réessayez :</p>
              <ul className="mt-1 list-disc pl-5">
                {failure.lines.map((l) => (
                  <li key={l.line}>
                    Ligne {l.line} : {l.message}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>{failure.message ?? "Le fichier n'a pas pu être importé."}</p>
          )}
        </div>
      )}

      {preview && (
        <div className="space-y-3 rounded-lg border border-gris/20 bg-blanc p-3">
          <p className="text-sm text-noir">
            {preview.count} personne{preview.count > 1 ? "s" : ""} à inscrire · {preview.remaining} place
            {preview.remaining > 1 ? "s" : ""} restante{preview.remaining > 1 ? "s" : ""}
          </p>
          <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
            {preview.guests.map((g) => (
              <li key={g.line} className="text-noir">
                {g.firstName} {g.lastName} · <span className="text-gris">{g.email}</span>
                {g.hasDuplicateEmail && (
                  <span className="ml-2 text-xs text-terre-cuite">adresse déjà utilisée</span>
                )}
              </li>
            ))}
          </ul>
          {preview.guests.some((g) => g.hasDuplicateEmail) && (
            <p className="text-xs text-terre-cuite">
              Une même adresse pour deux personnes : une seule recevra les billets et les consignes.
            </p>
          )}
          {excess > 0 ? (
            <p role="alert" className="text-sm text-terre-cuite">
              Le fichier dépasse vos places de {excess} ligne{excess > 1 ? "s" : ""} : retirez-les, ou
              demandez des places supplémentaires à l&apos;équipe du DevFest.
            </p>
          ) : (
            <>
              {isTeam && outOfQuota > 0 && (
                <p className="text-sm text-terre-cuite">
                  {outOfQuota} ligne{outOfQuota > 1 ? "s" : ""} dépasse{outOfQuota > 1 ? "nt" : ""} le quota : elles
                  seront importées hors quota, sans billet.
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void confirm()}
                  disabled={isBusy}
                  className="rounded-[12px] bg-malachite px-5 py-2.5 font-bold text-blanc transition-colors hover:bg-malachite/90 disabled:opacity-50"
                >
                  Importer {preview.count} personne{preview.count > 1 ? "s" : ""}
                </button>
                <button
                  type="button"
                  onClick={reset}
                  disabled={isBusy}
                  className="rounded-[12px] border border-gris/30 px-5 py-2.5 font-medium text-noir hover:bg-blanc-casse disabled:opacity-50"
                >
                  Annuler
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
