export const getPublicFileUrl = (key: string) =>
  `${process.env.APP_URL}/uploads/${key}`;
