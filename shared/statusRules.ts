/**
 * قواعد انتقال الحالات — منطق نقي قابل للاختبار بلا قاعدة بيانات.
 *
 * - الانتقال إلى فئة closed (مؤجلة/ملغاة) مسموح من أي حالة
 * - الخروج من closed مسموح دائمًا (الفلترة للحالات غير المغلقة تتم في الخدمة)
 * - غير ذلك: يشترط وجود صف في status_transitions
 */
export function isTransitionAllowed(
  fromCategory: string,
  toCategory: string,
  hasExplicitTransition: boolean,
): boolean {
  if (fromCategory === toCategory) return true;
  if (toCategory === "closed" || fromCategory === "closed") return true;
  return hasExplicitTransition;
}
