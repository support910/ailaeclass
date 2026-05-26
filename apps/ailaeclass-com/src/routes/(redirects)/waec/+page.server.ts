import { redirect } from '@sveltejs/kit';

export const load = async () => {
  redirect(307, 'https://form.ailaeclass.com/f/1v25DtmN');
};
