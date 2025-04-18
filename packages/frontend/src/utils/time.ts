export const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60000);
  const seconds = Math.floor((time % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes} min ${seconds} seconds`;
  } else {
    return `${seconds} seconds`;
  }
};
