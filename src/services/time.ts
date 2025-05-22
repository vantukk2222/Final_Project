export function formatTimeFromFirestoreTimestamp(timestamp) {
  if (!timestamp || !timestamp.seconds) return '';
  console.log('timestamp', timestamp);
  // Chuyển sang milliseconds
  const dateObj = new Date(timestamp.seconds * 1000 + Math.floor(timestamp.nanoseconds / 1000000));

  const hours = dateObj.getHours().toString().padStart(2, '0');
  const minutes = dateObj.getMinutes().toString().padStart(2, '0');

  return `${hours}:${minutes}`;
}
