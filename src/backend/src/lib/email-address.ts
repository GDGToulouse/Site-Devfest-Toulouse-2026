// The shape of an address the site will write to: something@domain.tld, no
// spaces, within the 254 characters SMTP allows. Not a proof it exists.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailAddress(value: string): boolean {
  return value.length <= 254 && EMAIL_SHAPE.test(value);
}
