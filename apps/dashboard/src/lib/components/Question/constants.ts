export const QUESTION_TYPE = {
  RADIO: 1,
  CHECKBOX: 2,
  TEXTAREA: 3,
  TRUE_FALSE: 4
};

export const QUESTION_TYPES = [
  {
    id: QUESTION_TYPE.RADIO,
    label: 'course.navItem.lessons.exercises.all_exercises.edit_mode.question_types.single'
  },
  {
    id: QUESTION_TYPE.CHECKBOX,
    label: 'course.navItem.lessons.exercises.all_exercises.edit_mode.question_types.multiple'
  },
  {
    id: QUESTION_TYPE.TEXTAREA,
    label: 'course.navItem.lessons.exercises.all_exercises.edit_mode.question_types.paragraph'
  }
];

// Exam-only question types; TRUE_FALSE is a UI-only type that maps to RADIO in DB.
export const EXAM_QUESTION_TYPES = [
  ...QUESTION_TYPES,
  {
    id: QUESTION_TYPE.TRUE_FALSE,
    label: 'components.exam.question_type.true_false'
  }
];

export const QUESTION_TEMPLATE = {
  id: 1,
  title: '',
  type: QUESTION_TYPE.RADIO,
  answers: [],
  options: [
    {
      id: 1,
      value: null
    }
  ]
};
