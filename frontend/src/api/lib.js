export const handleApiError = (error) => {
  if (error.response) {
    const msg = error.response.data?.error ?? `Server error ${error.response.status}`;
    throw new Error(msg);
  }
  if (error.request) throw new Error('No response from server');
  throw error;
};
