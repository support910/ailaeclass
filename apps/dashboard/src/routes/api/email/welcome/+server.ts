import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';
import { BRAND } from '$lib/utils/config/brand';

export async function POST({ fetch, request }) {
  const { to, name } = await request.json();
  console.log('/POST api/email/welcome', to, name);

  if (!to || !name) {
    return json({ success: false, message: 'Name and To are required fields' }, { status: 400 });
  }

  const emailData = [
    {
      from: `"${BRAND.name}" <notify@mail.5gnumultimedia.com>`,
      to,
      subject: `Welcome to ${BRAND.name}!`,
      content: `
    <p>Dear ${name},</p>
      <p>Welcome to ${BRAND.name}! Thanks for signing up.</p>
      <p>
        If you have any questions or need help getting started, feel free to reach out. We're here to help!
      </p>
    `
    }
  ];

  await sendEmail(fetch)(emailData);

  return json({
    success: true,
    message: 'Email sent'
  });
}
