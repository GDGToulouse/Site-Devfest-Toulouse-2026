// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function localizedField(obj: any, field: string, locale: string): string {
  const suffix = locale === "en" ? "En" : "Fr";
  return (obj[`${field}${suffix}`] as string) || "";
}

