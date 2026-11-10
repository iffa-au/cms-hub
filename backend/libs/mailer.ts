import Mailchimp from "@mailchimp/mailchimp_transactional";

type MailConfig = {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  adminEmail: string;
};

export const TEMPLATE_SLUGS = {
  MC_TEMPLATE_SLUG: "film-enquiry-received",
  MC_FILM_ENQUIRY_TEMPLATE_SLUG: "filmenquiry-thankyou",
};

let cachedClient: ReturnType<typeof Mailchimp> | null = null;
let cachedConfig: MailConfig | null = null;

function loadConfig(): MailConfig {
  if (cachedConfig) return cachedConfig;
  const {
    MAILCHIMP_TX_API_KEY,
    MAIL_FROM_EMAIL,
    MAIL_FROM_NAME,
    MAILCHIMP_TO_IFFA_EMAIL,
  } = process.env;

  if (!MAILCHIMP_TX_API_KEY || !MAIL_FROM_EMAIL || !MAILCHIMP_TO_IFFA_EMAIL) {
    throw new Error(
      "Missing Mailchimp envs: MAILCHIMP_TX_API_KEY, MAIL_FROM_EMAIL, MAILCHIMP_TO_IFFA_EMAIL",
    );
  }
  cachedConfig = {
    apiKey: MAILCHIMP_TX_API_KEY,
    fromEmail: MAIL_FROM_EMAIL,
    fromName: MAIL_FROM_NAME || "IFFA",
    adminEmail: MAILCHIMP_TO_IFFA_EMAIL,
  };
  return cachedConfig;
}

function getClient() {
  if (!cachedClient) {
    const cfg = loadConfig();
    cachedClient = Mailchimp(cfg.apiKey);
  }
  return cachedClient;
}

export async function sendSubmissionReceipt(
  toEmail: string,
  vars: { title: string; id: string; submissionDate: string },
) {
  const cfg = loadConfig();
  const client = getClient();

  // 1) Send submission email to user (template)
  const userRes = await client.messages.sendTemplate({
    template_name: TEMPLATE_SLUGS.MC_TEMPLATE_SLUG,
    template_content: [],
    message: {
      subject: `We received your submission: ${vars.title}`,
      from_email: cfg.fromEmail,
      from_name: cfg.fromName,
      to: [{ email: toEmail, type: "to" }],
      merge: true,
      tags: ["submission-receipt-user"],
      global_merge_vars: [
        { name: "TITLE", content: vars.title },
        { name: "ID", content: vars.id },
        { name: "SUBMISSION_DATE", content: vars.submissionDate },
      ],
    },
  });

  // 2) Send submission email to admin (plain text)
  const adminRes = await client.messages.send({
    message: {
      subject: `New submission received: ${vars.title}`,
      from_email: cfg.fromEmail,
      from_name: cfg.fromName,
      to: [{ email: cfg.adminEmail, type: "to" }],
      tags: ["submission-receipt-admin"],
      text:
        `A new film submission has been received.\n\n` +
        `Title: ${vars.title}\n` +
        `Submission ID: ${vars.id}\n` +
        `Submission Date: ${vars.submissionDate}\n` +
        `Submitter Email: ${toEmail}\n`,
    },
  });

  // Mailchimp Transactional responses are usually arrays
  const u = Array.isArray(userRes) ? (userRes as any[])[0] : userRes;
  const a = Array.isArray(adminRes) ? (adminRes as any[])[0] : adminRes;

  // Log full responses for debugging (queued/sent/rejected + reject_reason)
  console.log("Mailchimp user response:", userRes);
  console.log("Mailchimp admin response:", adminRes);

  const result = {
    user: {
      to: toEmail,
      status: u?.status,
      reject_reason: u?.reject_reason,
      id: u?._id || u?.id,
    },
    admin: {
      to: cfg.adminEmail,
      status: a?.status,
      reject_reason: a?.reject_reason,
      id: a?._id || a?.id,
    },
  };

  console.log("Mailchimp send result:", result);
  return result;
}

export const sendFilmEnquiryReceipt = async (
  toEmail: string,
  vars: { name: string; email: string; role: string; title: string },
) => {
  const cfg = loadConfig();
  const client = getClient();

  const res = await client.messages.sendTemplate({
    template_name: TEMPLATE_SLUGS.MC_FILM_ENQUIRY_TEMPLATE_SLUG,
    template_content: [],
    message: {
      subject: `Thank you for your film enquiry`,
      from_email: cfg.fromEmail,
      from_name: cfg.fromName,
      to: [{ email: toEmail, type: "to" }], // ✅ REQUIRED
      merge: true, // ✅ ensure merge tags work reliably
      tags: ["film-enquiry-receipt-user"],
      global_merge_vars: [
        { name: "NAME", content: vars.name },
        { name: "EMAIL", content: vars.email },
        { name: "ROLE", content: vars.role },
        { name: "TITLE", content: vars.title },
      ],
    },
  });

  console.log("Mailchimp film enquiry user response:", res);
  return res;
};

/* -------------------------------------------------------------------------
 * Talent Lab
 *
 * Plain-text messages (no Mailchimp template to create or keep in sync).
 * Sensitive answers — access requirements, First Nations and regional
 * identification — are never put in an email; IFFA's notification points
 * staff at the CMS record instead.
 * ---------------------------------------------------------------------- */

