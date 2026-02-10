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
