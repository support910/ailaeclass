import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

export async function POST({ fetch, request }) {
  const { to, courseName, studentName, studentEmail } = await request.json();
  console.log('/POST api/email/course/teacher_student_joined', to, courseName);

  if (!to || !courseName || !studentName || !studentEmail) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  const emailData = [
    {
      from: `<notify@mail.classroomio.com>`,
      to,
      subject: `[${courseName}] You've got a new student 🎉!`,
      content: `
      <p>Hi amazing tutor,</p>
      <p>Congratulations 🎉, a new student: <strong>${studentName} (${studentEmail})</strong> has joined a course you are teaching: ${courseName}</p>
      <p>We hope they have a great experience learning from the best (YOU).</p>
      <p>If you run into any issues, please don’t fail to reach out to us, we’d love to make your teaching experience as easy as possible.</p>
    `
    }
  ];

  await sendEmail(fetch)(emailData);

  return json({
    success: true,
    message: 'Email sent'
  });
}
