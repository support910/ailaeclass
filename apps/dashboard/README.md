<a href="https://ailaeclass.com/">
  <img alt="A flexible, user-friendly platform for creating, managing, and delivering courses for companies and training organisations" src="https://brand.cdn.ailaeclass.com/og/ailaeclass-og.png" />
  <h1 align="center">ailaeclass</h1>
  <p align="center">
    The Open Source Teaching Platform for Bootcamps
    <br />
    <a href="https://ailaeclass.com">Website</a>  |  <a href="https://dub.sh/ciodiscord">Join Discord community</a>
  </p>
</a>

[![Codacy Badge](https://api.codacy.com/project/badge/Grade/629e2bb8994345729513c4d69ccbe3d5)](https://app.codacy.com/gh/rotimi-best/ailaeclass?utm_source=github.com&utm_medium=referral&utm_content=rotimi-best/ailaeclass&utm_campaign=Badge_Grade)

## ✨ About ailaeclass

<img alt="ailaeclass Courses page" src="https://brand.cdn.ailaeclass.com/ailaeclass-courses.png" />

Streamline training for everyone with ailaeclass.com. Our all-in-one platform empowers bootcamps, educators, and businesses to manage training programs easily. With our platform, anyone can run multiple classes and cohorts all from one UI. The application is mobile-first, which means that students can access your lesson materials from any device.

### Mission: Provide Students with the best learning experience

At ailaeclass, our mission is to provide students with the best possible learning experience. We believe in empowering educators with the tools they need to deliver high-quality education that is accessible, engaging, and effective.

### Key Features

1. **📚 Advanced Course Management:** You can create unlimited courses, create lessons, invite students, add assignments, grade their assignments, and even generate certificates.
2. **👨‍👩‍👦 Multi-Teacher Management:** You can invite other teachers into your organization and assign them individual courses.
3. **🤖 AI Integration:** We've got OpenAI integration for quick course creation where you can generate course content, lesson outlines, and even generate assignments right from your lesson notes.
4. **💬 Forum:** Students can ask questions in your dedicated community and get answers from either you or other students.
5. **🏆 Kahoot-Like Quiz:** You can create live quizzes to create more engagement in your classrooms.
6. **💻 Dedicated Student Dashboard:** Once you create an account, you get a dedicated dashboard where your students can access all their courses, assignments, and more.
7. **🔒 Fully open source:** You can self-hostable the whole stack on your servers.

### Roadmap Features

1. **Forms:** Instead of using Google Forms to collect vital information from your students, you will be able to create forms directly within the dashboard.
2. **Course Announcement:** You can make public announcements from the course dashboard to all your students.
3. **Course Templates:** You can clone a full course or share templates with other people.
4. **Analytics:** You can track data about your students across multiple courses.
5. **Run Courses on Messengers:** Students can just join a channel on slack/discord/telegram and a bot automatically sends daily lesson content to your students without you doing anything.

Please reach out to me on [twitter](https://x.com/rotimi_best) if you have any feature request.

## Built With

- [Svelekit](https://kit.svelte.dev/?ref=ailaeclass.com)
- [Supabase](https://supabase.com/?ref=ailaeclass.com)
- [TailwindCSS](https://tailwindcss.com/?ref=ailaeclass.com)

## Get a Demo

You can book a quick 15 min demo to see if ailaeclass is a good fit for you

<a href="https://cal.com/ailaeclass/demo">
  <img src="https://cal.com/book-with-cal-dark.svg" alt="Book a Call with ailaeclass.com">
</a>

<!-- GETTING STARTED -->

## Getting Started

To get a local copy up and running, please follow these simple steps.

### Prerequisites

Here is what you need to be able to run Cal.com.

- [Node.js](https://nodejs.org/) (Version: >=22.x)
- [Supabase CLI](https://github.com/supabase/cli)
- [Docker](https://docs.docker.com/engine/install/)
- [NPM](https://www.npmjs.com/)

## Development

### Setup

1. Clone the repo

   ```bash
   git clone https://github.com/rotimi-best/ailaeclass.git
   ```

2. Go to project folder

   ```bash
   cd ailaeclass
   ```

3. Setup Node If your Node version does not meet the project's requirements as instructed by the docs, "nvm" (Node Version Manager) allows using Node at the version required by the project:

   ```bash
   nvm use
   ```

   You first might need to install the specific version and then use it:

   ```bash
   nvm install && nvm use
   ```

   You can install nvm from [here](https://github.com/nvm-sh/nvm).

4. Set up your `.env` file

   - Duplicate `.env.example` to `.env`

5. Setup Supabase.

   - Make sure you've downloaded the [supabase cli](https://github.com/supabase/cli)
   - Install and Start [docker](https://docs.docker.com/engine/install/)
   - Go to the project directory in your terminal and start supabase

     ```bash
       supabase start
     ```

   - You should get a result like this

     ```bash
       supabase local development setup is running.

         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
           DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
       Studio URL: http://127.0.0.1:54323
     Inbucket URL: http://127.0.0.1:54324
       JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
         anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
     service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
     ```

   - Supabase environment variables should be taken from the result of `supabase start`

     ```env
       PUBLIC_SUPABASE_URL=<API URL>
       PUBLIC_SUPABASE_ANON_KEY=<anon key>
     ```

   - To view the Supabase studio, open the Studio URL from the result of supabase start

6. Install the required dependencies

   ```bash
   npm i
   ```

7. Run (in development mode)

   ```bash
   npm run dev
   ```

## Related Repos

You can find other repos related to ailaeclass here:

- Help Docs: <https://github.com/rotimi-best/ailaeclass.com/docs>
- ailaeclass.com: <https://github.com/rotimi-best/ailaeclass.com>
