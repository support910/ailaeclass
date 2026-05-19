import type { Handle } from '@sveltejs/kit';
import { validateUser } from '$lib/utils/services/middlewares';

const PUBLIC_API_ROUTES = [
  '/api/completion',
  'student_prove_payment',
  'teacher_student_buycourse',
  '/api/polar',
  '/api/lmz',
  '/api/verify',
  '/api/chat'
];

function isPublicRoute(pathname: string) {
  return PUBLIC_API_ROUTES.some((route) => pathname.includes(route));
}

export const handle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;

  // Only validate API routes
  if (!pathname.includes('/api')) {
    return resolve(event);
  }

  // Skip public routes
  if (isPublicRoute(pathname)) {
    return resolve(event);
  }

  const authorization = event.request.headers.get('Authorization') || '';
  // Support both "Bearer <token>" and raw "<token>" formats
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
  const accessToken = tokenMatch?.[1] || authorization;

  if (!accessToken) {
    console.warn(`[hooks] Missing or malformed Authorization header for ${pathname}`);
    return new Response(
      JSON.stringify({
        code: 'unauthenticated',
        message: 'Missing or invalid authentication token. Please log in again.'
      }),
      { status: 401 }
    );
  }

  try {
    const user = await validateUser(accessToken);
    event.request.headers.set('user_id', `${user.id}`);
  } catch (error) {
    console.error(`[hooks] validateUser failed for ${pathname}:`, error);
    if (error instanceof Error && error.message === 'Unauthenticated user') {
      return new Response(
        JSON.stringify({ code: 'unauthenticated', message: 'Unauthenticated user' }),
        { status: 401 }
      );
    }
  }

  return resolve(event);
};
