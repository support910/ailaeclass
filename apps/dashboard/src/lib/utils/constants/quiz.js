import cloneDeep from 'lodash/cloneDeep';

export const themeImages = {
  standard: {
    card: '',
    editor: '',
    play: ''
  },
  mainland: {
    card: '',
    editor: '',
    play: ''
  }
};

export const defOption = {
  id: 1,
  label: '',
  options: []
};

export const optionImage = {
  circle: '',
  spade: '',
  square: '',
  pentagon: '',
  hexagon: '',
  triangle: ''
};

export const allOptions = [
  {
    id: 'circle',
    label: '',
    isCorrect: false
  },
  {
    id: 'triangle',
    label: '',
    isCorrect: false
  },
  {
    id: 'spade',
    label: '',
    isCorrect: false
  },
  {
    id: 'square',
    label: '',
    isCorrect: false
  },
  {
    id: 'pentagon',
    label: '',
    isCorrect: false
  },
  {
    id: 'hexagon',
    label: '',
    isCorrect: false
  }
];
export const booleanOptions = [
  {
    id: 'triangle',
    label: 'True',
    image: ''
  },
  {
    id: 'square',
    label: 'False',
    image: ''
  }
];
export const allThemes = [
  {
    id: 'standard',
    label: 'Standard'
  },
  {
    id: 'mainland',
    label: 'Mainland Bridge'
  }
];

export const defQuestion = {
  id: new Date().getTime(),
  title: '',
  type: 'multichoice',
  options: [],
  timelimit: '10s'
};

export const STEPS = {
  CONNECT_TO_PLAY: 'CONNECT_TO_PLAY',
  WAIT_FOR_PLAYERS: 'WAIT_FOR_PLAYERS',
  SHOW_NEXT_QUESTION: 'SHOW_NEXT_QUESTION',
  SCOREBOARD: 'SCOREBOARD',
  PODIUM: 'PODIUM'
};
