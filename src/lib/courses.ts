// Mirrors the rows seeded in the `courses` table; slugs are the public URL segment.
export type Course = { code: string; slug: string; title: string };

export const COURSES: Course[] = [
  { code: "GST 111", slug: "gst-111", title: "Communication in English Language" },
  { code: "AMS 101", slug: "ams-101", title: "Principles of Management" },
  { code: "AMS 103", slug: "ams-103", title: "Introduction to Computer" },
  { code: "EHR 121", slug: "ehr-121", title: "Introduction to Human Resource Management" },
  { code: "RSU-EHR 123", slug: "rsu-ehr-123", title: "Sociology of Work in Industry" },
  { code: "RSU-EHR 111", slug: "rsu-ehr-111", title: "Introduction to Financial Accounting" },
  { code: "RSU-EHR 113", slug: "rsu-ehr-113", title: "Introduction to Finance" },
  { code: "RSU-EHR 115", slug: "rsu-ehr-115", title: "Elements of Marketing" },
  {
    code: "RSU-LSM 101",
    slug: "rsu-lsm-101",
    title: "Introduction to Logistics & Supply Chain Management",
  },
];

export function findCourse(slug: string): Course | undefined {
  return COURSES.find((c) => c.slug === slug);
}
