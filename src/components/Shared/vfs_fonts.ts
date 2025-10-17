import CairoRegular from '../../../public/fonts/Cairo-Regular.ttf';
import CairoBold from '../../../public/fonts/Cairo-Bold.ttf';
import AmiriRegular from '../../../public/fonts/Amiri-Regular.ttf';

export default {
  pdfMake: {
    vfs: {
      'Amiri-Regular.ttf': AmiriRegular,
      'Cairo-Regular.ttf': CairoRegular,
      'Cairo-Bold.ttf': CairoBold,
    },
  },
};