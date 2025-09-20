export const formatDate = (dateString: string | Date | undefined, language: string = 'ar'): string => {
  if (!dateString) {
    console.warn('Invalid date provided to formatDate:', dateString);
    return 'غير معروف';
  }
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) {
      console.warn('Invalid date object:', dateString);
      return 'غير معروف';
    }
    const isRtl = language === 'ar';
    if (isRtl) {
      const formatter = new Intl.DateTimeFormat('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      return formatter.format(date).replace('AM', 'ص').replace('PM', 'م');
    }
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch (err) {
    console.error('formatDate error:', err);
    return 'غير معروف';
  }
};