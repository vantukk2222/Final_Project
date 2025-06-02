export const getFileTypeInfo = (fileName: string) => {
  const extension = fileName?.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return {
        icon: 'picture-as-pdf',
        color: '#EF4444',
        bgColor: 'rgba(239, 68, 68, 0.15)',
      };
    case 'doc':
    case 'docx':
      return {
        icon: 'description',
        color: '#3B82F6',
        bgColor: 'rgba(59, 130, 246, 0.15)',
      };
    case 'xls':
    case 'xlsx':
      return {
        icon: 'grid-on',
        color: '#10B981',
        bgColor: 'rgba(16, 185, 129, 0.15)',
      };
    case 'ppt':
    case 'pptx':
      return {
        icon: 'slideshow',
        color: '#F59E0B',
        bgColor: 'rgba(245, 158, 11, 0.15)',
      };
    case 'zip':
    case 'rar':
      return {
        icon: 'archive',
        color: '#8B5CF6',
        bgColor: 'rgba(139, 92, 246, 0.15)',
      };
    default:
      return {
        icon: 'attach-file',
        color: '#4AC6D0',
        bgColor: 'rgba(74, 198, 208, 0.15)',
      };
  }
};
