// US English locale, so names, words and URLs always come from the English data set.
import { fakerEN_US as faker } from '@faker-js/faker';

/** Fields that both doctors and treatments have, as typed into the form. */
export type ClinicRecordData = {
  name: string;
  /** "Page on your website". */
  website: string;
  /** "ID in your EMR". */
  emrId: string;
  description: string;
};

export type DoctorData = ClinicRecordData;

/** Prices are strings because that is what the form's number inputs hold. */
export type TreatmentData = ClinicRecordData & {
  price: string;
  discountedPrice: string;
};

/**
 * The colour swatches in the department form: the name screen readers announce, and the hex
 * code the API stores for it.
 */
export const DEPARTMENT_COLORS = {
  'vibrant cyan blue': '#3B82F6',
  'green cyan': '#10B981',
  'vibrant orange': '#F59E0B',
  'vibrant red': '#EF4444',
  'vibrant purple': '#8B5CF6',
  'vibrant pink': '#EC4899',
  'light cyan': '#14B8A6',
  'grayish cyan blue': '#64748B',
} as const;

export type DepartmentColorName = keyof typeof DEPARTMENT_COLORS;

/** A department as typed into the Add/Edit Department dialog. */
export type DepartmentData = {
  name: string;
  description: string;
  colorName: DepartmentColorName;
  /** "External ID (optional)". */
  externalId: string;
};

const TREATMENTS = [
  'Botox',
  'Dermal Fillers',
  'Laser Hair Removal',
  'Chemical Peel',
  'Microneedling',
  'HydraFacial',
  'Teeth Whitening',
  'PRP Hair Therapy',
];

const DEPARTMENTS = [
  'Cardiology',
  'Dermatology',
  'Orthodontics',
  'Aesthetics',
  'Physiotherapy',
  'Pediatrics',
  'Radiology',
  'Nutrition',
];

const DEPARTMENT_FOCUS = [
  'routine check-ups and follow-up visits',
  'new patient consultations',
  'urgent same-day appointments',
  'long-term treatment plans',
];

const SPECIALTIES = [
  'dermatology',
  'cosmetic dentistry',
  'aesthetic medicine',
  'plastic surgery',
  'skin care',
  'hair restoration',
];

const PATIENT_TRAITS = [
  'calm and patient with nervous patients',
  'known for clear, friendly explanations',
  'focused on natural-looking results',
  'careful to answer every question before treatment',
];

const AUDIENCES = [
  'adults with sensitive skin',
  'first-time patients',
  'anyone looking for a quick refresh',
  'patients who want subtle results',
];

const RECOVERY = [
  'Most patients return to normal activities the same day.',
  'Mild redness usually fades within a day or two.',
  'No downtime is needed after the session.',
  'Some swelling is normal and settles within a week.',
];

/**
 * Six-digit number so every record is unique. Two runs can pick the same
 * fake name, and the tests rely on names to find (and delete) their own rows.
 */
function uniqueSuffix(): string {
  return faker.string.numeric({ length: 6, allowLeadingZeros: false });
}

/** A realistic doctor with a unique name. */
export function buildDoctor(): DoctorData {
  return {
    // First and last name only: fullName() can add prefixes like "Mrs." or suffixes like "Jr.".
    name: `Dr. ${faker.person.firstName()} ${faker.person.lastName()} ${uniqueSuffix()}`,
    website: faker.internet.url(),
    emrId: `DR-${faker.string.numeric(4)}`,
    description:
      `Specialist in ${faker.helpers.arrayElement(SPECIALTIES)} with ` +
      `${faker.number.int({ min: 3, max: 25 })} years of experience, ` +
      `${faker.helpers.arrayElement(PATIENT_TRAITS)}.`,
  };
}

/** A realistic treatment with a unique name and a discount below its price. */
export function buildTreatment(): TreatmentData {
  const price = faker.number.int({ min: 200, max: 5000 });
  const treatment = faker.helpers.arrayElement(TREATMENTS);
  return {
    name: `${treatment} ${uniqueSuffix()}`,
    website: faker.internet.url(),
    price: String(price),
    // Always below the full price, as a discount should be.
    discountedPrice: String(faker.number.int({ min: 100, max: price - 50 })),
    emrId: `TR-${faker.string.numeric(4)}`,
    description:
      `${treatment} session lasting about ${faker.helpers.arrayElement([15, 30, 45, 60])} minutes, ` +
      `suited to ${faker.helpers.arrayElement(AUDIENCES)}. ` +
      faker.helpers.arrayElement(RECOVERY),
  };
}

/** A realistic department with a unique name and a random colour. */
export function buildDepartment(): DepartmentData {
  const department = faker.helpers.arrayElement(DEPARTMENTS);
  return {
    name: `${department} ${uniqueSuffix()}`,
    description: `Handles ${faker.helpers.arrayElement(DEPARTMENT_FOCUS)} for ${department.toLowerCase()}.`,
    colorName: faker.helpers.objectKey(DEPARTMENT_COLORS),
    externalId: `DP-${faker.string.numeric(4)}`,
  };
}

/** Any department colour except `colorName`, so an edit always changes the colour. */
export function otherColorThan(colorName: DepartmentColorName): DepartmentColorName {
  const others = (Object.keys(DEPARTMENT_COLORS) as DepartmentColorName[]).filter(
    (name) => name !== colorName,
  );
  return faker.helpers.arrayElement(others);
}

/** An email on example.com, a domain reserved for testing, so it can never be a real account. */
export function buildUnknownEmail(): string {
  return faker.internet.email({ provider: 'example.com' }).toLowerCase();
}

/** A random password that will not match any real account's password. */
export function buildWrongPassword(): string {
  return faker.internet.password({ length: 14 });
}