/** The CMS's public origin, for links in staff notifications. Optional. */
function cmsLink(path: string): string {
  const base = process.env.CMS_URL?.trim().replace(/\/+$/, "");
  return base ? `\nOpen it in the CMS: ${base}${path}\n` : "";
}

/**
 * Sends one plain-text email and throws if Mailchimp didn't accept it.
 *
 * The Mailchimp Transactional client *returns* an error object (an AxiosError)
 * instead of rejecting, and a refused recipient comes back as a normal result
 * with status "rejected" or "invalid". Both would otherwise vanish silently, so
 * they are turned into errors here, which the callers log.
 */
async function sendPlain(to: string, subject: string, text: string, tag: string) {
  const cfg = loadConfig();
  const res: unknown = await getClient().messages.send({
    message: {
      subject,
      from_email: cfg.fromEmail,
      from_name: cfg.fromName,
      to: [{ email: to, type: "to" }],
      tags: [tag],
      text,
    },
  });

  const first = Array.isArray(res)
    ? (res[0] as { status?: string; reject_reason?: string; queued_reason?: string })
    : null;
  if (!first) {
    const detail = (res as { response?: { data?: unknown }; message?: string }) ?? {};
    throw new Error(
      `Mailchimp did not accept "${tag}": ${JSON.stringify(detail.response?.data ?? detail.message ?? res).slice(0, 300)}`,
    );
  }
  if (first.status === "rejected" || first.status === "invalid") {
    throw new Error(`Mailchimp ${first.status} "${tag}"${first.reject_reason ? ` (${first.reject_reason})` : ""}`);
  }
  // "queued" with a reason means held, not sent — e.g. "sending-suspended" when
  // the Mailchimp account can't send. The record is safe; the email is not out.
  if (first.status === "queued" && first.queued_reason) {
    console.warn(`Mailchimp held "${tag}": queued (${first.queued_reason})`);
  } else {
    console.log(`Mailchimp "${tag}": ${first.status}`);
  }
  return res;
}

export async function sendTalentLabApplicationEmails(vars: {
  id: string;
  reference: string;
  fullName: string;
  email: string;
  program: string;
  primaryDiscipline: string;
  careerStage: string;
  location: string;
}) {
  const cfg = loadConfig();
  const firstName = vars.fullName.split(/\s+/)[0] || vars.fullName;

  await sendPlain(
    vars.email,
    `We received your IFFA Talent Lab application (${vars.reference})`,
    `Hi ${firstName},\n\n` +
      `Thank you for applying to the IFFA Talent Lab. Your application has been received.\n\n` +
      `Program: ${vars.program}\n` +
      `Reference: ${vars.reference}\n\n` +
      `Please keep this reference: quote it if you contact us about your application. ` +
      `Our team will review every application and be in touch.\n\n` +
      `IFFA Talent Lab\nhttps://iffa.com.au/talent-lab\n`,
    "talent-lab-application-applicant",
  );

  await sendPlain(
    cfg.adminEmail,
    `New Talent Lab application: ${vars.fullName} (${vars.program})`,
    `A new Talent Lab application has been received.\n\n` +
      `Reference: ${vars.reference}\n` +
      `Name: ${vars.fullName}\n` +
      `Email: ${vars.email}\n` +
      `Program: ${vars.program}\n` +
      `Discipline: ${vars.primaryDiscipline}\n` +
      `Career stage: ${vars.careerStage}\n` +
      `Location: ${vars.location}\n` +
      cmsLink(`/talent-lab/applications/${vars.id}`),
    "talent-lab-application-admin",
  );
}

export async function sendTalentLabRegistrationEmails(vars: {
  id: string;
  fullName: string;
  email: string;
  state: string;
  discipline: string;
  careerStage: string;
  programs: string[];
  mailingList: boolean;
}) {
  const cfg = loadConfig();
  const firstName = vars.fullName.split(/\s+/)[0] || vars.fullName;
  const programs = vars.programs.length ? vars.programs.join(", ") : "Not specified";

  await sendPlain(
    vars.email,
    "Thanks for registering your interest in the IFFA Talent Lab",
    `Hi ${firstName},\n\n` +
      `Thanks for registering your interest in the IFFA Talent Lab. ` +
      `We'll let you know when applications open for the programs you chose.\n\n` +
      `Programs: ${programs}\n\n` +
      `IFFA Talent Lab\nhttps://iffa.com.au/talent-lab\n`,
    "talent-lab-registration-applicant",
  );

  await sendPlain(
    cfg.adminEmail,
    `New Talent Lab registration of interest: ${vars.fullName}`,
    `A new Talent Lab registration of interest has been received.\n\n` +
      `Name: ${vars.fullName}\n` +
      `Email: ${vars.email}\n` +
      `State: ${vars.state}\n` +
      `Discipline: ${vars.discipline}\n` +
      `Career stage: ${vars.careerStage}\n` +
      `Programs: ${programs}\n` +
      `Mailing list: ${vars.mailingList ? "Yes" : "No"}\n` +
      cmsLink(`/talent-lab/registrations`),
    "talent-lab-registration-admin",
  );
}
