import CairoRegular from './Cairo-Regular.ttf';
import CairoBold from './Cairo-Bold.ttf';
import AmiriRegular from './Amiri-Regular.ttf';

export default {
  pdfMake: {
    vfs: {
      'Amiri-Regular.ttf': AmiriRegular,
      'Cairo-Regular.ttf': CairoRegular,
      'Cairo-Bold.ttf': CairoBold,
    },
  },
};