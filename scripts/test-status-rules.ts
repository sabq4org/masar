import { isTransitionAllowed } from "../shared/statusRules";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("✗", msg);
    failed++;
  } else {
    console.log("✔", msg);
  }
}

assert(isTransitionAllowed("active", "closed", false), "إلى closed مسموح بلا انتقال صريح");
assert(isTransitionAllowed("closed", "active", false), "من closed مسموح بلا انتقال صريح");
assert(isTransitionAllowed("active", "review", true), "انتقال صريح مسموح");
assert(!isTransitionAllowed("active", "review", false), "بلا انتقال صريح يُرفض");
assert(isTransitionAllowed("planning", "planning", false), "نفس الفئة/الحالة مسموح");
assert(!isTransitionAllowed("review", "planning", false), "رجوع غير معرّف يُرفض");

if (failed) {
  console.error(`\nفشل ${failed} اختبار(ات)`);
  process.exit(1);
}
console.log("\nكل اختبارات قواعد الحالات نجحت");
