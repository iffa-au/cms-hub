import Mailchimp from "@mailchimp/mailchimp_transactional";

const apiKey = process.env.MAILCHIMP_TX_API_KEY!;
const fromEmail = process.env.MAIL_FROM_EMAIL!;
const fromName = process.env.MAIL_FROM_NAME || "IFFA";
const adminEmail = process.env.MAILCHIMP_TO_IFFA_EMAIL!;
const template = process.env.MC_TEMPLATE_SLUG || "SubmitFilm-Thankyou";

const client = Mailchimp(apiKey);

export async function sendSubmissionReceipt(toEmail: string, vars: { title: string; id: string, submissionDate: string }) {
    // Send submission email to user
  await client.messages.sendTemplate({
    template_name: template,
    template_content: [],
    message: {
      subject: `We received your submission: ${vars.title}`,
      from_email: fromEmail,
      from_name: fromName,
      to: [{ email: toEmail, type: "to" }],
      merge: true,
      global_merge_vars: [
        { name: "TITLE", content: vars.title },
        { name: "ID", content: vars.id },
        { name: "SUBMISSION_DATE", content: vars.submissionDate },
      ],
    },
  });

  // Send submission email to admin to notify them of the new submission
  await client.messages.send({
    message: {
      subject: `New submission received: ${vars.title}`,
      from_email: fromEmail,
      from_name: fromName,
      to: [{ email: adminEmail, type: "to" }],
      text:
        `A new film submission has been received.\n\n` +
        `Title: ${vars.title}\n` +
        `Submission ID: ${vars.id}\n` +
        `Submission Date: ${vars.submissionDate}\n` +
        `Submitter Email: ${toEmail}\n`,
    },
  });
}



