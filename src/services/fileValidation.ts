export const allowedPackageExtensions = ['.apk', '.aab', '.ipa', '.zip'] as const;
const allowedExtensions = new Set<string>(allowedPackageExtensions);
export const maximumPackageBytes = 500 * 1024 * 1024;

export function validatePackageFile(file: File): string | null {
  const extension = `.${file.name.split('.').at(-1)?.toLowerCase() ?? ''}`;
  if (!allowedExtensions.has(extension)) return 'Choose an APK, AAB, IPA, or ZIP file.';
  const containsControlCharacter = Array.from(file.name).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
  if (!file.name.trim() || file.name.length > 255 || /[\\/:]/.test(file.name) || containsControlCharacter || file.name.includes('..')) return 'The filename contains unsupported characters.';
  if (file.size > maximumPackageBytes) return 'The selected file is larger than the 500 MB limit.';
  if (!file.size) return 'The selected file is empty.';
  return null;
}
