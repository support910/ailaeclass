import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

// API to send invite to teacher
export async function POST({ fetch, request }) {
  const body = await request.json();
  const { org, email } = body;

  console.log('/POST api/email/invite', body);

  if (!org || !Object.keys(org).length || !email) {
    return json(
      { success: false, message: 'Org data and Teacher name are required' },
      { status: 400 }
    );
  }

  const { id, name, siteName } = org;

  const origin = request.headers.get('origin');
  const inviteData = JSON.stringify({
    email,
    orgId: id,
    orgSiteName: siteName
  });
  const inviteLink = `${origin}/invite/t/${encodeURIComponent(btoa(inviteData))}`;
  console.log('inviteData', inviteData);

  const emailData = [
    {
      from: `"${name}" <notify@mail.5gnumultimedia.com>`,
      to: email,
      subject: `Join ${name}`,
      content: `
    <p>Hey there,</p>
      <p> You have been invited to join ${name}.</p>
      <div>
        <a class="button" href="${inviteLink}">Accept Invitation</a>
      </div>
    `
    }
  ];
  await sendEmail(fetch)(emailData);

  return json({
    success: true,
    message: 'Email sent'
  });
}
