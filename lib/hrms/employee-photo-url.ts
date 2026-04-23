/** Resolve stored `employees.photo_url` for `<img src>` — public URLs or private storage paths. */
export function employeePhotoSrc(photoUrl: string | null | undefined): string | null {
  if (photoUrl == null) return null;
  const u = photoUrl.trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return `/api/hrms/employee-photo?path=${encodeURIComponent(u)}`;
}
