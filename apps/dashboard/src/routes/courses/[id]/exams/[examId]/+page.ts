export const load = async ({ params = { id: '', examId: '' } }) => {
  return {
    courseId: params.id,
    examId: params.examId
  };
};
