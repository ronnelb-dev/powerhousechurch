export const DEFAULT_CONTACT_FORM_VALUES = {
  name: "",
  email: "",
  subject: "",
  message: "",
  honeypot: "",
};

export type ContactFormValues = typeof DEFAULT_CONTACT_FORM_VALUES;

export const DEFAULT_VISIT_FORM_VALUES = {
  name: "",
  email: "",
  phone: "",
  city: "",
  preferredService: "",
  visitDate: "",
  adultCount: "1",
  isFirstTimeGuest: "yes",
  bringingKids: false,
  kidsCount: "",
  kidsDetails: "",
  wantsUsherFollowUp: false,
  wantsPastorFollowUp: false,
  notes: "",
  honeypot: "",
};

export type VisitFormValues = typeof DEFAULT_VISIT_FORM_VALUES;

export function getServiceOptions(settings: Record<string, string>) {
  const firstService = settings["service.sunday1"] ?? "7:00 AM";
  const secondService = settings["service.sunday2"] ?? "9:00 AM";

  return [
    {
      value: `Sunday ${firstService}`,
      label: `Sunday ${firstService}`,
      detail: "First service",
    },
    {
      value: `Sunday ${secondService}`,
      label: `Sunday ${secondService}`,
      detail: "Second service",
    },
    {
      value: "Help me choose",
      label: "Help me choose the best service",
      detail: "We can recommend a good fit",
    },
  ];
}
