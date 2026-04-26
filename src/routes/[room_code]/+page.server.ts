import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params }) => {
	return { roomCode: params.room_code.toUpperCase() };
};
