import { maskPhone } from "../lib/security.js";

export { maskPhone };

function isLegacyRootReport(report) {
  if (!report || typeof report !== "object" || Array.isArray(report) || Object.hasOwn(report, "schemaVersion")) return false;
  if (!Array.isArray(report.sections) || !Array.isArray(report.preferenceExplanations)) return false;
  return [
    "overview", "judgment", "profile", "scienceEvidence", "strengths", "risks",
    "subjectApplication", "nextStep", "coachSupport"
  ].every((key) => report[key] && typeof report[key] === "object" && !Array.isArray(report[key]));
}

export function publicReportView(report, identity = {}) {
  const currentStudentReport = report?.studentReport && typeof report.studentReport === "object"
    ? report.studentReport
    : null;
  const studentReport = currentStudentReport ?? (isLegacyRootReport(report)
    ? Object.fromEntries(Object.entries(report).filter(([key]) => key !== "phoneNumber"))
    : null);
  if (!studentReport) {
    throw new Error("stored report is missing the student view");
  }
  return {
    studentName: studentReport.overview?.studentName ?? report.studentName ?? identity.studentName ?? null,
    maskedPhone: typeof report.maskedPhone === "string"
      ? report.maskedPhone
      : maskPhone(report.phoneNumber ?? identity.phoneNumber),
    studentReport
  };
}
